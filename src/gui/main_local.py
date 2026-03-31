"""
main_local.py — GUI local cu toate feature-urile + scrollable.
NU se pune pe git (e in .gitignore).
"""
import tkinter as tk
from tkinter import messagebox, ttk
import os
import threading
from script_gen.generator import get_script
from voice_gen.kokoro_narration import generate_voice, VOICE_PRESETS
from voice_gen.subtitles import generate_srt_from_chunks
from video_edit.editor import create_video
from video_edit.downloader import prepare_assets
from trend_finder.trends import get_trending, get_related
from image_gen.image_fetcher import fetch_images
from image_gen.talking_cat import generate_cat_video
from videoclips_gen.medal_fetcher import fetch_gaming_clips

AVG_CLIP_SEC = 15

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
              "final_video.mp4", "subtitles.srt", "temp_no_subs.mp4", "cat_video.mp4"]:
        if os.path.exists(f):
            os.remove(f)

def get_wav_duration(path):
    import soundfile as sf
    return sf.info(path).duration

def calc_clips_needed(duration_min):
    total_sec = duration_min * 60
    return max(3, min(20, int(total_sec / AVG_CLIP_SEC) + 2))


def create_gaming_video(clip_paths, audio_path, srt_path=None, output="final_video.mp4"):
    from moviepy import AudioFileClip, VideoFileClip, concatenate_videoclips

    print(f"[Gaming] Assembling {len(clip_paths)} clips (muted) + Kokoro narration...")
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
        raise RuntimeError("No valid gaming clips to assemble")

    if total_clip_dur < total_duration:
        loops = int(total_duration / total_clip_dur) + 1
        clips = clips * loops

    video = concatenate_videoclips(clips, method="compose")
    video = video.subclipped(0, min(total_duration, video.duration))
    video = video.with_audio(voice)

    video.write_videofile(output, fps=24, codec="libx264", audio_codec="aac",
                          bitrate="8000k", threads=4)
    print(f"[Gaming] DONE! {output}")
    return output


def fetch_images_smart(text, num_images, source, custom_keywords, use_web, use_ai):
    if source == "Bing+Pexels (Git)":
        count = prepare_assets(text, use_web=use_web, use_ai=use_ai,
                               custom_keywords=custom_keywords)
        pool = "assets/curated_pool"
        return [os.path.join(pool, f) for f in sorted(os.listdir(pool))
                if f.lower().endswith(('jpg', 'png', 'jpeg', 'webp'))]
    else:
        return fetch_images(text, num_images)


def pipeline_slideshow(text, interval, with_cat=False):
    cleanup_old_assets()
    voice_preset = combo_voice.get()
    img_source = combo_img_source.get()
    custom_kw = entry_custom_images.get().strip()
    do_web = var_web_img.get()
    do_ai = var_ai_img.get()

    dur_est = max(1, int(entry_minutes.get() or "10"))
    n_img = max(2, min(20, int(dur_est * 60 / interval) + 1))

    if img_source == "Bing+Pexels (Git)" and (do_web or do_ai):
        root.after(0, lambda: status_label.config(text="1/4: Fetching images (Bing+Pexels)..."))
        fetch_images_smart(text, n_img, img_source, custom_kw, do_web, do_ai)

    root.after(0, lambda: status_label.config(text="2/4: Generating voice..."))
    audio_path, timings = generate_voice(text, output_path="video_final.wav", preset=voice_preset)
    if not audio_path:
        root.after(0, lambda: messagebox.showerror("Error", "Audio failed!")); return

    root.after(0, lambda: status_label.config(text="2/4: Subtitles..."))
    srt = generate_srt_from_chunks(timings) if timings else None

    if img_source == "DDG (Ours)":
        dur = get_wav_duration(audio_path)
        n_img = max(2, min(20, int(dur / interval) + 1))
        root.after(0, lambda: status_label.config(text=f"3/4: Fetching {n_img} images (DDG)..."))
        imgs = fetch_images(text, n_img)
        if not imgs:
            root.after(0, lambda: messagebox.showerror("Error", "No images!")); return

    root.after(0, lambda: status_label.config(text="4/4: Rendering video..."))
    create_video(srt_path=srt)

    if with_cat:
        root.after(0, lambda: status_label.config(text="Bonus: Talking cat..."))
        generate_cat_video(audio_path, "cat_video.mp4")

    root.after(0, lambda: status_label.config(text="Done!"))
    msg = "Done!\nOutput: final_video.mp4"
    if with_cat: msg += "\nCat: cat_video.mp4"
    root.after(0, lambda: messagebox.showinfo("Success", msg))


def pipeline_gaming(text, game_name, num_clips):
    cleanup_old_assets()
    voice_preset = combo_voice.get()

    root.after(0, lambda: status_label.config(text="1/3: Generating voice..."))
    audio_path, timings = generate_voice(text, output_path="video_final.wav", preset=voice_preset)
    if not audio_path:
        root.after(0, lambda: messagebox.showerror("Error", "Audio failed!")); return

    root.after(0, lambda: status_label.config(text="2/3: Subtitles..."))
    srt = generate_srt_from_chunks(timings) if timings else None

    root.after(0, lambda: status_label.config(text=f"2/3: Downloading ~{num_clips} {game_name} clips..."))
    clip_paths = fetch_gaming_clips(game_name, num_clips)
    if not clip_paths:
        root.after(0, lambda: messagebox.showerror("Error",
            f"No clips for '{game_name}'.\nCheck MEDAL_GAME_KEY_* in .env"))
        return

    root.after(0, lambda: status_label.config(text="3/3: Assembling gaming video..."))
    create_gaming_video(clip_paths, audio_path, srt)

    root.after(0, lambda: status_label.config(text="Done!"))
    root.after(0, lambda: messagebox.showinfo("Success", "Gaming video done!\nOutput: final_video.mp4"))


def process_content(text):
    if not text.strip():
        root.after(0, lambda: messagebox.showwarning("Warning", "Script is empty!"))
        return
    try:
        vtype = video_type_var.get()
        interval = max(3, min(60, int(entry_interval.get() or "8")))

        if vtype == "🎮 Gaming Highlights":
            game = entry_game.get().strip()
            if not game:
                root.after(0, lambda: messagebox.showwarning("Warning", "Enter a game name!"))
                return
            if clip_mode_var.get() == "Auto":
                dur = max(1, int(entry_minutes.get() or "10"))
                n_clips = calc_clips_needed(dur)
            else:
                n_clips = max(2, min(20, int(entry_clips.get() or "5")))
            pipeline_gaming(text, game, n_clips)
        elif vtype == "🐱 Slideshow + Cat":
            pipeline_slideshow(text, interval, with_cat=True)
        else:
            pipeline_slideshow(text, interval, with_cat=False)
    except Exception as e:
        err = str(e)
        root.after(0, lambda: status_label.config(text="Error"))
        root.after(0, lambda: messagebox.showerror("Error", f"Failed: {err}"))


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
        rss = results.get("rss", [])
        pytr = results.get("pytrends", [])
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
    if rss:
        tk.Label(win, text="🔥 Google Trends", font=("Segoe UI", 10, "bold"),
                 bg=BG_MAIN, fg=ACCENT_TREND).pack(anchor="w", padx=20, pady=(5, 3))
        for t in rss:
            tk.Button(win, text=t, font=("Segoe UI", 11), anchor="w", padx=15, pady=5,
                      bg=BG_CARD, fg=FG_TEXT, activebackground=ENTRY_BG, cursor="hand2",
                      width=40, relief="flat", borderwidth=1,
                      command=lambda tp=t: _pick(tp, original, win)).pack(pady=2, padx=20)
    if pytr:
        tk.Label(win, text="📊 Related Searches", font=("Segoe UI", 10, "bold"),
                 bg=BG_MAIN, fg=ACCENT_PRIMARY).pack(anchor="w", padx=20, pady=(12, 3))
        for t in pytr:
            tk.Button(win, text=t, font=("Segoe UI", 11), anchor="w", padx=15, pady=5,
                      bg=BG_CARD, fg=FG_TEXT, activebackground=ENTRY_BG, cursor="hand2",
                      width=40, relief="flat", borderwidth=1,
                      command=lambda tp=t: _pick(tp, original, win)).pack(pady=2, padx=20)

def _pick(topic, original, win):
    win.destroy()
    entry_topic.delete(0, tk.END)
    entry_topic.insert(0, topic)
    entry_subtopics.delete(0, tk.END)
    if original: entry_subtopics.insert(0, original)
    combo_method.set("Gemini")
    status_label.config(text=f"Topic: {topic}")

def on_generate(event=None):
    method = combo_method.get()
    if method == "Manual":
        win = tk.Toplevel(root)
        win.title("Manual Input")
        win.geometry("600x500")
        win.configure(bg=BG_MAIN)
        tk.Label(win, text="Paste your English script:", font=("Segoe UI", 11, "bold"),
                 bg=BG_MAIN, fg=FG_TEXT).pack(pady=10)
        txt = tk.Text(win, wrap=tk.WORD, width=70, height=20, font=("Consolas", 10),
                      bg=BG_CARD, fg=ENTRY_FG, relief="solid", borderwidth=1, padx=10, pady=10)
        txt.pack(padx=15, pady=10, fill=tk.BOTH, expand=True)
        def go():
            content = txt.get("1.0", tk.END).strip()
            win.destroy()
            status_label.config(text="Processing...")
            threading.Thread(target=process_content, args=(content,), daemon=True).start()
        tk.Button(win, text="GENERATE VIDEO", bg=ACCENT_SECONDARY, fg="white",
                  font=("Segoe UI", 11, "bold"), relief="flat", cursor="hand2",
                  padx=20, pady=10, command=go).pack(pady=15)
    else:
        topic = entry_topic.get()
        if not topic:
            messagebox.showwarning("Warning", "Enter a topic!"); return
        status_label.config(text="AI generating script...")
        def pipeline():
            try:
                script = get_script(topic, entry_subtopics.get(), entry_minutes.get(), method)
                if script.startswith(("Error:", "AI Error:")):
                    root.after(0, lambda: messagebox.showerror("Error", script))
                    root.after(0, lambda: status_label.config(text="Failed"))
                    return
                with open("generated_script.txt", "w", encoding="utf-8") as f:
                    f.write(script)
                process_content(script)
            except Exception as e:
                err = str(e)
                root.after(0, lambda: messagebox.showerror("Error", f"Failed: {err}"))
                root.after(0, lambda: status_label.config(text="Failed"))
        threading.Thread(target=pipeline, daemon=True).start()

def on_video_type_change(*args):
    vtype = video_type_var.get()
    if vtype == "🎮 Gaming Highlights":
        gaming_frame.pack(after=img_card, fill=tk.X, padx=20, pady=5)
    else:
        gaming_frame.pack_forget()
    update_scroll_region()

def on_clip_mode_change(*args):
    mode = clip_mode_var.get()
    if mode == "Auto":
        entry_clips.config(state="normal")
        entry_clips.delete(0, tk.END)
        n = calc_clips_needed(get_duration())
        entry_clips.insert(0, str(n))
        entry_clips.config(state="disabled")
        clip_hint_label.config(text=f"~{n} clips to cover {get_duration()} min")
    else:
        entry_clips.config(state="normal")
        clip_hint_label.config(text="Your count (loops if too few)")

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
    global root, canvas, content
    global combo_method, combo_voice, combo_img_source
    global entry_topic, entry_subtopics, entry_minutes, entry_interval
    global entry_custom_images, var_web_img, var_ai_img
    global status_label, video_type_var
    global entry_game, entry_clips, gaming_frame, img_card
    global clip_mode_var, clip_hint_label

    root = tk.Tk()
    root.title("Auto Content Engine (Local)")
    root.geometry("520x700")
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

    # ── SCROLLABLE CONTAINER ──
    outer = tk.Frame(root, bg=BG_MAIN)
    outer.pack(fill=tk.BOTH, expand=True)

    canvas = tk.Canvas(outer, bg=BG_MAIN, highlightthickness=0)
    scrollbar = tk.Scrollbar(outer, orient=tk.VERTICAL, command=canvas.yview)
    canvas.configure(yscrollcommand=scrollbar.set)

    scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    content = tk.Frame(canvas, bg=BG_MAIN)
    canvas_window = canvas.create_window((0, 0), window=content, anchor="nw")

    def resize_content(event):
        canvas.itemconfig(canvas_window, width=event.width)
    canvas.bind("<Configure>", resize_content)
    content.bind("<Configure>", update_scroll_region)
    canvas.bind_all("<MouseWheel>", on_mousewheel)

    # ── HEADER ──
    hdr = tk.Frame(content, bg=BG_MAIN)
    hdr.pack(fill=tk.X, pady=(12, 5))
    tk.Label(hdr, text="AUTO CONTENT ENGINE", font=("Segoe UI", 15, "bold"),
             bg=BG_MAIN, fg=FG_TEXT).pack()
    tk.Label(hdr, text="LOCAL MODE — Full Pipeline", font=("Segoe UI", 9),
             bg=BG_MAIN, fg=ACCENT_TREND).pack()

    # ── CARD 1: Pipeline ──
    c1 = tk.Frame(content, bg=BG_CARD, padx=15, pady=10,
                  highlightthickness=1, highlightbackground="#E5E7EB")
    c1.pack(fill=tk.X, padx=15, pady=4)
    tk.Label(c1, text="PIPELINE", font=("Segoe UI", 9, "bold"),
             bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    row1 = tk.Frame(c1, bg=BG_CARD)
    row1.pack(fill=tk.X, pady=2)
    tk.Label(row1, text="Type:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=10, anchor="w").pack(side=tk.LEFT)
    video_type_var = tk.StringVar(value="🖼️ Image Slideshow")
    ttk.Combobox(row1, textvariable=video_type_var, state="readonly", font=fe,
                 values=["🖼️ Image Slideshow", "🐱 Slideshow + Cat", "🎮 Gaming Highlights"]
    ).pack(side=tk.LEFT, fill=tk.X, expand=True)
    video_type_var.trace_add("write", on_video_type_change)

    row2 = tk.Frame(c1, bg=BG_CARD)
    row2.pack(fill=tk.X, pady=2)
    tk.Label(row2, text="Script:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=10, anchor="w").pack(side=tk.LEFT)
    combo_method = ttk.Combobox(row2, values=["Manual", "Gemini"], state="readonly", font=fe)
    combo_method.set("Gemini")
    combo_method.pack(side=tk.LEFT, fill=tk.X, expand=True)

    row3 = tk.Frame(c1, bg=BG_CARD)
    row3.pack(fill=tk.X, pady=2)
    tk.Label(row3, text="Duration:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=10, anchor="w").pack(side=tk.LEFT)
    entry_minutes = tk.Entry(row3, font=fe, bg=ENTRY_BG, fg=ENTRY_FG, relief="flat",
                              highlightthickness=1, highlightbackground="#E5E7EB",
                              highlightcolor=ACCENT_PRIMARY, width=8)
    entry_minutes.insert(0, "10")
    entry_minutes.pack(side=tk.LEFT)
    tk.Label(row3, text="min", font=fh, bg=BG_CARD, fg=FG_DIM).pack(side=tk.LEFT, padx=5)
    entry_minutes.bind("<KeyRelease>", on_duration_change)

    # ── CARD 2: Content ──
    c2 = tk.Frame(content, bg=BG_CARD, padx=15, pady=10,
                  highlightthickness=1, highlightbackground="#E5E7EB")
    c2.pack(fill=tk.X, padx=15, pady=4)
    tk.Label(c2, text="CONTENT", font=("Segoe UI", 9, "bold"),
             bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    tk.Label(c2, text="Main Topic:", font=fl, bg=BG_CARD, fg=FG_TEXT).pack(anchor="w")
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

    row_int = tk.Frame(c2, bg=BG_CARD)
    row_int.pack(fill=tk.X, pady=2)
    tk.Label(row_int, text="Scene interval:", font=fl, bg=BG_CARD, fg=FG_TEXT).pack(side=tk.LEFT)
    entry_interval = tk.Entry(row_int, font=fe, bg=ENTRY_BG, fg=ENTRY_FG, relief="flat",
                               highlightthickness=1, highlightbackground="#E5E7EB",
                               highlightcolor=ACCENT_PRIMARY, width=5)
    entry_interval.insert(0, "8")
    entry_interval.pack(side=tk.LEFT, padx=5)
    tk.Label(row_int, text="sec/img", font=fh, bg=BG_CARD, fg=FG_DIM).pack(side=tk.LEFT)

    # ── CARD 3: Images ──
    img_card = tk.Frame(content, bg=BG_CARD, padx=15, pady=10,
                        highlightthickness=1, highlightbackground="#E5E7EB")
    img_card.pack(fill=tk.X, padx=15, pady=4)
    tk.Label(img_card, text="IMAGES", font=("Segoe UI", 9, "bold"),
             bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    row_src = tk.Frame(img_card, bg=BG_CARD)
    row_src.pack(fill=tk.X, pady=2)
    tk.Label(row_src, text="Source:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=10, anchor="w").pack(side=tk.LEFT)
    combo_img_source = ttk.Combobox(row_src, values=["DDG (Ours)", "Bing+Pexels (Git)"],
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
    tk.Label(img_card, text="(toggles affect Bing+Pexels mode only)",
             font=fh, bg=BG_CARD, fg=FG_DIM).pack(anchor="w")

    # ── GAMING FRAME (hidden) ──
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

    # ── CARD 4: Voice ──
    c4 = tk.Frame(content, bg=BG_CARD, padx=15, pady=10,
                  highlightthickness=1, highlightbackground="#E5E7EB")
    c4.pack(fill=tk.X, padx=15, pady=4)
    tk.Label(c4, text="VOICE", font=("Segoe UI", 9, "bold"),
             bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 6))

    row_v = tk.Frame(c4, bg=BG_CARD)
    row_v.pack(fill=tk.X, pady=2)
    tk.Label(row_v, text="Preset:", font=fl, bg=BG_CARD, fg=FG_TEXT, width=10, anchor="w").pack(side=tk.LEFT)
    combo_voice = ttk.Combobox(row_v, values=list(VOICE_PRESETS.keys()),
                                state="readonly", font=fe)
    combo_voice.set(list(VOICE_PRESETS.keys())[0])
    combo_voice.pack(side=tk.LEFT, fill=tk.X, expand=True)

    # ── GENERATE BUTTON ──
    tk.Button(content, text="Generate Video", font=("Segoe UI", 12, "bold"),
              bg=ACCENT_PRIMARY, fg="white", activebackground=ACCENT_PRIMARY_ACTIVE,
              activeforeground="white", relief="flat", cursor="hand2", pady=10,
              command=on_generate).pack(fill=tk.X, padx=15, pady=(10, 5))

    status_label = tk.Label(content, text="Ready", font=("Segoe UI", 10),
                             bg=BG_MAIN, fg=FG_DIM)
    status_label.pack(pady=(3, 5))

    tk.Label(content, text="Trends → Gemini → DDG/Bing → Kokoro → Video",
             font=fh, bg=BG_MAIN, fg=FG_DIM).pack(pady=(0, 10))

    root.bind('<Return>', on_generate)
    root.mainloop()

if __name__ == "__main__":
    run()
