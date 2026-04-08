"""
main_shorts_local.py — GUI pt Shorts/TikTok:
  Reddit stories + Medal.tv gaming clips + Kokoro TTS
  Tot din GUI, zero CLI.
NU se pune pe git (e in .gitignore).
"""
import tkinter as tk
from tkinter import messagebox, ttk
import os
import subprocess
import threading
import tempfile
import random

from voice_gen.kokoro_narration import generate_voice, VOICE_PRESETS
from voice_gen.subtitles import generate_srt_from_chunks
from shorts_gen.reddit import get_reddit_stories, format_story_for_tts
from videoclips_gen.medal_fetcher import fetch_gaming_clips

BG_MAIN = "#0f0f1a"
BG_CARD = "#1a1a2e"
FG_TEXT = "#e0e0e0"
FG_DIM = "#888899"
ACCENT = "#e94560"
ACCENT_ACTIVE = "#c73050"
ACCENT2 = "#533483"
ACCENT2_ACTIVE = "#6a45a0"
ENTRY_BG = "#16213e"
ENTRY_FG = "#e0e0e0"

PREVIEW_TEXT = "The universe is vast and full of mysteries waiting to be discovered."


def cleanup():
    for f in ["short_audio.wav", "short_subs.srt", "final_short.mp4",
              "temp_short_nosubs.mp4"]:
        if os.path.exists(f):
            os.remove(f)


def get_video_duration(path):
    try:
        cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=noprint_wrappers=1:nokey=1", path]
        return float(subprocess.run(cmd, capture_output=True, text=True).stdout.strip())
    except Exception:
        return 30.0


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
            try: os.remove(tmp)
            except: pass

    threading.Thread(target=do_preview, daemon=True).start()


# ── SHORT VIDEO ASSEMBLER ────────────────────────────────────
def create_short_video(clip_paths, audio_path, srt_path, output="final_short.mp4", is_vertical=True):
    """
    Asambleaza short: Medal clips (muted, cropped vertical) + Kokoro voice + subtitles.
    Foloseste ffmpeg direct pt crop + subtitle burn.
    """
    from moviepy import AudioFileClip, VideoFileClip, concatenate_videoclips

    print(f"[Short] Assembling {len(clip_paths)} clips...")
    voice = AudioFileClip(audio_path)
    total_duration = voice.duration

    # Load & mute clips
    clips = []
    total_clip_dur = 0
    for path in clip_paths:
        try:
            clip = VideoFileClip(path).without_audio()
            clips.append(clip)
            total_clip_dur += clip.duration
        except Exception as e:
            print(f"  [Skip] {path}: {e}")

    if not clips:
        return False, "No valid clips"

    # Loop if needed
    if total_clip_dur < total_duration:
        loops = int(total_duration / total_clip_dur) + 1
        clips = clips * loops

    # Concatenate & trim
    video = concatenate_videoclips(clips, method="compose")
    video = video.subclipped(0, min(total_duration, video.duration))
    video = video.with_audio(voice)

    # Render temp (no subs yet)
    temp_path = "temp_short_nosubs.mp4"
    print("[Short] Rendering base video...")
    video.write_videofile(temp_path, fps=30, codec="libx264", audio_codec="aac",
                          bitrate="8000k", threads=4)

    # Crop + burn subtitles with ffmpeg
    srt_abs = os.path.abspath(srt_path).replace("\\", "/").replace(":", "\\:")

    if is_vertical:
        # 9:16 vertical crop + big centered subtitles
        vf = (f"crop=ih*(9/16):ih,scale=1080:1920,"
              f"subtitles='{srt_abs}':force_style='"
              f"FontSize=24,FontName=Arial,PrimaryColour=&H00FFFFFF,"
              f"OutlineColour=&H00000000,BorderStyle=3,Outline=2,"
              f"Shadow=0,Alignment=5,MarginV=120'")
    else:
        # 16:9 (YouTube shorts landscape)
        vf = (f"scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,"
              f"subtitles='{srt_abs}':force_style='"
              f"FontSize=20,FontName=Arial,PrimaryColour=&H00FFFFFF,"
              f"OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0'")

    cmd = [
        "ffmpeg", "-y",
        "-i", temp_path,
        "-vf", vf,
        "-c:a", "copy",
        "-b:v", "8000k",
        output
    ]

    print("[Short] Cropping & burning subtitles...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    # Cleanup temp
    if os.path.exists(temp_path):
        os.remove(temp_path)

    if result.returncode == 0:
        print(f"[Short] DONE! → {output}")
        return True, output
    else:
        print(f"[Short] ffmpeg error: {result.stderr[:200]}")
        return False, "FFmpeg failed"


# ── PIPELINE ─────────────────────────────────────────────────
def run_pipeline(story, game_name, voice_preset, is_vertical):
    try:
        cleanup()
        script = format_story_for_tts(story)

        # 1. Voice
        root.after(0, lambda: status_label.config(text="1/4: Generating voice..."))
        audio_path, timings = generate_voice(script, output_path="short_audio.wav",
                                              preset=voice_preset)
        if not audio_path:
            root.after(0, lambda: messagebox.showerror("Error", "Voice generation failed!"))
            return

        # 2. Subtitles
        root.after(0, lambda: status_label.config(text="2/4: Subtitles..."))
        srt_path = generate_srt_from_chunks(timings, output_srt="short_subs.srt")

        # 3. Medal clips
        audio_dur = get_video_duration(audio_path)
        num_clips = max(2, int(audio_dur / 15) + 2)
        root.after(0, lambda: status_label.config(
            text=f"3/4: Downloading {num_clips} {game_name} clips..."))
        clip_paths = fetch_gaming_clips(game_name, num_clips)

        if not clip_paths:
            root.after(0, lambda: messagebox.showerror("Error",
                f"No clips for '{game_name}'.\nCheck MEDAL_GAME_KEY_* in .env"))
            return

        # 4. Assemble
        root.after(0, lambda: status_label.config(text="4/4: Rendering short..."))
        fmt = "vertical" if is_vertical else "landscape"
        out = "final_short.mp4"
        success, msg = create_short_video(clip_paths, audio_path, srt_path,
                                           output=out, is_vertical=is_vertical)

        if success:
            root.after(0, lambda: status_label.config(text="Done!"))
            root.after(0, lambda: messagebox.showinfo("Success",
                f"Short video done!\nDuration: {audio_dur:.0f}s\nFormat: {fmt}\nOutput: {out}"))
        else:
            root.after(0, lambda: messagebox.showerror("Error", msg))
            root.after(0, lambda: status_label.config(text="Failed"))

    except Exception as e:
        root.after(0, lambda: messagebox.showerror("Error", f"Pipeline failed: {e}"))
        root.after(0, lambda: status_label.config(text="Error"))
    finally:
        root.after(0, lambda: btn_generate.config(state=tk.NORMAL))


# ── STORY PICKER ─────────────────────────────────────────────
def fetch_and_pick_stories():
    btn_generate.config(state=tk.DISABLED)
    subreddit = entry_subreddit.get().strip() or "AmItheAsshole"
    game = entry_game.get().strip()
    voice = combo_voice.get()
    is_vertical = var_format.get() == "Vertical"

    if not game:
        messagebox.showwarning("Warning", "Enter a game name!")
        btn_generate.config(state=tk.NORMAL)
        return

    def fetch():
        root.after(0, lambda: status_label.config(text=f"Fetching r/{subreddit}..."))
        stories = get_reddit_stories(subreddit=subreddit, limit=10)

        if not stories:
            root.after(0, lambda: messagebox.showerror("Error",
                f"No stories in r/{subreddit}"))
            root.after(0, lambda: btn_generate.config(state=tk.NORMAL))
            root.after(0, lambda: status_label.config(text="Ready"))
            return

        root.after(0, lambda: show_story_picker(stories, game, voice, is_vertical))
        root.after(0, lambda: status_label.config(text="Pick a story"))

    threading.Thread(target=fetch, daemon=True).start()


def show_story_picker(stories, game, voice, is_vertical):
    win = tk.Toplevel(root)
    win.title("Pick a Reddit Story")
    win.geometry("550x450")
    win.resizable(False, False)
    win.configure(bg=BG_MAIN)

    tk.Label(win, text="Pick a story to narrate:", font=("Segoe UI", 12, "bold"),
             bg=BG_MAIN, fg=FG_TEXT).pack(pady=(15, 5))
    tk.Label(win, text=f"Game: {game} | Voice: {voice.split('-')[0].strip()}",
             font=("Segoe UI", 9), bg=BG_MAIN, fg=FG_DIM).pack(pady=(0, 10))

    # Listbox with scrollbar
    frame = tk.Frame(win, bg=BG_MAIN)
    frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=5)

    scrollbar = tk.Scrollbar(frame)
    scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    listbox = tk.Listbox(frame, width=70, height=15, font=("Segoe UI", 10),
                          bg=BG_CARD, fg=FG_TEXT, selectbackground=ACCENT,
                          selectforeground="white", borderwidth=0,
                          yscrollcommand=scrollbar.set)
    listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    scrollbar.config(command=listbox.yview)

    for s in stories:
        # Show title + word count
        words = len(s['body'].split())
        est_sec = int(words / 2.5)  # ~150 words/min
        listbox.insert(tk.END, f"[{est_sec}s] {s['title'][:70]}")

    def on_select():
        sel = listbox.curselection()
        if not sel:
            messagebox.showwarning("Warning", "Pick a story!")
            return
        story = stories[sel[0]]
        win.destroy()
        root.after(0, lambda: status_label.config(text="Processing..."))
        threading.Thread(target=run_pipeline,
                         args=(story, game, voice, is_vertical), daemon=True).start()

    def on_close():
        win.destroy()
        btn_generate.config(state=tk.NORMAL)
        status_label.config(text="Ready")

    win.protocol("WM_DELETE_WINDOW", on_close)

    tk.Button(win, text="Generate Short Video", font=("Segoe UI", 11, "bold"),
              bg=ACCENT, fg="white", activebackground=ACCENT_ACTIVE,
              cursor="hand2", relief="flat", padx=20, pady=8,
              command=on_select).pack(pady=10)


# ── POPULAR SUBREDDITS ───────────────────────────────────────
POPULAR_SUBS = [
    "AmItheAsshole", "tifu", "confession", "relationship_advice",
    "MaliciousCompliance", "pettyrevenge", "ProRevenge", "entitledparents",
    "TrueOffMyChest", "nosleep", "LetsNotMeet", "UnresolvedMysteries",
    "askreddit", "todayilearned", "Showerthoughts"
]

def show_sub_picker():
    win = tk.Toplevel(root)
    win.title("Popular Subreddits")
    win.geometry("300x400")
    win.configure(bg=BG_MAIN)
    tk.Label(win, text="Pick a subreddit:", font=("Segoe UI", 11, "bold"),
             bg=BG_MAIN, fg=FG_TEXT).pack(pady=(10, 5))

    for sub in POPULAR_SUBS:
        tk.Button(win, text=f"r/{sub}", font=("Segoe UI", 10), anchor="w",
                  padx=15, pady=3, bg=BG_CARD, fg=FG_TEXT,
                  activebackground=ACCENT, activeforeground="white",
                  cursor="hand2", width=30, relief="flat",
                  command=lambda s=sub: pick_sub(s, win)).pack(pady=1, padx=15)

def pick_sub(sub, win):
    win.destroy()
    entry_subreddit.delete(0, tk.END)
    entry_subreddit.insert(0, sub)


# ── GUI ──────────────────────────────────────────────────────
def run():
    global root, btn_generate, btn_preview, combo_voice
    global entry_subreddit, entry_game, var_format, status_label

    root = tk.Tk()
    root.title("Shorts Generator (Local)")
    root.geometry("480x680")
    root.resizable(False, False)
    root.configure(bg=BG_MAIN)

    style = ttk.Style()
    style.theme_use('clam')
    style.configure('TCombobox', fieldbackground=BG_CARD, background=ENTRY_BG,
                     foreground=FG_TEXT, borderwidth=0)
    style.map('TCombobox', fieldbackground=[('readonly', BG_CARD)])

    fl = ("Segoe UI", 10, "bold")
    fe = ("Segoe UI", 10)
    fh = ("Segoe UI", 8)

    # Header
    hdr = tk.Frame(root, bg=BG_MAIN)
    hdr.pack(fill=tk.X, pady=(15, 8))
    tk.Label(hdr, text="⚡ SHORTS GENERATOR", font=("Segoe UI", 16, "bold"),
             bg=BG_MAIN, fg=FG_TEXT).pack()
    tk.Label(hdr, text="Reddit Stories + Medal Clips + Kokoro TTS",
             font=("Segoe UI", 9), bg=BG_MAIN, fg=ACCENT).pack()

    # ── STORY SOURCE ──
    c1 = tk.Frame(root, bg=BG_CARD, padx=15, pady=12,
                  highlightthickness=1, highlightbackground="#2a2a4a")
    c1.pack(fill=tk.X, padx=15, pady=5)
    tk.Label(c1, text="📖 STORY", font=("Segoe UI", 9, "bold"),
             bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    r1 = tk.Frame(c1, bg=BG_CARD)
    r1.pack(fill=tk.X, pady=2)
    tk.Label(r1, text="Subreddit:", font=fl, bg=BG_CARD, fg=FG_TEXT).pack(side=tk.LEFT)
    entry_subreddit = tk.Entry(r1, font=fe, bg=ENTRY_BG, fg=ENTRY_FG, relief="flat",
                                insertbackground=FG_TEXT, highlightthickness=1,
                                highlightbackground="#2a2a4a", highlightcolor=ACCENT)
    entry_subreddit.insert(0, "AmItheAsshole")
    entry_subreddit.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(8, 5))
    tk.Button(r1, text="📋", font=("Segoe UI", 10), bg=ACCENT2, fg="white",
              activebackground=ACCENT2_ACTIVE, cursor="hand2", relief="flat",
              padx=6, command=show_sub_picker).pack(side=tk.RIGHT)

    tk.Label(c1, text="Popular: AITA, tifu, nosleep, ProRevenge, confession...",
             font=fh, bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(2, 0))

    # ── GAME / BACKGROUND ──
    c2 = tk.Frame(root, bg=BG_CARD, padx=15, pady=12,
                  highlightthickness=1, highlightbackground="#2a2a4a")
    c2.pack(fill=tk.X, padx=15, pady=5)
    tk.Label(c2, text="🎮 BACKGROUND", font=("Segoe UI", 9, "bold"),
             bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    r2 = tk.Frame(c2, bg=BG_CARD)
    r2.pack(fill=tk.X, pady=2)
    tk.Label(r2, text="Game:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=8, anchor="w").pack(side=tk.LEFT)
    entry_game = tk.Entry(r2, font=fe, bg=ENTRY_BG, fg=ENTRY_FG, relief="flat",
                           insertbackground=FG_TEXT, highlightthickness=1,
                           highlightbackground="#2a2a4a", highlightcolor=ACCENT)
    entry_game.insert(0, "Minecraft")
    entry_game.pack(side=tk.LEFT, fill=tk.X, expand=True)

    tk.Label(c2, text="Medal.tv clips — auto-downloaded, muted, looped to fit",
             font=fh, bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(4, 0))

    # ── FORMAT ──
    c3 = tk.Frame(root, bg=BG_CARD, padx=15, pady=12,
                  highlightthickness=1, highlightbackground="#2a2a4a")
    c3.pack(fill=tk.X, padx=15, pady=5)
    tk.Label(c3, text="📐 FORMAT", font=("Segoe UI", 9, "bold"),
             bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    fmt_frame = tk.Frame(c3, bg=BG_CARD)
    fmt_frame.pack(fill=tk.X)
    var_format = tk.StringVar(value="Vertical")
    tk.Radiobutton(fmt_frame, text="TikTok / Shorts (9:16)", variable=var_format,
                   value="Vertical", bg=BG_CARD, fg=FG_TEXT, selectcolor=BG_CARD,
                   activebackground=BG_CARD, font=fe).pack(side=tk.LEFT)
    tk.Radiobutton(fmt_frame, text="YouTube (16:9)", variable=var_format,
                   value="Landscape", bg=BG_CARD, fg=FG_TEXT, selectcolor=BG_CARD,
                   activebackground=BG_CARD, font=fe).pack(side=tk.LEFT, padx=15)

    # ── VOICE ──
    c4 = tk.Frame(root, bg=BG_CARD, padx=15, pady=12,
                  highlightthickness=1, highlightbackground="#2a2a4a")
    c4.pack(fill=tk.X, padx=15, pady=5)
    tk.Label(c4, text="🎙️ VOICE", font=("Segoe UI", 9, "bold"),
             bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    rv = tk.Frame(c4, bg=BG_CARD)
    rv.pack(fill=tk.X, pady=2)
    combo_voice = ttk.Combobox(rv, values=list(VOICE_PRESETS.keys()),
                                state="readonly", font=fe)
    combo_voice.set(list(VOICE_PRESETS.keys())[0])
    combo_voice.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
    btn_preview = tk.Button(rv, text="▶ Preview", font=("Segoe UI", 9, "bold"),
                             bg=ACCENT2, fg="white", activebackground=ACCENT2_ACTIVE,
                             cursor="hand2", relief="flat", padx=8,
                             command=preview_voice)
    btn_preview.pack(side=tk.RIGHT)

    # ── GENERATE ──
    btn_generate = tk.Button(root, text="Fetch Stories & Generate",
                              font=("Segoe UI", 13, "bold"),
                              bg=ACCENT, fg="white", activebackground=ACCENT_ACTIVE,
                              activeforeground="white", relief="flat", cursor="hand2",
                              pady=12, command=fetch_and_pick_stories)
    btn_generate.pack(fill=tk.X, padx=15, pady=(15, 5))

    status_label = tk.Label(root, text="Ready", font=("Segoe UI", 10),
                             bg=BG_MAIN, fg=FG_DIM)
    status_label.pack(pady=5)

    tk.Label(root, text="Reddit → Kokoro TTS → Medal Clips → FFmpeg → Short",
             font=fh, bg=BG_MAIN, fg=FG_DIM).pack(side=tk.BOTTOM, pady=10)

    root.mainloop()

if __name__ == "__main__":
    run()
