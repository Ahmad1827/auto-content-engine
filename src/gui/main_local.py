"""
main_local.py — MERGED GUI: git + local features + voice preview.
  Project types: Documentary (Images) | Reddit Story (Gameplay) | Gaming Highlights
  Image sources: DDG (Ours) | Bing+Pexels (Git)
  Voice: Full Kokoro selector + 3s preview
  Format: YouTube 16:9 | TikTok 9:16
  Extras: Talking cat, Medal clips, Trends
NU se pune pe git (e in .gitignore).
"""
import tkinter as tk
from tkinter import messagebox, ttk
import os
import threading
import tempfile

from script_gen.generator import get_script
from voice_gen.kokoro_narration import generate_voice, VOICE_PRESETS
from voice_gen.subtitles import generate_srt_from_chunks
from video_edit.editor import create_video as create_doc_video
from video_edit.downloader import prepare_assets
from trend_finder.trends import get_trending, get_related
from image_gen.image_fetcher import fetch_images
from image_gen.talking_cat import generate_cat_video
from videoclips_gen.medal_fetcher import fetch_gaming_clips

# Reddit/shorts — import cu fallback (colegul poate nu le are inca)
try:
    from shorts_gen.reddit import get_reddit_stories, format_story_for_tts
    from shorts_gen.editor import create_video as create_gameplay_video
    HAS_SHORTS = True
except ImportError:
    HAS_SHORTS = False

AVG_CLIP_SEC = 15
PREVIEW_TEXT = "The universe is vast and full of mysteries waiting to be discovered."

BG_MAIN = "#F9FAFB"
BG_CARD = "#FFFFFF"
FG_TEXT = "#111827"
FG_DIM = "#6B7280"
ACCENT_PRIMARY = "#4F46E5"
ACCENT_PRIMARY_ACTIVE = "#4338CA"
ACCENT_SECONDARY = "#10B981"
ACCENT_SECONDARY_ACTIVE = "#059669"
ACCENT_TREND = "#F43F5E"
ACCENT_TREND_ACTIVE = "#E11D48"
ENTRY_BG = "#F3F4F6"
ENTRY_FG = "#111827"


def cleanup_old_assets():
    for f in ["video_final.wav", "video_final.mp3", "generated_script.txt",
              "final_video.mp4", "subtitles.srt", "temp_no_subs.mp4", "cat_video.mp4",
              "short_audio.wav", "short_subs.srt", "final_tiktok.mp4", "final_youtube.mp4"]:
        if os.path.exists(f):
            os.remove(f)

def get_wav_duration(path):
    import soundfile as sf
    return sf.info(path).duration

def calc_clips_needed(duration_min):
    total_sec = duration_min * 60
    return max(3, min(20, int(total_sec / AVG_CLIP_SEC) + 2))


# ── VOICE PREVIEW ────────────────────────────────────────────
def preview_voice():
    voice = combo_voice.get()
    if voice not in VOICE_PRESETS:
        return

    def do_preview():
        root.after(0, lambda: btn_preview.config(text="Playing...", state=tk.DISABLED))
        tmp = os.path.join(tempfile.gettempdir(), "voice_preview.wav")
        try:
            audio_path, _ = generate_voice(PREVIEW_TEXT, output_path=tmp, preset=voice)
            if audio_path and os.path.exists(audio_path):
                # Play with platform-appropriate method
                import platform
                if platform.system() == "Windows":
                    import winsound
                    winsound.PlaySound(audio_path, winsound.SND_FILENAME)
                else:
                    os.system(f"aplay '{audio_path}' 2>/dev/null || afplay '{audio_path}' 2>/dev/null")
        except Exception as e:
            print(f"[Preview] Error: {e}")
        finally:
            root.after(0, lambda: btn_preview.config(text="▶ Preview", state=tk.NORMAL))
            if os.path.exists(tmp):
                try: os.remove(tmp)
                except: pass

    threading.Thread(target=do_preview, daemon=True).start()


# ── GAMING VIDEO ASSEMBLER ───────────────────────────────────
def create_gaming_video(clip_paths, audio_path, srt_path=None, output="final_video.mp4"):
    from moviepy import AudioFileClip, VideoFileClip, concatenate_videoclips

    voice = AudioFileClip(audio_path)
    total_duration = voice.duration

    clips = []
    total_clip_dur = 0
    for path in clip_paths:
        try:
            clip = VideoFileClip(path)
            clip = clip.resized(height=1080)
            if clip.w < 1920:
                clip = clip.resized(width=1920)
            if clip.w > 1920 or clip.h > 1080:
                clip = clip.cropped(width=1920, height=1080,
                                    x_center=clip.w//2, y_center=clip.h//2)
            clip = clip.without_audio()
            clips.append(clip)
            total_clip_dur += clip.duration
        except Exception as e:
            print(f"  [Skip] {path}: {e}")

    if not clips:
        raise RuntimeError("No valid gaming clips")

    if total_clip_dur < total_duration:
        clips = clips * (int(total_duration / total_clip_dur) + 1)

    video = concatenate_videoclips(clips, method="compose")
    video = video.subclipped(0, min(total_duration, video.duration))
    video = video.with_audio(voice)
    video.write_videofile(output, fps=24, codec="libx264", audio_codec="aac",
                          bitrate="8000k", threads=4)
    return output


# ── PIPELINES ────────────────────────────────────────────────
def pipeline_documentary(text, interval, with_cat=False):
    cleanup_old_assets()
    voice_preset = combo_voice.get()
    img_source = combo_img_source.get()
    custom_kw = entry_custom_images.get().strip()
    do_web = var_web_img.get()
    do_ai = var_ai_img.get()

    dur_est = max(1, int(entry_minutes.get() or "10"))
    n_img = max(2, min(20, int(dur_est * 60 / interval) + 1))

    if img_source == "Bing+Pexels (Git)" and (do_web or do_ai):
        root.after(0, lambda: status_label.config(text="1/4: Images (Bing+Pexels)..."))
        prepare_assets(text, use_web=do_web, use_ai=do_ai, custom_keywords=custom_kw)

    root.after(0, lambda: status_label.config(text="2/4: Voice..."))
    audio_path, timings = generate_voice(text, output_path="video_final.wav", preset=voice_preset)
    if not audio_path:
        root.after(0, lambda: messagebox.showerror("Error", "Audio failed!")); return

    srt = generate_srt_from_chunks(timings) if timings else None

    if img_source == "DDG (Ours)":
        dur = get_wav_duration(audio_path)
        n_img = max(2, min(20, int(dur / interval) + 1))
        root.after(0, lambda: status_label.config(text=f"3/4: {n_img} images (DDG)..."))
        if not fetch_images(text, n_img):
            root.after(0, lambda: messagebox.showerror("Error", "No images!")); return

    root.after(0, lambda: status_label.config(text="4/4: Rendering..."))
    create_doc_video(srt_path=srt)

    if with_cat:
        root.after(0, lambda: status_label.config(text="Bonus: Cat..."))
        generate_cat_video(audio_path, "cat_video.mp4")

    root.after(0, lambda: status_label.config(text="Done!"))
    msg = "Done! → final_video.mp4"
    if with_cat: msg += " + cat_video.mp4"
    root.after(0, lambda: messagebox.showinfo("Success", msg))


def pipeline_gaming(text, game_name, num_clips):
    cleanup_old_assets()
    voice_preset = combo_voice.get()

    root.after(0, lambda: status_label.config(text="1/3: Voice..."))
    audio_path, timings = generate_voice(text, output_path="video_final.wav", preset=voice_preset)
    if not audio_path:
        root.after(0, lambda: messagebox.showerror("Error", "Audio failed!")); return

    srt = generate_srt_from_chunks(timings) if timings else None

    root.after(0, lambda: status_label.config(text=f"2/3: {num_clips} {game_name} clips..."))
    clip_paths = fetch_gaming_clips(game_name, num_clips)
    if not clip_paths:
        root.after(0, lambda: messagebox.showerror("Error",
            f"No clips for '{game_name}'.\nCheck MEDAL_GAME_KEY_* in .env")); return

    root.after(0, lambda: status_label.config(text="3/3: Assembling..."))
    create_gaming_video(clip_paths, audio_path, srt)

    root.after(0, lambda: status_label.config(text="Done!"))
    root.after(0, lambda: messagebox.showinfo("Success", "Gaming video → final_video.mp4"))


def pipeline_reddit(story, voice, is_short):
    if not HAS_SHORTS:
        root.after(0, lambda: messagebox.showerror("Error",
            "shorts_gen module not found.\nAsk your colleague to push it."))
        return
    try:
        cleanup_old_assets()
        script = format_story_for_tts(story)

        root.after(0, lambda: status_label.config(text="Voice & Subtitles..."))
        audio_path, timings = generate_voice(script, output_path="short_audio.wav", preset=voice)
        srt = generate_srt_from_chunks(timings, output_srt="short_subs.srt")

        root.after(0, lambda: status_label.config(text="Rendering Gameplay Video..."))
        bg_video = "assets/background.mp4"
        out = "final_tiktok.mp4" if is_short else "final_youtube.mp4"
        success, msg = create_gameplay_video(audio_path, srt, bg_video_path=bg_video,
                                              output_path=out, is_short=is_short)
        if success:
            root.after(0, lambda: messagebox.showinfo("Success", f"Done! → {out}"))
        else:
            root.after(0, lambda: messagebox.showerror("Error", msg))
    except Exception as e:
        root.after(0, lambda: messagebox.showerror("Error", f"Reddit failed: {e}"))
    finally:
        root.after(0, lambda: status_label.config(text="Ready"))
        root.after(0, lambda: btn_generate.config(state=tk.NORMAL))


# ── PROCESS ROUTER ───────────────────────────────────────────
def process_content(text):
    if not text.strip():
        root.after(0, lambda: messagebox.showwarning("Warning", "Script is empty!"))
        return
    try:
        vtype = video_type_var.get()
        interval = max(3, min(60, int(entry_interval.get() or "8")))

        if "Gaming" in vtype:
            game = entry_game.get().strip()
            if not game:
                root.after(0, lambda: messagebox.showwarning("Warning", "Enter a game!")); return
            if clip_mode_var.get() == "Auto":
                n = calc_clips_needed(max(1, int(entry_minutes.get() or "10")))
            else:
                n = max(2, min(20, int(entry_clips.get() or "5")))
            pipeline_gaming(text, game, n)
        elif "Cat" in vtype:
            pipeline_documentary(text, interval, with_cat=True)
        else:
            pipeline_documentary(text, interval, with_cat=False)
    except Exception as e:
        root.after(0, lambda: status_label.config(text="Error"))
        root.after(0, lambda: messagebox.showerror("Error", f"Failed: {e}"))
    finally:
        root.after(0, lambda: btn_generate.config(state=tk.NORMAL))


# ── TRENDING ─────────────────────────────────────────────────
def get_duration():
    try: return max(1, int(entry_minutes.get()))
    except: return 10

def on_find_trending():
    topic = entry_topic.get().strip()
    dur = get_duration()
    def fetch():
        if topic:
            root.after(0, lambda: status_label.config(text=f"Trends for '{topic}'..."))
            results = get_related(topic, duration_min=dur)
        else:
            root.after(0, lambda: status_label.config(text="Finding trends..."))
            results = get_trending(duration_min=dur)
        rss, pytr = results.get("rss", []), results.get("pytrends", [])
        if not rss and not pytr:
            root.after(0, lambda: messagebox.showwarning("Trends", "No topics found."))
            root.after(0, lambda: status_label.config(text="Ready"))
            return
        root.after(0, lambda: show_trend_picker(rss, pytr, topic))
        root.after(0, lambda: status_label.config(text="Ready"))
    threading.Thread(target=fetch, daemon=True).start()

def show_trend_picker(rss, pytr, original):
    win = tk.Toplevel(root)
    win.title("Pick a Topic")
    win.geometry("440x480")
    win.resizable(False, False)
    win.configure(bg=BG_MAIN)
    title = f"Trends for \"{original}\"" if original else "Trending Now"
    tk.Label(win, text=title, font=("Segoe UI", 13, "bold"), bg=BG_MAIN, fg=FG_TEXT).pack(pady=(15, 10))
    for label, topics, color in [("🔥 Google Trends", rss, ACCENT_TREND),
                                  ("📊 Related Searches", pytr, ACCENT_PRIMARY)]:
        if topics:
            tk.Label(win, text=label, font=("Segoe UI", 10, "bold"),
                     bg=BG_MAIN, fg=color).pack(anchor="w", padx=20, pady=(8, 3))
            for t in topics:
                tk.Button(win, text=t, font=("Segoe UI", 11), anchor="w", padx=15, pady=5,
                          bg=BG_CARD, fg=FG_TEXT, activebackground=ENTRY_BG, cursor="hand2",
                          width=40, relief="flat", borderwidth=1,
                          command=lambda tp=t: _pick(tp, original, win)).pack(pady=1, padx=20)

def _pick(topic, original, win):
    win.destroy()
    entry_topic.delete(0, tk.END)
    entry_topic.insert(0, topic)
    entry_subtopics.delete(0, tk.END)
    if original: entry_subtopics.insert(0, original)
    combo_method.set("Gemini")
    status_label.config(text=f"Topic: {topic}")


# ── REDDIT PICKER ────────────────────────────────────────────
def open_reddit_picker(subreddit, voice, is_short):
    if not HAS_SHORTS:
        root.after(0, lambda: messagebox.showerror("Error", "shorts_gen not available."))
        root.after(0, lambda: btn_generate.config(state=tk.NORMAL))
        return

    root.after(0, lambda: status_label.config(text=f"Fetching r/{subreddit}..."))
    stories = get_reddit_stories(subreddit=subreddit, limit=10)
    if not stories:
        root.after(0, lambda: messagebox.showerror("Error", f"No stories in r/{subreddit}"))
        root.after(0, lambda: btn_generate.config(state=tk.NORMAL))
        return

    def on_select():
        sel = listbox.curselection()
        if not sel:
            messagebox.showwarning("Warning", "Pick a story!"); return
        pw.destroy()
        threading.Thread(target=pipeline_reddit,
                         args=(stories[sel[0]], voice, is_short), daemon=True).start()

    def on_close():
        pw.destroy()
        root.after(0, lambda: btn_generate.config(state=tk.NORMAL))

    pw = tk.Toplevel(root)
    pw.title(f"r/{subreddit}")
    pw.geometry("500x350")
    pw.configure(bg=BG_MAIN)
    pw.protocol("WM_DELETE_WINDOW", on_close)
    tk.Label(pw, text="Select a story:", font=("Segoe UI", 11, "bold"),
             bg=BG_MAIN, fg=FG_TEXT).pack(pady=10)
    listbox = tk.Listbox(pw, width=70, height=12, font=("Segoe UI", 10))
    listbox.pack(padx=15, pady=5)
    for s in stories:
        listbox.insert(tk.END, s['title'])
    tk.Button(pw, text="Generate Video", bg=ACCENT_SECONDARY, fg="white",
              font=("Segoe UI", 10, "bold"), cursor="hand2", command=on_select).pack(pady=10)


# ── GENERATE ─────────────────────────────────────────────────
def on_generate(event=None):
    btn_generate.config(state=tk.DISABLED)
    vtype = video_type_var.get()

    # Reddit Story mode
    if "Reddit" in vtype:
        sub = entry_topic.get().strip() or "AmItheAsshole"
        voice = combo_voice.get()
        is_short = var_format.get() == "Short"
        threading.Thread(target=open_reddit_picker,
                         args=(sub, voice, is_short), daemon=True).start()
        return

    method = combo_method.get()
    if method == "Manual":
        btn_generate.config(state=tk.NORMAL)
        win = tk.Toplevel(root)
        win.title("Manual Input")
        win.geometry("600x500")
        win.configure(bg=BG_MAIN)
        tk.Label(win, text="Paste your script:", font=("Segoe UI", 11, "bold"),
                 bg=BG_MAIN, fg=FG_TEXT).pack(pady=10)
        txt = tk.Text(win, wrap=tk.WORD, width=70, height=20, font=("Consolas", 10),
                      bg=BG_CARD, fg=ENTRY_FG, relief="solid", borderwidth=1, padx=10, pady=10)
        txt.pack(padx=15, pady=10, fill=tk.BOTH, expand=True)
        def go():
            content = txt.get("1.0", tk.END).strip()
            win.destroy()
            btn_generate.config(state=tk.DISABLED)
            status_label.config(text="Processing...")
            threading.Thread(target=process_content, args=(content,), daemon=True).start()
        tk.Button(win, text="GENERATE", bg=ACCENT_SECONDARY, fg="white",
                  font=("Segoe UI", 11, "bold"), relief="flat", cursor="hand2",
                  padx=20, pady=10, command=go).pack(pady=15)
    else:
        topic = entry_topic.get()
        if not topic:
            messagebox.showwarning("Warning", "Enter a topic!")
            btn_generate.config(state=tk.NORMAL); return
        status_label.config(text="AI generating script...")
        def pipeline():
            try:
                script = get_script(topic, entry_subtopics.get(), entry_minutes.get(), method)
                if script.startswith(("Error:", "AI Error:")):
                    root.after(0, lambda: messagebox.showerror("Error", script))
                    root.after(0, lambda: btn_generate.config(state=tk.NORMAL)); return
                with open("generated_script.txt", "w", encoding="utf-8") as f:
                    f.write(script)
                process_content(script)
            except Exception as e:
                root.after(0, lambda: messagebox.showerror("Error", f"Failed: {e}"))
                root.after(0, lambda: btn_generate.config(state=tk.NORMAL))
        threading.Thread(target=pipeline, daemon=True).start()


# ── UI UPDATES ───────────────────────────────────────────────
def on_video_type_change(*args):
    vtype = video_type_var.get()
    if "Gaming" in vtype:
        gaming_frame.pack(after=img_card, fill=tk.X, padx=15, pady=4)
    else:
        gaming_frame.pack_forget()
    update_scroll_region()

def on_clip_mode_change(*args):
    if clip_mode_var.get() == "Auto":
        entry_clips.config(state="normal")
        entry_clips.delete(0, tk.END)
        entry_clips.insert(0, str(calc_clips_needed(get_duration())))
        entry_clips.config(state="disabled")
        clip_hint_label.config(text=f"~{calc_clips_needed(get_duration())} clips")
    else:
        entry_clips.config(state="normal")
        clip_hint_label.config(text="Your count (loops if few)")

def on_duration_change(*args):
    if clip_mode_var.get() == "Auto":
        on_clip_mode_change()

def update_scroll_region(event=None):
    content.update_idletasks()
    canvas.configure(scrollregion=canvas.bbox("all"))

def on_mousewheel(event):
    canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")


# ── GUI ──────────────────────────────────────────────────────
def run():
    global root, canvas, content, btn_generate, btn_preview
    global combo_method, combo_voice, combo_img_source
    global entry_topic, entry_subtopics, entry_minutes, entry_interval
    global entry_custom_images, var_web_img, var_ai_img, var_format
    global status_label, video_type_var
    global entry_game, entry_clips, gaming_frame, img_card
    global clip_mode_var, clip_hint_label

    root = tk.Tk()
    root.title("Auto Content Engine (Local)")
    root.geometry("530x720")
    root.resizable(False, True)
    root.configure(bg=BG_MAIN)

    style = ttk.Style()
    style.theme_use('clam')
    style.configure('TCombobox', fieldbackground=BG_CARD, background=ENTRY_BG,
                     foreground=FG_TEXT, borderwidth=1)
    style.map('TCombobox', fieldbackground=[('readonly', BG_CARD)])

    fl = ("Segoe UI", 10, "bold")
    fe = ("Segoe UI", 10)
    fh = ("Segoe UI", 8)

    # Scrollable container
    outer = tk.Frame(root, bg=BG_MAIN)
    outer.pack(fill=tk.BOTH, expand=True)
    canvas = tk.Canvas(outer, bg=BG_MAIN, highlightthickness=0)
    scrollbar = tk.Scrollbar(outer, orient=tk.VERTICAL, command=canvas.yview)
    canvas.configure(yscrollcommand=scrollbar.set)
    scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    content = tk.Frame(canvas, bg=BG_MAIN)
    cw = canvas.create_window((0, 0), window=content, anchor="nw")
    canvas.bind("<Configure>", lambda e: canvas.itemconfig(cw, width=e.width))
    content.bind("<Configure>", update_scroll_region)
    canvas.bind_all("<MouseWheel>", on_mousewheel)

    # Header
    hdr = tk.Frame(content, bg=BG_MAIN)
    hdr.pack(fill=tk.X, pady=(10, 4))
    tk.Label(hdr, text="AUTO CONTENT ENGINE", font=("Segoe UI", 15, "bold"),
             bg=BG_MAIN, fg=FG_TEXT).pack()
    tk.Label(hdr, text="LOCAL — Full Pipeline", font=("Segoe UI", 9),
             bg=BG_MAIN, fg=ACCENT_TREND).pack()

    # ── PIPELINE ──
    c1 = tk.Frame(content, bg=BG_CARD, padx=15, pady=10,
                  highlightthickness=1, highlightbackground="#E5E7EB")
    c1.pack(fill=tk.X, padx=15, pady=4)
    tk.Label(c1, text="PIPELINE", font=("Segoe UI", 9, "bold"), bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    # Video type — includes Reddit if shorts available
    video_types = ["🖼️ Documentary", "🐱 Documentary + Cat", "🎮 Gaming Highlights"]
    if HAS_SHORTS:
        video_types.append("📖 Reddit Story")

    r1 = tk.Frame(c1, bg=BG_CARD)
    r1.pack(fill=tk.X, pady=2)
    tk.Label(r1, text="Type:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=10, anchor="w").pack(side=tk.LEFT)
    video_type_var = tk.StringVar(value=video_types[0])
    ttk.Combobox(r1, textvariable=video_type_var, state="readonly", font=fe,
                 values=video_types).pack(side=tk.LEFT, fill=tk.X, expand=True)
    video_type_var.trace_add("write", on_video_type_change)

    r2 = tk.Frame(c1, bg=BG_CARD)
    r2.pack(fill=tk.X, pady=2)
    tk.Label(r2, text="Script:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=10, anchor="w").pack(side=tk.LEFT)
    combo_method = ttk.Combobox(r2, values=["Manual", "Gemini"], state="readonly", font=fe)
    combo_method.set("Gemini")
    combo_method.pack(side=tk.LEFT, fill=tk.X, expand=True)

    r3 = tk.Frame(c1, bg=BG_CARD)
    r3.pack(fill=tk.X, pady=2)
    tk.Label(r3, text="Duration:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=10, anchor="w").pack(side=tk.LEFT)
    entry_minutes = tk.Entry(r3, font=fe, bg=ENTRY_BG, fg=ENTRY_FG, relief="flat",
                              highlightthickness=1, highlightbackground="#E5E7EB",
                              highlightcolor=ACCENT_PRIMARY, width=6)
    entry_minutes.insert(0, "10")
    entry_minutes.pack(side=tk.LEFT)
    tk.Label(r3, text="min", font=fh, bg=BG_CARD, fg=FG_DIM).pack(side=tk.LEFT, padx=5)
    entry_minutes.bind("<KeyRelease>", on_duration_change)

    # Format (Short/Long)
    r4 = tk.Frame(c1, bg=BG_CARD)
    r4.pack(fill=tk.X, pady=2)
    tk.Label(r4, text="Format:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=10, anchor="w").pack(side=tk.LEFT)
    var_format = tk.StringVar(value="Long")
    tk.Radiobutton(r4, text="YouTube 16:9", variable=var_format, value="Long",
                   bg=BG_CARD, font=fh).pack(side=tk.LEFT)
    tk.Radiobutton(r4, text="TikTok 9:16", variable=var_format, value="Short",
                   bg=BG_CARD, font=fh).pack(side=tk.LEFT, padx=10)

    # ── CONTENT ──
    c2 = tk.Frame(content, bg=BG_CARD, padx=15, pady=10,
                  highlightthickness=1, highlightbackground="#E5E7EB")
    c2.pack(fill=tk.X, padx=15, pady=4)
    tk.Label(c2, text="CONTENT", font=("Segoe UI", 9, "bold"), bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    tk.Label(c2, text="Topic / Subreddit:", font=fl, bg=BG_CARD, fg=FG_TEXT).pack(anchor="w")
    tf = tk.Frame(c2, bg=BG_CARD)
    tf.pack(fill=tk.X, pady=(2, 6))
    entry_topic = tk.Entry(tf, font=fe, bg=ENTRY_BG, fg=ENTRY_FG, relief="flat",
                            highlightthickness=1, highlightbackground="#E5E7EB",
                            highlightcolor=ACCENT_PRIMARY)
    entry_topic.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8))
    tk.Button(tf, text="🔥 Trends", font=("Segoe UI", 9, "bold"),
              bg=ACCENT_TREND, fg="white", activebackground=ACCENT_TREND_ACTIVE,
              cursor="hand2", relief="flat", padx=8,
              command=on_find_trending).pack(side=tk.RIGHT)

    tk.Label(c2, text="Subtopics:", font=fl, bg=BG_CARD, fg=FG_TEXT).pack(anchor="w")
    entry_subtopics = tk.Entry(c2, font=fe, bg=ENTRY_BG, fg=ENTRY_FG, relief="flat",
                                highlightthickness=1, highlightbackground="#E5E7EB",
                                highlightcolor=ACCENT_PRIMARY)
    entry_subtopics.pack(fill=tk.X, pady=(2, 6))

    ri = tk.Frame(c2, bg=BG_CARD)
    ri.pack(fill=tk.X, pady=2)
    tk.Label(ri, text="Scene interval:", font=fl, bg=BG_CARD, fg=FG_TEXT).pack(side=tk.LEFT)
    entry_interval = tk.Entry(ri, font=fe, bg=ENTRY_BG, fg=ENTRY_FG, relief="flat",
                               highlightthickness=1, highlightbackground="#E5E7EB",
                               highlightcolor=ACCENT_PRIMARY, width=5)
    entry_interval.insert(0, "8")
    entry_interval.pack(side=tk.LEFT, padx=5)
    tk.Label(ri, text="sec/img", font=fh, bg=BG_CARD, fg=FG_DIM).pack(side=tk.LEFT)

    # ── IMAGES ──
    img_card = tk.Frame(content, bg=BG_CARD, padx=15, pady=10,
                        highlightthickness=1, highlightbackground="#E5E7EB")
    img_card.pack(fill=tk.X, padx=15, pady=4)
    tk.Label(img_card, text="IMAGES", font=("Segoe UI", 9, "bold"), bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    rs = tk.Frame(img_card, bg=BG_CARD)
    rs.pack(fill=tk.X, pady=2)
    tk.Label(rs, text="Source:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=10, anchor="w").pack(side=tk.LEFT)
    combo_img_source = ttk.Combobox(rs, values=["DDG (Ours)", "Bing+Pexels (Git)"],
                                     state="readonly", font=fe)
    combo_img_source.set("DDG (Ours)")
    combo_img_source.pack(side=tk.LEFT, fill=tk.X, expand=True)

    tk.Label(img_card, text="Custom Keywords:", font=fl, bg=BG_CARD, fg=FG_TEXT).pack(anchor="w", pady=(4, 0))
    entry_custom_images = tk.Entry(img_card, font=fe, bg=ENTRY_BG, fg=ENTRY_FG, relief="flat",
                                    highlightthickness=1, highlightbackground="#E5E7EB",
                                    highlightcolor=ACCENT_PRIMARY)
    entry_custom_images.pack(fill=tk.X, pady=(2, 4))

    chk = tk.Frame(img_card, bg=BG_CARD)
    chk.pack(fill=tk.X)
    var_web_img = tk.BooleanVar(value=True)
    var_ai_img = tk.BooleanVar(value=True)
    tk.Checkbutton(chk, text="Web Scraping", variable=var_web_img, font=fh,
                   bg=BG_CARD, fg=FG_TEXT, selectcolor=BG_CARD).pack(side=tk.LEFT)
    tk.Checkbutton(chk, text="AI Generated", variable=var_ai_img, font=fh,
                   bg=BG_CARD, fg=FG_TEXT, selectcolor=BG_CARD).pack(side=tk.LEFT, padx=10)

    # ── GAMING (hidden) ──
    gaming_frame = tk.Frame(content, bg=BG_CARD, padx=15, pady=10,
                            highlightthickness=1, highlightbackground="#E5E7EB")
    tk.Label(gaming_frame, text="🎮 GAMING", font=("Segoe UI", 9, "bold"),
             bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    gf1 = tk.Frame(gaming_frame, bg=BG_CARD)
    gf1.pack(fill=tk.X, pady=2)
    tk.Label(gf1, text="Game:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=8, anchor="w").pack(side=tk.LEFT)
    entry_game = tk.Entry(gf1, font=fe, bg=ENTRY_BG, fg=ENTRY_FG, relief="flat",
                           highlightthickness=1, highlightbackground="#E5E7EB",
                           highlightcolor=ACCENT_PRIMARY)
    entry_game.insert(0, "CS2")
    entry_game.pack(side=tk.LEFT, fill=tk.X, expand=True)

    gf2 = tk.Frame(gaming_frame, bg=BG_CARD)
    gf2.pack(fill=tk.X, pady=2)
    tk.Label(gf2, text="Clips:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=8, anchor="w").pack(side=tk.LEFT)
    clip_mode_var = tk.StringVar(value="Auto")
    ttk.Combobox(gf2, textvariable=clip_mode_var, state="readonly", font=fe, width=7,
                 values=["Auto", "Manual"]).pack(side=tk.LEFT, padx=(0, 5))
    entry_clips = tk.Entry(gf2, width=5, font=fe, state="disabled", bg=ENTRY_BG,
                            fg=ENTRY_FG, relief="flat")
    entry_clips.pack(side=tk.LEFT)
    clip_mode_var.trace_add("write", on_clip_mode_change)
    clip_hint_label = tk.Label(gaming_frame, text="Auto from duration", font=fh,
                                bg=BG_CARD, fg=FG_DIM)
    clip_hint_label.pack(anchor="w")
    tk.Label(gaming_frame, text="Clips muted — only Kokoro voice",
             font=fh, bg=BG_CARD, fg=ACCENT_TREND).pack(anchor="w")
    on_clip_mode_change()

    # ── VOICE ──
    c4 = tk.Frame(content, bg=BG_CARD, padx=15, pady=10,
                  highlightthickness=1, highlightbackground="#E5E7EB")
    c4.pack(fill=tk.X, padx=15, pady=4)
    tk.Label(c4, text="VOICE", font=("Segoe UI", 9, "bold"), bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    rv = tk.Frame(c4, bg=BG_CARD)
    rv.pack(fill=tk.X, pady=2)
    tk.Label(rv, text="Preset:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=8, anchor="w").pack(side=tk.LEFT)
    combo_voice = ttk.Combobox(rv, values=list(VOICE_PRESETS.keys()),
                                state="readonly", font=fe)
    combo_voice.set(list(VOICE_PRESETS.keys())[0])
    combo_voice.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
    btn_preview = tk.Button(rv, text="▶ Preview", font=("Segoe UI", 9, "bold"),
                             bg="#6366F1", fg="white", activebackground="#4F46E5",
                             cursor="hand2", relief="flat", padx=8,
                             command=preview_voice)
    btn_preview.pack(side=tk.RIGHT)

    # ── GENERATE ──
    btn_generate = tk.Button(content, text="Generate Video", font=("Segoe UI", 12, "bold"),
                              bg=ACCENT_PRIMARY, fg="white", activebackground=ACCENT_PRIMARY_ACTIVE,
                              activeforeground="white", relief="flat", cursor="hand2", pady=10,
                              command=on_generate)
    btn_generate.pack(fill=tk.X, padx=15, pady=(10, 5))

    status_label = tk.Label(content, text="Ready", font=("Segoe UI", 10),
                             bg=BG_MAIN, fg=FG_DIM)
    status_label.pack(pady=(3, 5))

    tk.Label(content, text="Trends → Gemini → DDG/Bing/Medal → Kokoro → Video",
             font=fh, bg=BG_MAIN, fg=FG_DIM).pack(pady=(0, 10))

    root.bind('<Return>', on_generate)
    root.mainloop()

if __name__ == "__main__":
    run()
