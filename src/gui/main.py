import tkinter as tk
from tkinter import messagebox, ttk
import os
import threading
from script_gen.generator import get_script
from voice_gen.kokoro_narration import generate_voice
from voice_gen.subtitles import generate_srt_from_chunks
from video_edit.editor import create_video

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

        # STEP 1: Voice (returns timings too)
        root.after(0, lambda: messagebox.showinfo("Status", "Generating Audio with Kokoro TTS...\nThis may take a minute."))
        audio_path, chunk_timings = generate_voice(text, output_path="video_final.wav", preset="narration")
        if not audio_path:
            root.after(0, lambda: messagebox.showerror("Error", "Audio generation failed!"))
            return

        # STEP 2: Subtitles (from Kokoro timings, instant)
        srt_path = None
        if chunk_timings:
            srt_path = generate_srt_from_chunks(chunk_timings, output_srt="subtitles.srt")

        # STEP 3: Video
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

def on_generate(event=None):
    method = combo_method.get()

    if method == "Manual":
        manual_window = tk.Toplevel(root)
        manual_window.title("Manual Input")
        manual_window.geometry("600x500")

        tk.Label(manual_window, text="Paste your English script here:", font=("Arial", 11, "bold")).pack(pady=10)

        txt_area = tk.Text(manual_window, wrap=tk.WORD, width=70, height=20, font=("Arial", 10))
        txt_area.pack(padx=10, pady=10)

        def start_manual_processing():
            script_content = txt_area.get("1.0", tk.END).strip()
            manual_window.destroy()
            threading.Thread(target=process_content, args=(script_content,), daemon=True).start()

        tk.Button(manual_window, text="START GENERATING AUDIO", bg="#10b981", fg="white",
                  font=("Arial", 11, "bold"), command=start_manual_processing).pack(pady=10)
    else:
        topic = entry_topic.get()
        if not topic:
            messagebox.showwarning("Warning", "Please enter a topic for AI Generation!")
            return

        messagebox.showinfo("Processing", f"AI is thinking... Please wait.")
        def ai_pipeline():
            try:
                script = get_script(topic, entry_subtopics.get(), entry_minutes.get(), method)
                if script.startswith(("Error:", "AI Error:")):
                    root.after(0, lambda: messagebox.showerror("Error", script))
                    return
                with open("generated_script.txt", "w", encoding="utf-8") as f:
                    f.write(script)
                process_content(script)
            except Exception as e:
                err = str(e)
                root.after(0, lambda: messagebox.showerror("Error", f"AI Generation failed: {err}"))
        threading.Thread(target=ai_pipeline, daemon=True).start()

root = tk.Tk()
root.title("YouTube Automator")
root.geometry("450x550")
root.resizable(False, False)

font_label = ("Arial", 11, "bold")
font_entry = ("Arial", 11)

tk.Label(root, text="Step 1: Choose Source", font=font_label).pack(pady=(25, 5))

combo_method = ttk.Combobox(root, values=["Manual", "Gemini"], state="readonly", font=font_entry)
combo_method.set("Manual")
combo_method.pack()
combo_method.bind("<<ComboboxSelected>>", update_ui_style)

tk.Label(root, text="------------------------------------------").pack(pady=10)

tk.Label(root, text="Main Topic (Only for AI):", font=font_label).pack(pady=(15, 5))
entry_topic = tk.Entry(root, width=45, font=font_entry)
entry_topic.pack()

tk.Label(root, text="Subtopics (Only for AI):", font=font_label).pack(pady=(15, 5))
entry_subtopics = tk.Entry(root, width=45, font=font_entry)
entry_subtopics.pack()

tk.Label(root, text="Est. Duration (minutes):", font=font_label).pack(pady=(15, 5))
entry_minutes = tk.Entry(root, width=15, font=font_entry)
entry_minutes.pack()

btn_generate = tk.Button(root, text="Paste Script & Generate Audio", font=("Arial", 12, "bold"),
                         bg="#10b981", fg="white", command=on_generate, height=2, width=30)
btn_generate.pack(pady=40)

root.bind('<Return>', on_generate)

update_ui_style()

root.mainloop()
