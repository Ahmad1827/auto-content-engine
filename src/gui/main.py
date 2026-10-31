import glob
import json
import os
import platform
import random
import re
import shutil
import subprocess
import sys
import threading
import time

import customtkinter as ctk
from PIL import Image

from gui import theme as T
from gui.theme import ROOT

from script_gen.generator import get_script
from voice_gen.edge_narration import EDGE_VOICES, LANGUAGES, voice_language
from voice_gen.kokoro_narration import generate_voice, VOICE_PRESETS
from voice_gen.subtitles import generate_srt_from_chunks
from video_edit.editor import create_video as create_doc_video
from trend_finder.trends import get_trending, get_related
from video_edit.downloader import prepare_assets

try:
    from video_edit.thumbnail import create_thumbnail
except ImportError:
    def create_thumbnail(topic_hint, output_path="thumbnail.jpg", language="en"):
        print("[Warning] thumbnail.py is missing! Skipping thumbnail generation.")

from shorts_gen.reddit import get_reddit_stories, format_story_for_tts
from shorts_gen.editor import create_video as create_gameplay_video
from llm.provider import describe_provider, generate
from motion_gen.pipeline import OUTPUT_DIR, make_motion_video
from motion_gen.narration import CHATTERBOX_VOICES, DEFAULT_PRESET, chatterbox_available

SETTINGS_PATH = os.path.join(ROOT, ".ace_settings.json")
THUMB_DIR = os.path.join(OUTPUT_DIR, ".thumbs")

MOTION_STYLES = [("auto", "Auto", "AI picks"), ("atlas", "Atlas", "dark maps"), ("ink", "Ink", "cartoon"),
                 ("parchment", "Parchment", "old maps"), ("neon", "Neon", "mystery"), ("newspaper", "Newspaper", "1900s"),
                 ("pixel", "Pixel", "8-bit people"), ("diorama", "Diorama", "3D people"), ("film", "Custom Film", "built for you")]
STAGES = {"motion": ["Script", "Voice", "Render"], "doc": ["Script", "Images", "Voice", "Render"], "reddit": ["Voice", "Render"]}

BATCH_MODE = False
batch_queue = []


def _voice_label(key):
    """Tk can't draw emoji, so flags become country codes: '🇺🇸 AM - Michael' -> 'US · AM - Michael'."""
    flag = "".join(chr(ord(c) - 0x1F1E6 + 65) for c in key if 0x1F1E6 <= ord(c) <= 0x1F1FF)
    text = re.sub(r"[^\u0000-￿]|️", "", key).strip()
    return f"{flag} · {text}" if flag else text


KOKORO_VOICES = {_voice_label(k): k for k in VOICE_PRESETS}
MOTION_VOICES = {**({_voice_label(k): k for k in CHATTERBOX_VOICES} if chatterbox_available() else {}), **KOKORO_VOICES}
EDGE_VOICE_LABELS = {_voice_label(k): k for k in EDGE_VOICES}
LANGUAGE_CODES = {lang["name"]: code for code, lang in LANGUAGES.items()}


def load_settings():
    try:
        with open(SETTINGS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_settings(**changes):
    settings.update(changes)
    try:
        with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)
    except OSError:
        pass


def open_path(path):
    if sys.platform == "win32":
        os.startfile(path)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path])
    elif "microsoft" in platform.release().lower():
        win_path = subprocess.run(["wslpath", "-w", path], capture_output=True, text=True).stdout.strip()
        subprocess.Popen(["explorer.exe", win_path])
    else:
        subprocess.Popen(["xdg-open", path])


def ui(fn, *args):
    """Runs fn on the Tk thread; pipelines call this from worker threads."""
    root.after(0, lambda: fn(*args))


# ==========================================
# PIPELINES (run on worker threads, raise on failure)
# ==========================================
def archive_output(base_video_path, topic_name):
    safe_name = "".join(c for c in topic_name if c.isalnum() or c in " _-").strip().replace(" ", "_") or "Video"
    rand_id = random.randint(1000, 9999)
    new_vid = f"Output_{safe_name}_{rand_id}.mp4"
    new_thumb = f"Output_{safe_name}_{rand_id}_Thumb.jpg"
    if os.path.exists(base_video_path):
        shutil.move(base_video_path, new_vid)
    if os.path.exists("thumbnail.jpg"):
        shutil.move("thumbnail.jpg", new_thumb)
    print(f"[System] Successfully archived as {new_vid}")
    return os.path.abspath(new_vid)


def cleanup_old_assets():
    print("[System] Cleaning up old temporary assets...")
    files_to_delete = ["video_final.wav", "video_final.mp3", "generated_script.txt",
                       "final_video.mp4", "subtitles.srt", "temp_no_subs.mp4",
                       "short_audio.wav", "short_subs.srt", "final_tiktok.mp4", "final_youtube.mp4", "thumbnail.jpg"]
    for file in files_to_delete:
        if os.path.exists(file):
            os.remove(file)


def process_content(text, custom_keywords, do_web, do_ai, is_short, sec_per_img_str, img_count_str, voice, topic="Video"):
    if not text.strip():
        raise ValueError("The script is empty.")
    cleanup_old_assets()
    try: sec_per_img = max(2, int(sec_per_img_str))
    except ValueError: sec_per_img = 5
    try: img_count = max(1, int(img_count_str))
    except ValueError: img_count = 5

    if do_web or do_ai:
        progress(15, "Images", f"Fetching and generating {img_count} images...")
        prepare_assets(text, use_web=do_web, use_ai=do_ai, custom_keywords=custom_keywords, image_count=img_count, is_short=is_short)

    progress(40, "Voice", "Recording the narration...")
    selected_voice = voice if voice in VOICE_PRESETS or voice in EDGE_VOICES else DEFAULT_PRESET
    audio_path, chunk_timings = generate_voice(text, output_path="video_final.wav", preset=selected_voice)
    if not audio_path:
        raise RuntimeError("Audio generation failed!")
    srt_path = generate_srt_from_chunks(chunk_timings, output_srt="subtitles.srt") if chunk_timings else None

    progress(70, "Render", "Rendering the video...")
    create_doc_video(srt_path=srt_path, is_short=is_short, scene_duration=sec_per_img)
    progress(92, "Render", "Painting the thumbnail...")
    create_thumbnail(topic_hint=custom_keywords or topic, language=voice_language(selected_voice))
    return archive_output("final_video.mp4", topic), None


def process_gameplay_content(text_or_story, voice, is_short, topic="Video"):
    cleanup_old_assets()
    if isinstance(text_or_story, dict):
        script = format_story_for_tts(text_or_story)
        topic = text_or_story.get("title", "Reddit_Story")
    else:
        script = text_or_story

    progress(20, "Voice", "Recording voice and subtitles...")
    audio_path, chunk_timings = generate_voice(script, output_path="short_audio.wav", preset=voice)
    srt_path = generate_srt_from_chunks(chunk_timings, output_srt="short_subs.srt")

    progress(60, "Render", "Rendering over gameplay...")
    out_name = "final_tiktok.mp4" if is_short else "final_youtube.mp4"
    success, msg = create_gameplay_video(audio_path, srt_path, bg_video_path="assets/background.mp4", output_path=out_name, is_short=is_short)
    if not success:
        raise RuntimeError(f"Render failed: {msg}")
    return archive_output(out_name, topic), None


def process_motion(task):
    """Motion-graphics TikTok: AI storyboard -> voice (Kokoro or Chatterbox) -> Remotion render."""
    script = task.get("script")
    subject = f"Turn this script into the video, keeping its wording:\n{script}" if script else task["topic"]

    def log(msg):
        print(msg)
        m = re.match(r"\[(?:Voice|Chatterbox)\] Scene (\d+)/(\d+)", msg)
        if m:
            done, total = int(m[1]), int(m[2])
            progress(15 + 30 * (done - 1) / total, "Voice", f"Voicing scene {done} of {total}...")
        elif msg.startswith("[Render] Rendered"):
            try:
                done, total = msg.split()[2].strip(",").split("/")
                progress(45 + 55 * int(done) / int(total), "Render", f"Rendering frame {done} of {total}...")
            except (IndexError, ValueError):
                pass
        elif msg.startswith("[Render] Rendering"):
            progress(45, "Render", "Rendering the video...")
        elif msg.startswith("[Film] "):
            text = msg.removeprefix("[Film] ")
            progress(*((5, "Script") if text.startswith("Writing the film") else (45, "Render")), text)

    progress(3, "Script", "Writing the storyboard...")
    result = make_motion_video(subject, style=task["style"], voice=task["voice"], captions=task["captions"],
                               handle=task["handle"], seconds=task["seconds"], log=log)
    return result["video"], result["caption"]


def run_task(task):
    mode = task["mode"]
    if mode == "motion":
        return process_motion(task)
    if mode == "reddit":
        story = task.get("story")
        if story is None:
            stories = get_reddit_stories(subreddit=task["subreddit"], limit=1)
            if not stories:
                raise RuntimeError(f"No stories found on r/{task['subreddit']}.")
            story = stories[0]
        return process_gameplay_content(story, task["voice"], task["is_short"])

    script = task.get("script")
    if not script:
        progress(3, "Script", "Writing the script...")
        script = get_script(task["topic"], task["subtopics"], str(task["minutes"]), language=voice_language(task["voice"]))
        if script.startswith(("Error:", "AI Error:")):
            raise RuntimeError(f"Script generation failed: {script}")
    with open("generated_script.txt", "w", encoding="utf-8") as f:
        f.write(script)
    if task["background"] == "Gameplay":
        return process_gameplay_content(script, task["voice"], task["is_short"], task["topic"])
    return process_content(script, task["keywords"], task["do_web"], task["do_ai"], task["is_short"],
                           task["sec_per_img"], task["img_count"], task["voice"], task["topic"])


def execute(task):
    """Runs one task on the current (worker) thread and reports to the UI. Returns True on success."""
    ui(job_started, task)
    try:
        video, caption = run_task(task)
    except Exception as e:
        print(f"[Error] {e}", file=sys.stderr)
        ui(job_failed, str(e))
        return False
    ui(job_done, video, caption)
    return True


def run_now(task):
    set_busy(True)

    def worker():
        execute(task)
        ui(set_busy, False)
    threading.Thread(target=worker, daemon=True).start()


def start_batch():
    global BATCH_MODE
    if not batch_queue:
        set_status("The night shift queue is empty. Add a few videos first.", T.ACCENT)
        return
    BATCH_MODE = True
    set_busy(True)
    threading.Thread(target=batch_worker, daemon=True).start()


def batch_worker():
    global BATCH_MODE
    print("\n" + "=" * 40 + "\nNIGHT SHIFT STARTED\n" + "=" * 40)
    done = failed = 0
    while batch_queue:
        task = batch_queue.pop(0)
        ui(refresh_queue)
        print(f"\n[Night Shift] Executing Task: {task['label']}")
        if execute(task):
            done += 1
        else:
            failed += 1
    print("\n" + "=" * 40 + f"\nNIGHT SHIFT COMPLETE: {done} made, {failed} failed\n" + "=" * 40)
    BATCH_MODE = False
    ui(set_busy, False)
    ui(set_status, f"Night shift finished: {done} made" + (f", {failed} failed (see log)." if failed else "."),
       T.BAD if failed else T.GOOD)


# ==========================================
# UI STATE
# ==========================================
current_stages = []


def progress(pct, stage=None, text=None):
    ui(_progress, pct, stage, text)


def _progress(pct, stage, text):
    progress_bar.set(max(0, min(pct, 100)) / 100)
    if stage:
        _paint_stages(stage)
    if text:
        set_status(text)


def _paint_stages(active=None, all_done=False):
    for w in stage_frame.winfo_children():
        w.destroy()
    reached = active not in current_stages
    for i, name in enumerate(current_stages):
        if i:
            ctk.CTkLabel(stage_frame, text="—", font=T.font(T.MONO, 11), text_color=T.RULE).pack(side="left", padx=4)
        if name == active:
            reached = True
        color = T.ACCENT if name == active and not all_done else (T.MUTED if reached and not all_done else T.INK)
        ctk.CTkLabel(stage_frame, text=name.upper(), font=T.font(T.MONO, 11, "bold"), text_color=color).pack(side="left")


def set_status(text, color=T.INK):
    status_label.configure(text=text, text_color=color)


def job_started(task):
    global current_stages
    current_stages = STAGES[task["mode"]]
    if task["mode"] == "doc" and task.get("script"):
        current_stages = current_stages[1:]
    _paint_stages(current_stages[0])
    progress_bar.set(0)
    result_actions.pack_forget()
    set_status(f"Starting: {task['label']}")


def job_done(video, caption):
    progress_bar.set(1)
    _paint_stages(all_done=True)
    set_status(f"Saved  {os.path.basename(video)}", T.GOOD)
    play_btn.configure(command=lambda: open_path(video))
    caption_btn.configure(command=lambda: copy_text(caption, "Caption copied."))
    caption_btn.pack_forget() if not caption else caption_btn.pack(side="left", padx=(6, 0))
    result_actions.pack(side="right", padx=(10, 0))
    refresh_reel()


def job_failed(message):
    progress_bar.set(0)
    set_status(f"Failed: {message[:120]}", T.BAD)
    show_log(True)


def set_busy(busy):
    if not busy and BATCH_MODE:
        return
    state = "disabled" if busy else "normal"
    for panel in panels.values():
        panel.make_btn.configure(state=state, text=panel.busy_text if busy else panel.make_text)
    start_q_btn.configure(state=state)


def copy_text(text, message):
    root.clipboard_clear()
    root.clipboard_append(text)
    set_status(message, T.GOOD)


# ==========================================
# WIDGET HELPERS
# ==========================================
def section(parent, number, title, pady=(22, 10)):
    row = ctk.CTkFrame(parent, fg_color="transparent")
    row.pack(fill="x", pady=pady)
    ctk.CTkLabel(row, text=number, font=T.font(T.MONO, 12, "bold"), text_color=T.ACCENT).pack(side="left")
    ctk.CTkLabel(row, text=title.upper(), font=T.font(T.MONO, 12, "bold"), text_color=T.MUTED).pack(side="left", padx=(10, 12))
    ctk.CTkFrame(row, height=1, fg_color=T.RULE).pack(side="left", fill="x", expand=True, pady=(2, 0))
    return row


def entry(parent, placeholder="", width=140, size=14, height=38):
    return ctk.CTkEntry(parent, placeholder_text=placeholder, width=width, height=height, font=T.font(T.SANS, size),
                        fg_color=T.FIELD, border_color=T.RULE, border_width=1, text_color=T.INK,
                        placeholder_text_color=T.MUTED, corner_radius=6)


def ghost_button(parent, text, command, width=0, height=34):
    return ctk.CTkButton(parent, text=text, command=command, width=width, height=height, font=T.font(T.SANS, 13, "bold"),
                         fg_color="transparent", hover_color=T.FIELD_HOVER, border_width=1, border_color=T.RULE,
                         text_color=T.INK, corner_radius=6)


def link_button(parent, text, command, color=T.MUTED, size=12):
    return ctk.CTkButton(parent, text=text, command=command, width=0, height=22, font=T.font(T.MONO, size),
                         fg_color="transparent", hover_color=T.FIELD_HOVER, text_color=color, corner_radius=4)


def option_menu(parent, values, value, command=None, width=320):
    menu = ctk.CTkOptionMenu(parent, values=values, width=width, height=38, font=T.font(T.SANS, 14),
                             dropdown_font=T.font(T.SANS, 13), fg_color=T.FIELD, button_color=T.FIELD,
                             button_hover_color=T.FIELD_HOVER, text_color=T.INK, dropdown_fg_color=T.SURFACE,
                             dropdown_hover_color=T.FIELD_HOVER, dropdown_text_color=T.INK, corner_radius=6,
                             command=command, dynamic_resizing=False)
    menu.set(value if value in values else values[0])
    return menu


class VoicePicker(ctk.CTkFrame):
    """A language menu, and a voice menu that only lists voices speaking that language."""

    def __init__(self, parent, key, english_voices, english_default=None, english_hint=""):
        super().__init__(parent, fg_color="transparent")
        self.key, self.english_voices, self.english_default, self.english_hint = key, english_voices, english_default, english_hint
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(anchor="w")
        names = list(LANGUAGE_CODES)
        self.language = option_menu(row, names, settings.get(f"{key}_language", "English"), self._language_changed, width=170)
        self.language.pack(side="left", padx=(0, 10))
        self.voice_menu = option_menu(row, list(english_voices), english_default or "", self._voice_changed)
        self.voice_menu.pack(side="left")
        self.hint = ctk.CTkLabel(self, text="", font=T.font(T.MONO, 11), text_color=T.MUTED)
        self._language_changed(self.language.get())

    def _setting(self):
        code = LANGUAGE_CODES[self.language.get()]
        return f"{self.key}_voice" if code == "en" else f"{self.key}_voice_{code}"

    def _voices(self):
        if LANGUAGE_CODES[self.language.get()] == "en":
            return list(self.english_voices)
        return [label for label, preset in EDGE_VOICE_LABELS.items() if voice_language(preset) == LANGUAGE_CODES[self.language.get()]]

    def _language_changed(self, name):
        save_settings(**{f"{self.key}_language": name})
        english = LANGUAGE_CODES[name] == "en"
        voices = self._voices()
        saved = settings.get(self._setting(), self.english_default if english else None)
        self.voice_menu.configure(values=voices)
        self.voice_menu.set(saved if saved in voices else voices[0])
        hint = self.english_hint if english else "Online voice: needs internet while it records."
        self.hint.configure(text=hint)
        if hint:
            self.hint.pack(anchor="w", pady=(6, 0))
        else:
            self.hint.pack_forget()

    def _voice_changed(self, label):
        save_settings(**{self._setting(): label})

    def preset(self):
        label = self.voice_menu.get()
        return EDGE_VOICE_LABELS.get(label) or self.english_voices[label]


def switch(parent, text, value=True):
    var = ctk.BooleanVar(value=value)
    ctk.CTkSwitch(parent, text=text, variable=var, font=T.font(T.SANS, 13), text_color=T.INK, progress_color=T.ACCENT,
                  button_color=T.SURFACE, button_hover_color=T.FIELD, fg_color=T.RULE, switch_width=38,
                  switch_height=20).pack(side="left", padx=(0, 22))
    return var


class Choice(ctk.CTkFrame):
    """A row of pill buttons where exactly one is selected (CTk's segmented button can't colour text per state)."""

    def __init__(self, parent, options, value, command=None, size=12, fg=T.FIELD, border=T.RULE,
                 on=(T.INK, T.BG), off=T.MUTED, hover=T.FIELD_HOVER):
        super().__init__(parent, fg_color=fg, corner_radius=8, border_width=1, border_color=border)
        self.command = command
        self.colors = on, off, hover
        self.buttons = {}
        for opt in options:
            b = ctk.CTkButton(self, text=opt, width=0, height=30, font=T.font(T.MONO, size, "bold"), corner_radius=6,
                              command=lambda o=opt: self.set(o, notify=True))
            b.pack(side="left", padx=3, pady=3)
            self.buttons[opt] = b
        self.set(value if value in options else options[0])

    def set(self, value, notify=False):
        self.value = value
        (on_bg, on_text), off_text, hover = self.colors
        for opt, b in self.buttons.items():
            on = opt == value
            b.configure(fg_color=on_bg if on else "transparent", hover_color=on_bg if on else hover,
                        text_color=on_text if on else off_text)
        if notify and self.command:
            self.command(value)

    def get(self):
        return self.value


class ScriptToggle:
    """'Paste my own script' link that reveals a text box under the subject field."""

    def __init__(self, parent, on_change=None):
        self.on = False
        self.on_change = on_change
        self.link = link_button(parent, "+ paste my own script instead", self.toggle, T.ACCENT)
        self.link.pack(anchor="w", pady=(8, 0))
        self.box = ctk.CTkTextbox(parent, height=150, font=T.font(T.SANS, 13), fg_color=T.FIELD, border_color=T.RULE,
                                  border_width=1, text_color=T.INK, corner_radius=6, wrap="word")

    def toggle(self):
        self.on = not self.on
        self.link.configure(text="– never mind, let the AI write it" if self.on else "+ paste my own script instead")
        if self.on:
            self.box.pack(fill="x", pady=(8, 0), after=self.link)
            self.box.focus_set()
        else:
            self.box.pack_forget()
        if self.on_change:
            self.on_change(self.on)

    def get(self):
        return self.box.get("1.0", "end").strip() if self.on else ""


def flash(widget):
    widget.configure(border_color=T.ACCENT, border_width=2)
    widget.focus_set()
    root.after(1400, lambda: widget.configure(border_color=T.RULE, border_width=1))


def pick_from_list(title, items, on_pick):
    """Small themed chooser window (trending topics, Reddit stories)."""
    win = ctk.CTkToplevel(root, fg_color=T.BG)
    win.title(title)
    win.geometry("560x520")
    win.transient(root)
    ctk.CTkLabel(win, text=title, font=T.font(T.SERIF, 26), text_color=T.INK).pack(anchor="w", padx=24, pady=(20, 8))
    listing = ctk.CTkScrollableFrame(win, fg_color="transparent", scrollbar_button_color=T.RULE)
    listing.pack(fill="both", expand=True, padx=16, pady=(0, 16))

    def choose(i):
        win.destroy()
        on_pick(i)

    for i, text in enumerate(items):
        ctk.CTkButton(listing, text=text, anchor="w", height=40, font=T.font(T.SANS, 13), fg_color=T.SURFACE,
                      hover_color=T.FIELD_HOVER, text_color=T.INK, corner_radius=6,
                      command=lambda i=i: choose(i)).pack(fill="x", pady=3, padx=4)
    win.after(150, lambda: (win.lift(), win.focus_force()))
    win.protocol("WM_DELETE_WINDOW", lambda: (win.destroy(), set_busy(False)) if not BATCH_MODE else win.destroy())
    return win


# ==========================================
# MODE PANELS
# ==========================================
class MotionPanel(ctk.CTkFrame):
    kicker, title = "MOTION GRAPHICS", "What's the story?"
    blurb = "One moment from history or faith. The AI writes it, a voice tells it, maps and line art animate it."
    make_text, busy_text = "Make the video  →", "Working on it..."

    def __init__(self, parent):
        super().__init__(parent, fg_color="transparent")
        section(self, "01", "Subject", pady=(0, 10))
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x")
        self.topic = entry(row, "e.g. the Dancing Plague of 1518", size=17, height=50)
        self.topic.pack(side="left", fill="x", expand=True)
        self.topic.bind("<Return>", lambda e: self.make())
        self.dice = ghost_button(row, "Surprise me", self.roll_dice, height=50)
        self.dice.pack(side="left", padx=(10, 0))
        self.script = ScriptToggle(self, lambda on: self.topic.configure(
            placeholder_text="Title for the file (optional)" if on else "e.g. the Dancing Plague of 1518"))

        section(self, "02", "Look")
        cards = ctk.CTkFrame(self, fg_color="transparent")
        cards.pack(fill="x")
        self.cards = {}
        self.style = settings.get("motion_style", "auto")
        for key, name, note in MOTION_STYLES:
            self.cards[key] = self._card(cards, key, name, note)
            self.cards[key].pack(side="left", padx=(0, 6))
        self.pick_style(self.style)

        section(self, "03", "Voice")
        hint = "" if chatterbox_available() else "Chatterbox (the natural free voice) isn't installed; see the README."
        self.voice = VoicePicker(self, "motion", MOTION_VOICES, english_hint=hint)
        self.voice.pack(anchor="w")

        section(self, "04", "Runtime")
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x")
        self.seconds = ctk.IntVar(value=settings.get("motion_seconds", 60))
        self.seconds_label = ctk.CTkLabel(row, text="", width=64, anchor="w", font=T.font(T.SERIF, 26), text_color=T.INK)
        ctk.CTkSlider(row, from_=20, to=90, number_of_steps=14, variable=self.seconds, width=220, height=16,
                      progress_color=T.ACCENT, button_color=T.INK, button_hover_color=T.ACCENT, fg_color=T.RULE,
                      command=lambda v: self._seconds_changed()).pack(side="left", padx=(0, 14))
        self.seconds_label.pack(side="left", padx=(0, 26))
        self._seconds_changed()
        self.captions = switch(row, "Captions", settings.get("motion_captions", True))
        self.handle = entry(row, "@yourhandle", width=150)
        self.handle.pack(side="left")
        if settings.get("handle"):
            self.handle.insert(0, settings["handle"])

        actions(self)

    def _card(self, parent, key, name, note):
        card = ctk.CTkFrame(parent, fg_color=T.SURFACE, corner_radius=8, border_width=2, border_color=T.RULE, cursor="hand2")
        thumb_path = os.path.join(ROOT, "assets", "ui", f"style_{key}.jpg")
        if os.path.exists(thumb_path):
            img = ctk.CTkImage(Image.open(thumb_path), size=(70, 124))
            art = ctk.CTkLabel(card, text="", image=img, width=70, height=124)
        else:
            art = ctk.CTkLabel(card, text="?", width=70, height=124, font=T.font(T.SERIF, 56, slant="italic"),
                               text_color=T.ACCENT, fg_color=T.FIELD, corner_radius=4)
        art.pack(padx=5, pady=(5, 4))
        name_l = ctk.CTkLabel(card, text=name, font=T.font(T.SANS, 12, "bold"), text_color=T.INK, height=16)
        name_l.pack()
        note_l = ctk.CTkLabel(card, text=note, font=T.font(T.MONO, 10), text_color=T.MUTED, height=14)
        note_l.pack(pady=(0, 7))
        card.name_label = name_l
        for w in (card, art, name_l, note_l):
            w.bind("<Button-1>", lambda e, k=key: self.pick_style(k))
        return card

    def pick_style(self, key):
        self.style = key
        save_settings(motion_style=key)
        for k, card in self.cards.items():
            card.configure(border_color=T.ACCENT if k == key else T.RULE)
            card.name_label.configure(text_color=T.ACCENT if k == key else T.INK)

    def _seconds_changed(self):
        self.seconds_label.configure(text=f"{self.seconds.get()}s")

    def roll_dice(self):
        self.dice.configure(state="disabled", text="Thinking...")
        set_status("Asking the AI for a story worth telling...", T.MUTED)
        recent = ", ".join(v["title"] for v in recent_videos(10))

        def worker():
            try:
                idea = generate(
                    "Suggest ONE specific, surprising and well-documented moment from history or religious history "
                    "that would make a gripping 60-second TikTok. Be concrete (who, where, when). "
                    f"Do not suggest any of these, already made: {recent or 'none'}. "
                    "Return ONLY its name in at most 10 words, like 'The Great Emu War of 1932'.",
                    schema={"type": "object", "properties": {"topic": {"type": "string"}}, "required": ["topic"]})
                ui(self._dice_result, idea["topic"].strip())
            except Exception as e:
                print(f"[Error] Idea failed: {e}", file=sys.stderr)
                ui(self._dice_result, None)
        threading.Thread(target=worker, daemon=True).start()

    def _dice_result(self, topic):
        self.dice.configure(state="normal", text="Surprise me")
        if topic:
            self.topic.delete(0, "end")
            self.topic.insert(0, topic)
            set_status("How about this one? Hit make, or roll again.")
        else:
            set_status("Couldn't get an idea from the AI (see log).", T.BAD)

    def task(self):
        topic, script = self.topic.get().strip(), self.script.get()
        if not topic and not script:
            flash(self.topic)
            set_status("Give it a subject first, or let it surprise you.", T.ACCENT)
            return None
        handle = self.handle.get().strip()
        if handle and not handle.startswith("@"):
            handle = "@" + handle
        save_settings(handle=handle, motion_seconds=self.seconds.get(), motion_captions=self.captions.get())
        return {"mode": "motion", "topic": topic or "Manual_Video", "script": script, "style": self.style,
                "voice": self.voice.preset(), "seconds": self.seconds.get(), "captions": self.captions.get(),
                "handle": handle, "label": f"Motion · {topic or 'own script'}"}

    def make(self):
        task = self.task()
        if task:
            run_now(task)


class DocPanel(ctk.CTkFrame):
    kicker, title = "DOCUMENTARY", "What should we cover?"
    blurb = "A narrated video over web and AI images, with subtitles and a thumbnail. Long or short."
    make_text, busy_text = "Make the video  →", "Working on it..."

    def __init__(self, parent):
        super().__init__(parent, fg_color="transparent")
        section(self, "01", "Subject", pady=(0, 10))
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x")
        self.topic = entry(row, "e.g. the fall of Constantinople", size=17, height=50)
        self.topic.pack(side="left", fill="x", expand=True)
        self.topic.bind("<Return>", lambda e: self.make())
        self.trends_btn = ghost_button(row, "Trending", self.trends, height=50)
        self.trends_btn.pack(side="left", padx=(10, 0))
        self.subtopics = entry(self, "Angles to cover (optional), e.g. the siege, the cannons, aftermath")
        self.subtopics.pack(fill="x", pady=(8, 0))
        self.script = ScriptToggle(self)

        section(self, "02", "Format")
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x")
        self.format = Choice(row, ["9:16 VERTICAL", "16:9 HORIZONTAL"], settings.get("doc_format", "9:16 VERTICAL"),
                             lambda v: save_settings(doc_format=v))
        self.format.pack(side="left", padx=(0, 14))
        self.background = Choice(row, ["IMAGES", "GAMEPLAY"], "IMAGES", lambda v: self._background_changed())
        self.background.pack(side="left")

        section(self, "03", "Voice")
        self.voice = VoicePicker(self, "doc", KOKORO_VOICES, english_default=_voice_label(DEFAULT_PRESET))
        self.voice.pack(anchor="w")

        section(self, "04", "Details")
        grid = ctk.CTkFrame(self, fg_color="transparent")
        grid.pack(fill="x")
        self.fields = {}
        for col, (key, label, default) in enumerate([("minutes", "Minutes", "10"), ("sec_per_img", "Secs / image", "4"),
                                                     ("img_count", "Images", "10")]):
            ctk.CTkLabel(grid, text=label, font=T.font(T.MONO, 11), text_color=T.MUTED).grid(row=0, column=col, sticky="w", padx=(0, 14))
            e = entry(grid, width=110)
            e.insert(0, default)
            e.grid(row=1, column=col, sticky="w", padx=(0, 14))
            self.fields[key] = e
        ctk.CTkLabel(grid, text="Image keywords", font=T.font(T.MONO, 11), text_color=T.MUTED).grid(row=0, column=3, sticky="w")
        self.keywords = entry(grid, "optional", width=200)
        self.keywords.grid(row=1, column=3, sticky="w")
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x", pady=(14, 0))
        self.do_web = switch(row, "Web images")
        self.do_ai = switch(row, "AI images")

        actions(self)

    def _background_changed(self):
        state = "normal" if self.background.get() == "IMAGES" else "disabled"
        for w in (self.fields["sec_per_img"], self.fields["img_count"], self.keywords):
            w.configure(state=state)

    def trends(self):
        seed = self.topic.get().strip()
        self.trends_btn.configure(state="disabled", text="Looking...")
        set_status(f"Looking for trends around '{seed}'..." if seed else "Looking for what's trending...", T.MUTED)

        def worker():
            try:
                minutes = int(self.fields["minutes"].get() or 10)
            except ValueError:
                minutes = 10
            try:
                results = get_related(seed, duration_min=minutes) if seed else get_trending(duration_min=minutes)
                topics = results.get("rss", []) + results.get("pytrends", [])
            except Exception as e:
                print(f"[Trends] {e}", file=sys.stderr)
                topics = []
            ui(self._show_trends, topics, seed)
        threading.Thread(target=worker, daemon=True).start()

    def _show_trends(self, topics, seed):
        self.trends_btn.configure(state="normal", text="Trending")
        if not topics:
            set_status("No trending topics found right now.", T.BAD)
            return
        set_status(f"Found {len(topics)} topics.")

        def fill(i):
            self.topic.delete(0, "end")
            self.topic.insert(0, topics[i])
            if seed:
                self.subtopics.delete(0, "end")
                self.subtopics.insert(0, seed)
        pick_from_list("Trending now", topics, fill)

    def task(self):
        topic, script = self.topic.get().strip(), self.script.get()
        if not topic and not script:
            flash(self.topic)
            set_status("What's the documentary about?", T.ACCENT)
            return None
        f = {k: e.get().strip() for k, e in self.fields.items()}
        try:
            minutes = max(1, int(f["minutes"]))
        except ValueError:
            minutes = 10
        return {"mode": "doc", "topic": topic or self.keywords.get().strip() or "Manual_Video", "script": script,
                "subtopics": self.subtopics.get().strip(), "minutes": minutes,
                "is_short": self.format.get().startswith("9:16"), "background": self.background.get().title(),
                "sec_per_img": f["sec_per_img"], "img_count": f["img_count"], "keywords": self.keywords.get().strip(),
                "do_web": self.do_web.get(), "do_ai": self.do_ai.get(), "voice": self.voice.preset(),
                "label": f"Documentary · {topic or 'own script'}"}

    def make(self):
        task = self.task()
        if task:
            run_now(task)


class RedditPanel(ctk.CTkFrame):
    kicker, title = "REDDIT STORY", "Pick a subreddit."
    blurb = "A top story read aloud over gameplay footage (assets/background.mp4), with bold subtitles."
    make_text, busy_text = "Find stories  →", "Working on it..."

    def __init__(self, parent):
        super().__init__(parent, fg_color="transparent")
        section(self, "01", "Subreddit", pady=(0, 10))
        row = ctk.CTkFrame(self, fg_color="transparent")
        row.pack(fill="x")
        ctk.CTkLabel(row, text="r/", font=T.font(T.SERIF, 30), text_color=T.MUTED).pack(side="left", padx=(0, 6))
        self.sub = entry(row, "AmItheAsshole", size=17, height=50)
        self.sub.pack(side="left", fill="x", expand=True)
        self.sub.bind("<Return>", lambda e: self.make())

        section(self, "02", "Format")
        self.format = Choice(self, ["9:16 VERTICAL", "16:9 HORIZONTAL"], "9:16 VERTICAL")
        self.format.pack(anchor="w")

        section(self, "03", "Voice")
        voices = list(KOKORO_VOICES)
        self.voice = option_menu(self, voices, settings.get("reddit_voice", _voice_label(DEFAULT_PRESET)), lambda v: save_settings(reddit_voice=v))
        self.voice.pack(anchor="w")

        actions(self, queue_hint="Night shift takes the top story.")

    def task(self):
        sub = self.sub.get().strip().removeprefix("r/") or "AmItheAsshole"
        return {"mode": "reddit", "subreddit": sub, "is_short": self.format.get().startswith("9:16"),
                "voice": KOKORO_VOICES[self.voice.get()], "label": f"Reddit · r/{sub}"}

    def make(self):
        task = self.task()
        set_busy(True)
        set_status(f"Fetching top stories from r/{task['subreddit']}...", T.MUTED)

        def worker():
            try:
                stories = get_reddit_stories(subreddit=task["subreddit"], limit=10)
            except Exception as e:
                print(f"[Reddit] {e}", file=sys.stderr)
                stories = []
            ui(self._choose, task, stories)
        threading.Thread(target=worker, daemon=True).start()

    def _choose(self, task, stories):
        if not stories:
            set_busy(False)
            set_status(f"Couldn't find stories on r/{task['subreddit']}.", T.BAD)
            return
        set_status("Pick a story.")

        def picked(i):
            set_busy(False)
            run_now(dict(task, story=stories[i], label=f"Reddit · {stories[i]['title'][:60]}"))
        pick_from_list(f"r/{task['subreddit']}", [s["title"] for s in stories], picked)


def actions(panel, queue_hint=""):
    row = ctk.CTkFrame(panel, fg_color="transparent")
    row.pack(fill="x", pady=(34, 0))
    panel.make_btn = ctk.CTkButton(row, text=panel.make_text, command=panel.make, width=250, height=54,
                                   font=T.font(T.SANS, 16, "bold"), fg_color=T.ACCENT, hover_color=T.ACCENT_HOVER,
                                   text_color=T.ON_ACCENT, text_color_disabled=T.ON_ACCENT, corner_radius=8)
    panel.make_btn.pack(side="left")
    ghost_button(row, "+ Add to night shift", lambda: add_to_queue(panel), width=190, height=54).pack(side="left", padx=(12, 0))
    if queue_hint:
        ctk.CTkLabel(row, text=queue_hint, font=T.font(T.MONO, 11), text_color=T.MUTED).pack(side="left", padx=(14, 0))


# ==========================================
# NIGHT SHIFT + REEL
# ==========================================
def add_to_queue(panel):
    task = panel.task()
    if not task:
        return
    batch_queue.append(task)
    refresh_queue()
    set_status(f"Queued for the night shift: {task['label']}", T.GOOD)
    print(f"[Batch Manager] Task added: {task['label']}")


def remove_from_queue(index):
    if 0 <= index < len(batch_queue):
        batch_queue.pop(index)
    refresh_queue()


def clear_queue():
    batch_queue.clear()
    refresh_queue()


def refresh_queue():
    for w in queue_list.winfo_children():
        w.destroy()
    queue_count.configure(text=f"{len(batch_queue):02d}")
    if not batch_queue:
        ctk.CTkLabel(queue_list, text="Nothing queued. Line up videos,\nstart the shift, go to sleep.",
                     font=T.font(T.MONO, 11), text_color=T.MUTED, justify="left").pack(anchor="w", pady=4)
        return
    for i, task in enumerate(batch_queue):
        row = ctk.CTkFrame(queue_list, fg_color="transparent")
        row.pack(fill="x", pady=1)
        ctk.CTkLabel(row, text=f"{i + 1:02d}", font=T.font(T.MONO, 11, "bold"), text_color=T.ACCENT).pack(side="left")
        ctk.CTkLabel(row, text=task["label"][:34], font=T.font(T.SANS, 12), text_color=T.INK, anchor="w").pack(side="left", padx=8)
        if not BATCH_MODE:
            link_button(row, "×", lambda i=i: remove_from_queue(i), size=14).pack(side="right")


def _prettify(stem):
    if stem.startswith("Output_"):
        stem = re.sub(r"^Output_|_\d{4}$", "", stem)
    return stem.replace("_", " ").strip().capitalize() or "Untitled"


def _probe(path):
    """(duration_seconds, thumbnail_path) for a video, cached by mtime."""
    os.makedirs(THUMB_DIR, exist_ok=True)
    stem = os.path.splitext(os.path.basename(path))[0]
    thumb = os.path.join(THUMB_DIR, stem + ".jpg")
    meta_path = os.path.join(THUMB_DIR, stem + ".json")
    mtime = os.path.getmtime(path)
    try:
        with open(meta_path, encoding="utf-8") as f:
            meta = json.load(f)
        if meta["mtime"] == mtime and os.path.exists(thumb):
            return meta["duration"], thumb
    except (OSError, ValueError, KeyError):
        pass
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    out = subprocess.run([ffmpeg, "-y", "-ss", "1.2", "-i", path, "-frames:v", "1", "-vf",
                          "scale=108:192:force_original_aspect_ratio=decrease,pad=108:192:(ow-iw)/2:(oh-ih)/2:color=black",
                          thumb], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out.stderr)
    duration = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"mtime": mtime, "duration": duration}, f)
    return duration, thumb


def recent_videos(limit=12):
    paths = set(glob.glob(os.path.join(OUTPUT_DIR, "*.mp4")) + glob.glob(os.path.join(ROOT, "Output_*.mp4"))
                + glob.glob(os.path.abspath("Output_*.mp4")))
    videos = []
    for path in sorted(paths, key=os.path.getmtime, reverse=True)[:limit]:
        base = os.path.splitext(path)[0]
        title, style = _prettify(os.path.basename(base)), None
        try:
            with open(base + ".storyboard.json", encoding="utf-8") as f:
                board = json.load(f)
            title, style = board.get("title", title), board.get("style")
        except (OSError, ValueError):
            pass
        caption = None
        if os.path.exists(base + ".caption.txt"):
            with open(base + ".caption.txt", encoding="utf-8") as f:
                caption = f.read().strip()
        videos.append({"path": path, "title": title, "style": style, "caption": caption, "mtime": os.path.getmtime(path)})
    return videos


def refresh_reel():
    def worker():
        videos = recent_videos()
        for v in videos:
            try:
                v["duration"], v["thumb"] = _probe(v["path"])
            except Exception:
                v["duration"], v["thumb"] = 0, None
        ui(_draw_reel, videos)
    threading.Thread(target=worker, daemon=True).start()


def _draw_reel(videos):
    for w in reel_list.winfo_children():
        w.destroy()
    if not videos:
        ctk.CTkLabel(reel_list, text="Your finished videos will show up here.", font=T.font(T.MONO, 11),
                     text_color=T.MUTED).pack(anchor="w", pady=6)
        return
    for v in videos:
        row = ctk.CTkFrame(reel_list, fg_color="transparent", cursor="hand2")
        row.pack(fill="x", pady=(0, 12))
        if v.get("thumb") and os.path.exists(v["thumb"]):
            img = ctk.CTkImage(Image.open(v["thumb"]), size=(54, 96))
            art = ctk.CTkLabel(row, text="", image=img, width=54, height=96)
        else:
            art = ctk.CTkLabel(row, text="▶", width=54, height=96, fg_color=T.FIELD, text_color=T.MUTED, corner_radius=4)
        art.pack(side="left", anchor="n")
        info = ctk.CTkFrame(row, fg_color="transparent")
        info.pack(side="left", fill="x", expand=True, padx=(12, 0), anchor="n")
        title = ctk.CTkLabel(info, text=v["title"], font=T.font(T.SERIF, 16), text_color=T.INK, wraplength=210,
                             justify="left", anchor="w")
        title.pack(anchor="w")
        meta = [f"{int(v['duration'])}s" if v.get("duration") else None, v["style"],
                time.strftime("%b %d", time.localtime(v["mtime"]))]
        ctk.CTkLabel(info, text="  ·  ".join(m for m in meta if m).upper(), font=T.font(T.MONO, 10),
                     text_color=T.MUTED, anchor="w").pack(anchor="w", pady=(2, 2))
        links = ctk.CTkFrame(info, fg_color="transparent")
        links.pack(anchor="w")
        link_button(links, "Play", lambda p=v["path"]: open_path(p), T.ACCENT, 11).pack(side="left")
        if v["caption"]:
            link_button(links, "Copy caption", lambda c=v["caption"]: copy_text(c, "Caption copied."), size=11).pack(side="left")
        for w in (art, title):
            w.bind("<Button-1>", lambda e, p=v["path"]: open_path(p))


# ==========================================
# LOG
# ==========================================
class RedirectText:
    def __init__(self, stream, tag=None):
        self.stream = stream
        self.tag = tag

    def write(self, string):
        if self.stream:
            self.stream.write(string)
        try:
            root.after(0, self._write, string)
        except RuntimeError:
            pass

    def _write(self, string):
        log_box.configure(state="normal")
        log_box.insert("end", string, self.tag)
        log_box.see("end")
        log_box.configure(state="disabled")

    def flush(self):
        if self.stream:
            self.stream.flush()


def show_log(force=None):
    visible = not log_box.winfo_ismapped() if force is None else force
    # Floats over the bottom of the window instead of squeezing the form.
    if visible:
        log_box.place(in_=tape, x=0, y=-230, relwidth=1)
        log_box.lift()
    else:
        log_box.place_forget()
    log_btn.configure(text="Hide log ▾" if visible else "Show log ▴")


def set_appearance(mode):
    ctk.set_appearance_mode(mode.lower())
    save_settings(appearance=mode.lower())
    log_box.tag_config("error", foreground="#B3261E" if mode.lower() == "light" else "#FF8A80")


def switch_mode(key):
    for k, panel in panels.items():
        panel.pack_forget()
        btn = mode_buttons[k]
        on = k == key
        btn.configure(fg_color=T.SLATE_ACTIVE if on else "transparent")
        btn.bar.configure(fg_color=T.ACCENT if on else "transparent")
        btn.title_l.configure(text_color=T.SLATE_INK if on else T.SLATE_MUTED)
    panel = panels[key]
    kicker_l.configure(text=f"NO. {list(panels).index(key) + 1:02d}  —  {panel.kicker}")
    title_l.configure(text=panel.title)
    blurb_l.configure(text=panel.blurb)
    panel.pack(fill="both", expand=True)
    save_settings(mode=key)


def detect_ai():
    name = describe_provider()
    print(f"[System] AI engine: {name}")
    ok = "Claude" in name or "Gemini" in name
    ui(lambda: ai_status.configure(text=f"●  {name}", text_color=T.SLATE_GOOD if ok else T.SLATE_BAD))


# ==========================================
# WINDOW
# ==========================================
T.load_fonts()
settings = load_settings()
ctk.set_appearance_mode(settings.get("appearance", "dark"))

root = ctk.CTk(fg_color=T.BG)
root.title("ACE · Auto Content Engine")
root.geometry("1360x880")
root.minsize(1300, 820)
root.grid_columnconfigure(1, weight=1)
root.grid_rowconfigure(0, weight=1)

# --- Sidebar (the slate) ---
side = ctk.CTkFrame(root, fg_color=T.SLATE, corner_radius=0, width=230)
side.grid(row=0, column=0, rowspan=2, sticky="nsw")
side.pack_propagate(False)
ctk.CTkLabel(side, text="ACE", font=T.font(T.SERIF, 54), text_color=T.SLATE_INK).pack(anchor="w", padx=26, pady=(26, 0))
ctk.CTkLabel(side, text="AUTO CONTENT ENGINE", font=T.font(T.MONO, 10, "bold"), text_color=T.SLATE_MUTED).pack(anchor="w", padx=28)
ctk.CTkFrame(side, height=1, fg_color=("#3A352F", "#2A2723")).pack(fill="x", padx=26, pady=(22, 16))
ctk.CTkLabel(side, text="MAKE", font=T.font(T.MONO, 10, "bold"), text_color=T.SLATE_MUTED).pack(anchor="w", padx=28, pady=(0, 6))

mode_buttons = {}
for key, name, note in [("motion", "Motion graphics", "maps · line art · counters"),
                        ("doc", "Documentary", "stock + AI images"),
                        ("reddit", "Reddit story", "over gameplay")]:
    btn = ctk.CTkFrame(side, fg_color="transparent", corner_radius=6, cursor="hand2")
    btn.pack(fill="x", padx=14, pady=2)
    btn.bar = ctk.CTkFrame(btn, width=3, height=40, fg_color="transparent", corner_radius=2)
    btn.bar.pack(side="left", padx=(4, 10), pady=8)
    text = ctk.CTkFrame(btn, fg_color="transparent")
    text.pack(side="left", pady=8)
    btn.title_l = ctk.CTkLabel(text, text=name, font=T.font(T.SANS, 15, "bold"), text_color=T.SLATE_MUTED, height=20, anchor="w")
    btn.title_l.pack(anchor="w")
    note_l = ctk.CTkLabel(text, text=note, font=T.font(T.MONO, 10), text_color=T.SLATE_MUTED, height=14, anchor="w")
    note_l.pack(anchor="w")
    for w in (btn, btn.bar, text, btn.title_l, note_l):
        w.bind("<Button-1>", lambda e, k=key: switch_mode(k))
    mode_buttons[key] = btn

side_bottom = ctk.CTkFrame(side, fg_color="transparent")
side_bottom.pack(side="bottom", fill="x", padx=26, pady=24)
ctk.CTkLabel(side_bottom, text="ENGINE", font=T.font(T.MONO, 10, "bold"), text_color=T.SLATE_MUTED).pack(anchor="w")
ai_status = ctk.CTkLabel(side_bottom, text="●  detecting AI...", font=T.font(T.MONO, 11), text_color=T.SLATE_MUTED, anchor="w")
ai_status.pack(anchor="w", pady=(4, 0))
ctk.CTkLabel(side_bottom, text=f"●  Chatterbox {'ready' if chatterbox_available() else 'not installed'}",
             font=T.font(T.MONO, 11), text_color=T.SLATE_GOOD if chatterbox_available() else T.SLATE_MUTED,
             anchor="w").pack(anchor="w", pady=(2, 18))
Choice(side_bottom, ["LIGHT", "DARK"], settings.get("appearance", "dark").upper(), set_appearance, size=11,
       fg=T.SLATE, border=T.SLATE_ACTIVE, on=(T.SLATE_INK, T.SLATE), off=T.SLATE_MUTED, hover=T.SLATE_ACTIVE).pack(anchor="w")

# --- Main column ---
main = ctk.CTkFrame(root, fg_color="transparent")
main.grid(row=0, column=1, sticky="nsew", padx=(44, 20), pady=(30, 0))
kicker_l = ctk.CTkLabel(main, text="", font=T.font(T.MONO, 11, "bold"), text_color=T.ACCENT)
kicker_l.pack(anchor="w")
title_l = ctk.CTkLabel(main, text="", font=T.font(T.SERIF, 46), text_color=T.INK)
title_l.pack(anchor="w", pady=(0, 0))
blurb_l = ctk.CTkLabel(main, text="", font=T.font(T.SANS, 14), text_color=T.MUTED, wraplength=640, justify="left")
blurb_l.pack(anchor="w", pady=(0, 24))
panel_host = ctk.CTkFrame(main, fg_color="transparent")
panel_host.pack(fill="both", expand=True)

# --- Right rail ---
rail = ctk.CTkFrame(root, fg_color=T.SURFACE, corner_radius=0, width=360)
rail.grid(row=0, column=2, sticky="nse")
rail.pack_propagate(False)
ctk.CTkFrame(rail, width=1, fg_color=T.RULE).pack(side="left", fill="y")
rail_inner = ctk.CTkFrame(rail, fg_color="transparent")
rail_inner.pack(side="left", fill="both", expand=True, padx=(22, 14), pady=(30, 0))

reel_head = ctk.CTkFrame(rail_inner, fg_color="transparent")
reel_head.pack(fill="x")
ctk.CTkLabel(reel_head, text="The reel", font=T.font(T.SERIF, 26), text_color=T.INK).pack(side="left")
link_button(reel_head, "open folder", lambda: open_path(OUTPUT_DIR if os.path.isdir(OUTPUT_DIR) else ROOT), size=11).pack(side="right")
ctk.CTkFrame(rail_inner, height=1, fg_color=T.RULE).pack(fill="x", pady=(8, 12))
reel_list = ctk.CTkScrollableFrame(rail_inner, fg_color="transparent", scrollbar_button_color=T.RULE,
                                   scrollbar_button_hover_color=T.MUTED)
reel_list.pack(fill="both", expand=True)

shift = ctk.CTkFrame(rail_inner, fg_color="transparent")
shift.pack(fill="x", pady=(12, 18))
shift_head = ctk.CTkFrame(shift, fg_color="transparent")
shift_head.pack(fill="x")
ctk.CTkLabel(shift_head, text="Night shift", font=T.font(T.SERIF, 26), text_color=T.INK).pack(side="left")
queue_count = ctk.CTkLabel(shift_head, text="00", font=T.font(T.MONO, 12, "bold"), text_color=T.ACCENT)
queue_count.pack(side="left", padx=10, pady=(6, 0))
link_button(shift_head, "clear", clear_queue, size=11).pack(side="right")
ctk.CTkFrame(shift, height=1, fg_color=T.RULE).pack(fill="x", pady=(8, 10))
queue_list = ctk.CTkFrame(shift, fg_color="transparent")
queue_list.pack(fill="x")
start_q_btn = ctk.CTkButton(shift, text="Start the night shift", command=start_batch, height=40,
                            font=T.font(T.SANS, 13, "bold"), fg_color=T.INK, hover_color=T.MUTED, text_color=T.BG,
                            text_color_disabled=T.BG, corner_radius=8)
start_q_btn.pack(fill="x", pady=(12, 0))

# --- Bottom tape: stages, progress, status, log ---
tape = ctk.CTkFrame(root, fg_color=T.SURFACE, corner_radius=0)
tape.grid(row=1, column=1, columnspan=2, sticky="ew")
ctk.CTkFrame(tape, height=1, fg_color=T.RULE).pack(fill="x")
log_box = ctk.CTkTextbox(root, height=230, font=T.font(T.MONO, 11), fg_color=T.FIELD, text_color=T.INK, border_width=1,
                         border_color=T.RULE, corner_radius=0, wrap="word", state="disabled")
tape_row = ctk.CTkFrame(tape, fg_color="transparent")
tape_row.pack(fill="x", padx=28, pady=12)
stage_frame = ctk.CTkFrame(tape_row, fg_color="transparent")
stage_frame.pack(side="left")
progress_bar = ctk.CTkProgressBar(tape_row, height=6, width=180, corner_radius=3, progress_color=T.ACCENT, fg_color=T.RULE)
progress_bar.pack(side="left", padx=18)
progress_bar.set(0)
log_btn = link_button(tape_row, "Show log ▴", lambda: show_log(), size=11)
log_btn.pack(side="right")
result_actions = ctk.CTkFrame(tape_row, fg_color="transparent")
play_btn = link_button(result_actions, "▶ Play", None, T.ACCENT, 12)
play_btn.pack(side="left")
caption_btn = link_button(result_actions, "Copy caption", None, size=12)
status_label = ctk.CTkLabel(tape_row, text="Ready.", font=T.font(T.SANS, 13), text_color=T.INK, anchor="w")
status_label.pack(side="left", fill="x", expand=True)

panels = {"motion": MotionPanel(panel_host), "doc": DocPanel(panel_host), "reddit": RedditPanel(panel_host)}
current_stages = STAGES["motion"]
_paint_stages()
set_appearance(settings.get("appearance", "dark"))
switch_mode(settings.get("mode", "motion") if settings.get("mode") in panels else "motion")
refresh_queue()
refresh_reel()

sys.stdout = RedirectText(sys.__stdout__)
sys.stderr = RedirectText(sys.__stderr__, tag="error")
print("ACE ready. Logs from every job land here.")
threading.Thread(target=detect_ai, daemon=True).start()
