import tkinter as tk
from tkinter import messagebox
from gtts import gTTS
import os

def on_generate(event=None):
    topic = entry_topic.get()
    subtopics = entry_subtopics.get()
    minutes = entry_minutes.get()

    if not topic:
        messagebox.showwarning("Eroare", "Te rugăm să introduci un topic!")
        return

    text_final = f"Astăzi vom vorbi despre {topic}. Vom analiza următoarele subtopice: {subtopics}."
    
    try:
        tts = gTTS(text=text_final, lang='ro')
        output_path = "video_preview.mp3"
        tts.save(output_path)
        messagebox.showinfo("Succes", f"Audio generat cu succes: {output_path}")
    except Exception as e:
        messagebox.showerror("Eroare", f"A apărut o problemă: {e}")

root = tk.Tk()
root.title("YouTube Video Automator")
root.geometry("450x400")
root.resizable(False, False)

font_label = ("Arial", 11, "bold")
font_entry = ("Arial", 11)

tk.Label(root, text="Topic Principal:", font=font_label).pack(pady=(25, 5))
entry_topic = tk.Entry(root, width=45, font=font_entry)
entry_topic.pack()

tk.Label(root, text="Subtopice (separate prin virgulă):", font=font_label).pack(pady=(15, 5))
entry_subtopics = tk.Entry(root, width=45, font=font_entry)
entry_subtopics.pack()

tk.Label(root, text="Durată Video (minute, max 30):", font=font_label).pack(pady=(15, 5))
entry_minutes = tk.Entry(root, width=15, font=font_entry)
entry_minutes.pack()

btn_generate = tk.Button(root, text="Generează Video", font=("Arial", 12, "bold"), bg="#3b82f6", fg="white", command=on_generate)
btn_generate.pack(pady=30)

root.bind('<Return>', on_generate)