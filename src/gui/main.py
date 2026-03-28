import tkinter as tk
from tkinter import messagebox, ttk
import os
import threading
from script_gen.generator import get_script
from voice_gen.kokoro_narration import generate_voice, VOICE_PRESETS
from voice_gen.subtitles import generate_srt_from_chunks
from video_edit.editor import create_video
from trend_finder.trends import get_trending, get_related

# --- NEW CLEAN LIGHT THEME ---
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
    files_to_delete = ["video_final.wav", "video_final.mp3", "generated_script.txt",
                       "final_video.mp4", "subtitles.srt", "temp_no_subs.mp4"]
    for file in files_to_delete:
        if os.path.exists(file):
            os.remove(file)

def process_content(text):
    if not text.strip():
        root.after(0, lambda: messagebox.showwarning("Warning", "The script is empty!"))
        return
    try:
        cleanup_old_assets()
        root.after(0, lambda: messagebox.showinfo("Status", "Generating Audio with Kokoro TTS...\nThis may take a minute."))
        
        selected_voice = combo_voice.get()
        if selected_voice not in VOICE_PRESETS:
             selected_voice = "🇺🇸 AM - Michael (Deep/News)"
             
        audio_path, chunk_timings = generate_voice(text, output_path="video_final.wav", preset=selected_voice)
        
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
        btn_generate.config(text="Paste Script & Generate Audio", bg=ACCENT_SECONDARY, activebackground=ACCENT_SECONDARY_ACTIVE)
    else:
        btn_generate.config(text="Generate Video Content", bg=ACCENT_PRIMARY, activebackground=ACCENT_PRIMARY_ACTIVE)

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
    win.configure(bg=BG_MAIN)

    if original_topic:
        tk.Label(win, text=f"Trends for \"{original_topic}\"", font=("Segoe UI", 13, "bold"), bg=BG_MAIN, fg=FG_TEXT).pack(pady=(15, 10))
    else:
        tk.Label(win, text="Trending Now", font=("Segoe UI", 13, "bold"), bg=BG_MAIN, fg=FG_TEXT).pack(pady=(15, 10))

    if rss_topics:
        tk.Label(win, text="🔥 Google Trends", font=("Segoe UI", 10, "bold"), bg=BG_MAIN, fg=ACCENT_TREND).pack(anchor="w", padx=20, pady=(5, 3))
        for t in rss_topics:
            btn = tk.Button(win, text=t, font=("Segoe UI", 11), anchor="w", padx=15, pady=5, bg=BG_CARD, fg=FG_TEXT, activebackground=ENTRY_BG, activeforeground=FG_TEXT, cursor="hand2", width=40, relief="flat", borderwidth=1, command=lambda topic=t: autofill_topic(topic, original_topic, win))
            btn.pack(pady=2, padx=20)

    if pytrends_topics:
        tk.Label(win, text="📊 Related Searches", font=("Segoe UI", 10, "bold"), bg=BG_MAIN, fg=ACCENT_PRIMARY).pack(anchor="w", padx=20, pady=(12, 3))
        for t in pytrends_topics:
            btn = tk.Button(win, text=t, font=("Segoe UI", 11), anchor="w", padx=15, pady=5, bg=BG_CARD, fg=FG_TEXT, activebackground=ENTRY_BG, activeforeground=FG_TEXT, cursor="hand2", width=40, relief="flat", borderwidth=1, command=lambda topic=t: autofill_topic(topic, original_topic, win))
            btn.pack(pady=2, padx=20)

    tk.Label(win, text="Click to auto-fill", font=("Segoe UI", 8), bg=BG_MAIN, fg=FG_DIM).pack(pady=(10, 5))

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

def on_generate(event=None):
    method = combo_method.get()

    if method == "Manual":
        manual_window = tk.Toplevel(root)
        manual_window.title("Manual Input")
        manual_window.geometry("600x500")
        manual_window.configure(bg=BG_MAIN)
        tk.Label(manual_window, text="Paste your English script here:", font=("Segoe UI", 11, "bold"), bg=BG_MAIN, fg=FG_TEXT).pack(pady=10)
        txt_area = tk.Text(manual_window, wrap=tk.WORD, width=70, height=20, font=("Consolas", 10), bg=BG_CARD, fg=ENTRY_FG, insertbackground=FG_TEXT, relief="solid", borderwidth=1, padx=10, pady=10)
        txt_area.pack(padx=15, pady=10, fill=tk.BOTH, expand=True)
        def start():
            content = txt_area.get("1.0", tk.END).strip()
            manual_window.destroy()
            threading.Thread(target=process_content, args=(content,), daemon=True).start()
        tk.Button(manual_window, text="START GENERATING AUDIO", bg=ACCENT_SECONDARY, fg="white", activebackground=ACCENT_SECONDARY_ACTIVE, activeforeground="white", font=("Segoe UI", 11, "bold"), relief="flat", borderwidth=0, cursor="hand2", padx=20, pady=10, command=start).pack(pady=15)
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

root = tk.Tk()
root.title("Auto Content Engine")
root.geometry("480x760")
root.resizable(False, False)
root.configure(bg=BG_MAIN)

style = ttk.Style()
style.theme_use('clam')
style.configure('TCombobox', fieldbackground=BG_CARD, background=ENTRY_BG, foreground=FG_TEXT, borderwidth=1, bordercolor=FG_DIM, arrowcolor=FG_TEXT)
style.map('TCombobox', fieldbackground=[('readonly', BG_CARD)], selectbackground=[('readonly', ACCENT_PRIMARY)], selectforeground=[('readonly', "white")])

font_label = ("Segoe UI", 10, "bold")
font_entry = ("Segoe UI", 11)

header_frame = tk.Frame(root, bg=BG_MAIN)
header_frame.pack(fill=tk.X, pady=(20, 10))
tk.Label(header_frame, text="AUTO CONTENT ENGINE", font=("Segoe UI", 16, "bold"), bg=BG_MAIN, fg=FG_TEXT).pack()
tk.Label(header_frame, text="AI Video Automation Pipeline", font=("Segoe UI", 9), bg=BG_MAIN, fg=FG_DIM).pack()

card1 = tk.Frame(root, bg=BG_CARD, padx=20, pady=15, highlightthickness=1, highlightbackground="#E5E7EB")
card1.pack(fill=tk.X, padx=20, pady=10)
tk.Label(card1, text="PIPELINE SETTINGS", font=("Segoe UI", 9, "bold"), bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 10))

tk.Label(card1, text="Script Source:", font=font_label, bg=BG_CARD, fg=FG_TEXT).pack(anchor="w")
combo_method = ttk.Combobox(card1, values=["Manual", "Gemini"], state="readonly", font=font_entry)
combo_method.set("Gemini")
combo_method.pack(fill=tk.X, pady=(2, 10))
combo_method.bind("<<ComboboxSelected>>", update_ui_style)

tk.Label(card1, text="Est. Duration (minutes):", font=font_label, bg=BG_CARD, fg=FG_TEXT).pack(anchor="w")
entry_minutes = tk.Entry(card1, font=font_entry, bg=ENTRY_BG, fg=ENTRY_FG, insertbackground=FG_TEXT, relief="flat", highlightthickness=1, highlightbackground="#E5E7EB", highlightcolor=ACCENT_PRIMARY)
entry_minutes.insert(0, "10")
entry_minutes.pack(fill=tk.X, pady=(2, 5))

card2 = tk.Frame(root, bg=BG_CARD, padx=20, pady=15, highlightthickness=1, highlightbackground="#E5E7EB")
card2.pack(fill=tk.X, padx=20, pady=10)
tk.Label(card2, text="CONTENT GENERATION", font=("Segoe UI", 9, "bold"), bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 10))

tk.Label(card2, text="Main Topic:", font=font_label, bg=BG_CARD, fg=FG_TEXT).pack(anchor="w")
topic_frame = tk.Frame(card2, bg=BG_CARD)
topic_frame.pack(fill=tk.X, pady=(2, 2))
entry_topic = tk.Entry(topic_frame, font=font_entry, bg=ENTRY_BG, fg=ENTRY_FG, insertbackground=FG_TEXT, relief="flat", highlightthickness=1, highlightbackground="#E5E7EB", highlightcolor=ACCENT_PRIMARY)
entry_topic.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
btn_trends = tk.Button(topic_frame, text="🔥 Trends", font=("Segoe UI", 9, "bold"), bg=ACCENT_TREND, fg="white", activebackground=ACCENT_TREND_ACTIVE, activeforeground="white", cursor="hand2", relief="flat", borderwidth=0, padx=10, command=on_find_trending)
btn_trends.pack(side=tk.RIGHT)

tk.Label(card2, text="Subtopics:", font=font_label, bg=BG_CARD, fg=FG_TEXT).pack(anchor="w", pady=(10, 2))
entry_subtopics = tk.Entry(card2, font=font_entry, bg=ENTRY_BG, fg=ENTRY_FG, insertbackground=FG_TEXT, relief="flat", highlightthickness=1, highlightbackground="#E5E7EB", highlightcolor=ACCENT_PRIMARY)
entry_subtopics.pack(fill=tk.X, pady=(0, 5))

card3 = tk.Frame(root, bg=BG_CARD, padx=20, pady=15, highlightthickness=1, highlightbackground="#E5E7EB")
card3.pack(fill=tk.X, padx=20, pady=10)
tk.Label(card3, text="AUDIO SETTINGS", font=("Segoe UI", 9, "bold"), bg=BG_CARD, fg=FG_DIM).pack(anchor="w", pady=(0, 10))

tk.Label(card3, text="Voice Preset:", font=font_label, bg=BG_CARD, fg=FG_TEXT).pack(anchor="w")

# Strict readonly dropdown, no typing allowed
combo_voice = ttk.Combobox(card3, values=list(VOICE_PRESETS.keys()), state="readonly", font=font_entry)
combo_voice.set("🇺🇸 AM - Michael (Deep/News)")
combo_voice.pack(fill=tk.X, pady=(2, 5))

btn_generate = tk.Button(root, text="Generate Video Content", font=("Segoe UI", 12, "bold"), bg=ACCENT_PRIMARY, fg="white", activebackground=ACCENT_PRIMARY_ACTIVE, activeforeground="white", relief="flat", borderwidth=0, cursor="hand2", pady=12, command=on_generate)
btn_generate.pack(fill=tk.X, padx=20, pady=(15, 5))

status_label = tk.Label(root, text="Ready", font=("Segoe UI", 10), bg=BG_MAIN, fg=FG_DIM)
status_label.pack(pady=5)

tk.Label(root, text="Trends → Gemini → Kokoro TTS → Video", font=("Segoe UI", 8), bg=BG_MAIN, fg=FG_DIM).pack(side=tk.BOTTOM, pady=10)

root.bind('<Return>', on_generate)
update_ui_style()
root.mainloop()