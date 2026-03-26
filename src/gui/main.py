import tkinter as tk
from tkinter import messagebox, ttk
import os
import threading
from script_gen.generator import get_script
from voice_gen.kokoro_narration import generate_voice
from video_edit.downloader import download_scene_images
from video_edit.editor import create_video

def cleanup_old_assets():
    for f in ["video_final.wav", "video_final.mp3", "generated_script.txt", "final_video.mp4"]:
        if os.path.exists(f):
            os.remove(f)

def get_wav_duration(path):
    import soundfile as sf
    return sf.info(path).duration

def process_content(text, scene_interval, image_source):
    if not text.strip():
        root.after(0, lambda: messagebox.showwarning("Warning", "Script is empty!"))
        return
    try:
        cleanup_old_assets()

        root.after(0, lambda: status_label.config(text="Step 1/3: Generating voice..."))
        print("\n=== STEP 1: Kokoro TTS ===")
        audio_path = generate_voice(text, output_path="video_final.wav", preset="narration")
        if not audio_path:
            root.after(0, lambda: messagebox.showerror("Error", "Audio generation failed!"))
            return

        audio_duration = get_wav_duration(audio_path)
        num_images = min(int(audio_duration / scene_interval) + 1, 20)
        root.after(0, lambda: status_label.config(
            text=f"Step 2/3: Generating {num_images} images ({image_source})..."))
        print(f"\n=== STEP 2: {image_source.upper()} ===")
        downloaded = download_scene_images(
            script_text=text, audio_duration=audio_duration,
            scene_interval=scene_interval, image_source=image_source)
        if not downloaded:
            root.after(0, lambda: messagebox.showerror("Error", "No images! Check API keys."))
            return

        root.after(0, lambda: status_label.config(text="Step 3/3: Rendering video..."))
        print(f"\n=== STEP 3: Render Video ===")
        create_video(scene_duration=scene_interval)

        root.after(0, lambda: status_label.config(text="Done! Check final_video.mp4"))
        root.after(0, lambda: messagebox.showinfo("Success",
            f"Video generated!\nAudio: {audio_duration:.0f}s | Images: {len(downloaded)} ({image_source})\nOutput: final_video.mp4"))
    except Exception as e:
        print(f"PIPELINE ERROR: {e}")
        root.after(0, lambda: status_label.config(text=f"Error"))
        err_msg = str(e)
        root.after(0, lambda: messagebox.showerror("Error", err_msg))

def get_scene_interval():
    try:
        val = int(entry_interval.get())
        if 3 <= val <= 60:
            return val
        messagebox.showwarning("Warning", "Interval: 3-60 sec")
    except ValueError:
        messagebox.showwarning("Warning", "Invalid interval!")
    return None

IMAGE_SOURCE_MAP = {
    "Gemini Image (FREE)": "gemini_image",
    "Imagen 3 (paid)": "imagen",
    "Pexels (free stock)": "pexels",
}

def on_generate(event=None):
    scene_interval = get_scene_interval()
    if not scene_interval:
        return
    image_source = IMAGE_SOURCE_MAP[combo_image_source.get()]
    method = combo_method.get()

    if method == "Manual":
        win = tk.Toplevel(root)
        win.title("Manual Input")
        win.geometry("600x500")
        tk.Label(win, text="Paste your English script:", font=("Arial", 11, "bold")).pack(pady=10)
        txt = tk.Text(win, wrap=tk.WORD, width=70, height=20, font=("Arial", 10))
        txt.pack(padx=10, pady=10)
        def go():
            content = txt.get("1.0", tk.END).strip()
            win.destroy()
            status_label.config(text="Processing...")
            threading.Thread(target=process_content,
                           args=(content, scene_interval, image_source), daemon=True).start()
        tk.Button(win, text="GENERATE VIDEO", bg="#10b981", fg="white",
                  font=("Arial", 11, "bold"), command=go).pack(pady=10)
    else:
        topic = entry_topic.get()
        if not topic:
            messagebox.showwarning("Warning", "Enter a topic!")
            return
        status_label.config(text="AI generating script...")
        def pipeline():
            try:
                script = get_script(topic, entry_subtopics.get(), entry_minutes.get(), method)
                if script.startswith(("Error:", "AI Error:")):
                    root.after(0, lambda: messagebox.showerror("Error", script))
                    return
                with open("generated_script.txt", "w", encoding="utf-8") as f:
                    f.write(script)
                process_content(script, scene_interval, image_source)
            except Exception as e:
                root.after(0, lambda: messagebox.showerror("Error", str(e)))
        threading.Thread(target=pipeline, daemon=True).start()

# ── GUI ──────────────────────────────────────────────────────
root = tk.Tk()
root.title("Auto Content Engine")
root.geometry("450x720")
root.resizable(False, False)
f_label = ("Arial", 11, "bold")
f_entry = ("Arial", 11)
f_hint = ("Arial", 8)

tk.Label(root, text="Auto Content Engine", font=("Arial", 14, "bold")).pack(pady=(15, 5))

tk.Label(root, text="Script Source:", font=f_label).pack(pady=(12, 3))
combo_method = ttk.Combobox(root, values=["Manual", "Gemini"], state="readonly", font=f_entry)
combo_method.set("Gemini")
combo_method.pack()

tk.Label(root, text="─" * 40).pack(pady=8)

tk.Label(root, text="Main Topic (AI only):", font=f_label).pack(pady=(5, 2))
entry_topic = tk.Entry(root, width=45, font=f_entry)
entry_topic.pack()

tk.Label(root, text="Subtopics (AI only):", font=f_label).pack(pady=(8, 2))
entry_subtopics = tk.Entry(root, width=45, font=f_entry)
entry_subtopics.pack()

tk.Label(root, text="Duration (minutes):", font=f_label).pack(pady=(8, 2))
entry_minutes = tk.Entry(root, width=15, font=f_entry)
entry_minutes.insert(0, "2")
entry_minutes.pack()

tk.Label(root, text="─" * 40).pack(pady=8)

tk.Label(root, text="Image Source:", font=f_label).pack(pady=(5, 2))
combo_image_source = ttk.Combobox(root,
    values=list(IMAGE_SOURCE_MAP.keys()), state="readonly", font=f_entry, width=25)
combo_image_source.set("Gemini Image (FREE)")
combo_image_source.pack()
tk.Label(root, text="Gemini=AI gen FREE 500/zi | Imagen=platit $0.04 | Pexels=stock free",
         font=f_hint, fg="#888").pack()

tk.Label(root, text="Scene interval (sec/image):", font=f_label).pack(pady=(10, 2))
entry_interval = tk.Entry(root, width=15, font=f_entry)
entry_interval.insert(0, "8")
entry_interval.pack()
tk.Label(root, text="5=rapid  8=normal  15=lent  (max 20 images)", font=f_hint, fg="#888").pack()

tk.Button(root, text="Generate Full Video", font=("Arial", 12, "bold"),
          bg="#3b82f6", fg="white", command=on_generate, height=2, width=30).pack(pady=18)

status_label = tk.Label(root, text="Ready", font=("Arial", 10), fg="#666")
status_label.pack(pady=3)

tk.Label(root, text="Gemini Script → Kokoro TTS → Image Gen → Video",
         font=f_hint, fg="#999").pack(side=tk.BOTTOM, pady=10)

root.bind('<Return>', on_generate)
root.mainloop()
