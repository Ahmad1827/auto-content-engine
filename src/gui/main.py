import tkinter as tk
from tkinter import messagebox, ttk
import os
import threading
from script_gen.generator import get_script
from voice_gen.kokoro_narration import generate_voice
from voice_gen.subtitles import generate_srt_from_chunks
from video_edit.editor import create_video
from trend_finder.trends import get_trending, get_related

def cleanup_old_assets():
    files_to_delete = ["video_final.wav", "video_final.mp3", "generated_script.txt",
                       "final_video.mp4", "subtitles.srt", "temp_no_subs.mp4"]
    for file in files_to_delete:
        if os.path.exists(file):
            os.remove(file)
    print("Cleanup complete.")

def process_content(text):
    if not text.strip():
        root.after(0, lambda: messagebox.showwarning("Warning", "The script is empty!"))
        return
    try:
        cleanup_old_assets()

        root.after(0, lambda: messagebox.showinfo("Status", "Generating Audio with Kokoro TTS...\nThis may take a minute."))
        audio_path, chunk_timings = generate_voice(text, output_path="video_final.wav", preset="narration")
        if not audio_path:
            root.after(0, lambda: messagebox.showerror("Error", "Audio generation failed!"))
            return

        srt_path = None
        if chunk_timings:
            srt_path = generate_srt_from_chunks(chunk_timings, output_srt="subtitles.srt")

        root.after(0, lambda: messagebox.showinfo("Status", "Rendering cinematic video... This will take a while."))
        create_video(srt_path=srt_path)

        root.after(0, lambda: messagebox.showinfo("Success", "Video generated successfully! Check final_video.mp4"))
    except Exception as e:
        err = str(e)
        root.after(0, lambda: messagebox.showerror("Error", f"Processing failed: {err}"))

def update_ui_style(event=None):
    method = combo_method.get()
    if method == "Manual":
        btn_generate.config(text="Paste Script & Generate Audio", bg="#10b981")
    else:
        btn_generate.config(text="Generate Video Content", bg="#3b82f6")

# ── TRENDING PICKER ──────────────────────────────────────────
def get_duration_minutes():
    try:
        return max(1, int(entry_minutes.get()))
    except (ValueError, TypeError):
        return 10

def on_find_trending():
    topic_input = entry_topic.get().strip()
    duration = get_duration_minutes()

    def fetch():
        if topic_input:
            root.after(0, lambda: status_label.config(text=f"Finding trends for '{topic_input}'..."))
            results = get_related(topic_input, duration_min=duration)
        else:
            root.after(0, lambda: status_label.config(text="Finding trending topics..."))
            results = get_trending(duration_min=duration)

        rss = results.get("rss", [])
        pytr = results.get("pytrends", [])

        if not rss and not pytr:
            root.after(0, lambda: status_label.config(text="No trends found"))
            root.after(0, lambda: messagebox.showwarning("Trends", "No topics found."))
            return

        root.after(0, lambda: show_trend_picker(rss, pytr, topic_input))
        root.after(0, lambda: status_label.config(text="Ready"))

    threading.Thread(target=fetch, daemon=True).start()


def show_trend_picker(rss_topics, pytrends_topics, original_topic):
    win = tk.Toplevel(root)
    win.title("Pick a Topic")
    win.geometry("440x480")
    win.resizable(False, False)
    win.configure(bg="#0f172a")

    if original_topic:
        tk.Label(win, text=f"Trends for \"{original_topic}\"",
                 font=("Arial", 13, "bold"), bg="#0f172a", fg="white").pack(pady=(15, 10))
    else:
        tk.Label(win, text="Trending Now",
                 font=("Arial", 13, "bold"), bg="#0f172a", fg="white").pack(pady=(15, 10))

    # Google Trends group
    if rss_topics:
        tk.Label(win, text="🔥 Google Trends", font=("Arial", 10, "bold"),
                 bg="#0f172a", fg="#f59e0b").pack(anchor="w", padx=20, pady=(5, 3))
        for t in rss_topics:
            btn = tk.Button(win, text=t, font=("Arial", 11),
                            anchor="w", padx=15, pady=5,
                            bg="#1e293b", fg="white", activebackground="#334155",
                            cursor="hand2", width=40, relief="flat",
                            command=lambda topic=t: autofill_topic(topic, original_topic, win))
            btn.pack(pady=1, padx=20)

    # pytrends group
    if pytrends_topics:
        tk.Label(win, text="📊 Related Searches", font=("Arial", 10, "bold"),
                 bg="#0f172a", fg="#38bdf8").pack(anchor="w", padx=20, pady=(12, 3))
        for t in pytrends_topics:
            btn = tk.Button(win, text=t, font=("Arial", 11),
                            anchor="w", padx=15, pady=5,
                            bg="#1e293b", fg="white", activebackground="#334155",
                            cursor="hand2", width=40, relief="flat",
                            command=lambda topic=t: autofill_topic(topic, original_topic, win))
            btn.pack(pady=1, padx=20)

    tk.Label(win, text="Click to auto-fill", font=("Arial", 8),
             bg="#0f172a", fg="#64748b").pack(pady=(10, 5))


def autofill_topic(selected_topic, original_topic, popup):
    popup.destroy()
    entry_topic.delete(0, tk.END)
    entry_topic.insert(0, selected_topic)
    entry_subtopics.delete(0, tk.END)
    if original_topic:
        entry_subtopics.insert(0, original_topic)
    combo_method.set("Gemini")
    update_ui_style()
    status_label.config(text=f"Topic: {selected_topic}")

# ── GENERATE ─────────────────────────────────────────────────
def on_generate(event=None):
    method = combo_method.get()

    if method == "Manual":
        manual_window = tk.Toplevel(root)
        manual_window.title("Manual Input")
        manual_window.geometry("600x500")
        tk.Label(manual_window, text="Paste your English script here:", font=("Arial", 11, "bold")).pack(pady=10)
        txt_area = tk.Text(manual_window, wrap=tk.WORD, width=70, height=20, font=("Arial", 10))
        txt_area.pack(padx=10, pady=10)
        def start():
            content = txt_area.get("1.0", tk.END).strip()
            manual_window.destroy()
            threading.Thread(target=process_content, args=(content,), daemon=True).start()
        tk.Button(manual_window, text="START GENERATING AUDIO", bg="#10b981", fg="white",
                  font=("Arial", 11, "bold"), command=start).pack(pady=10)
    else:
        topic = entry_topic.get()
        if not topic:
            messagebox.showwarning("Warning", "Please enter a topic!")
            return
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

# ── GUI ──────────────────────────────────────────────────────
root = tk.Tk()
root.title("Auto Content Engine")
root.geometry("450x620")
root.resizable(False, False)
font_label = ("Arial", 11, "bold")
font_entry = ("Arial", 11)

tk.Label(root, text="Auto Content Engine", font=("Arial", 14, "bold")).pack(pady=(15, 5))

tk.Label(root, text="Script Source:", font=font_label).pack(pady=(12, 3))
combo_method = ttk.Combobox(root, values=["Manual", "Gemini"], state="readonly", font=font_entry)
combo_method.set("Gemini")
combo_method.pack()
combo_method.bind("<<ComboboxSelected>>", update_ui_style)

tk.Label(root, text="─" * 40).pack(pady=8)

tk.Label(root, text="Est. Duration (minutes):", font=font_label).pack(pady=(8, 3))
entry_minutes = tk.Entry(root, width=15, font=font_entry)
entry_minutes.insert(0, "10")
entry_minutes.pack()

tk.Label(root, text="Main Topic:", font=font_label).pack(pady=(10, 3))
topic_frame = tk.Frame(root)
topic_frame.pack()
entry_topic = tk.Entry(topic_frame, width=30, font=font_entry)
entry_topic.pack(side=tk.LEFT, padx=(0, 5))
btn_trends = tk.Button(topic_frame, text="🔥 Trends", font=("Arial", 10, "bold"),
                       bg="#f59e0b", fg="white", cursor="hand2",
                       command=on_find_trending)
btn_trends.pack(side=tk.LEFT)
tk.Label(root, text="Empty = trending now | With topic = related trends",
         font=("Arial", 8), fg="#888").pack()

tk.Label(root, text="Subtopics:", font=font_label).pack(pady=(10, 3))
entry_subtopics = tk.Entry(root, width=45, font=font_entry)
entry_subtopics.pack()

tk.Label(root, text="─" * 40).pack(pady=8)

btn_generate = tk.Button(root, text="Generate Video Content", font=("Arial", 12, "bold"),
                         bg="#3b82f6", fg="white", command=on_generate, height=2, width=30)
btn_generate.pack(pady=15)

status_label = tk.Label(root, text="Ready", font=("Arial", 10), fg="#666")
status_label.pack(pady=3)

tk.Label(root, text="Trends → Gemini → Kokoro TTS → Video",
         font=("Arial", 8), fg="#999").pack(side=tk.BOTTOM, pady=10)

root.bind('<Return>', on_generate)
update_ui_style()
root.mainloop()



