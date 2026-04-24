import tkinter as tk
from tkinter import messagebox, ttk
import os
import threading

# Original Documentary Imports
from script_gen.generator import get_script
from voice_gen.kokoro_narration import generate_voice, VOICE_PRESETS
from voice_gen.subtitles import generate_srt_from_chunks
from video_edit.editor import create_video as create_doc_video
from trend_finder.trends import get_trending, get_related
from video_edit.downloader import prepare_assets

# New Reddit/Gameplay Imports
from shorts_gen.reddit import get_reddit_stories, format_story_for_tts
from shorts_gen.editor import create_video as create_gameplay_video

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
                       "final_video.mp4", "subtitles.srt", "temp_no_subs.mp4",
                       "short_audio.wav", "short_subs.srt", "final_tiktok.mp4", "final_youtube.mp4"]
    for file in files_to_delete:
        if os.path.exists(file):
            os.remove(file)

# ---------------------------------------------------------
# DOCUMENTARY & MANUAL PIPELINE
# ---------------------------------------------------------
def process_content(text, custom_keywords=""):
    if not text.strip():
        root.after(0, lambda: messagebox.showwarning("Warning", "The script is empty!"))
        return
    try:
        cleanup_old_assets()
        do_web = var_web_img.get()
        do_ai = var_ai_img.get()
        
        # Generare Imagini (Doar pt Documentar/Manual)
        if do_web or do_ai:
            root.after(0, lambda: messagebox.showinfo("Status", "Analyzing script to fetch & generate images...\nThis will take a moment."))
            prepare_assets(text, use_web=do_web, use_ai=do_ai, custom_keywords=custom_keywords)
        
        # Audio TTS
        root.after(0, lambda: status_label.config(text="Generating Audio with Kokoro TTS...", fg="blue"))
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
            
        # Randare Video Documentar
        root.after(0, lambda: status_label.config(text="Rendering cinematic video...", fg="blue"))
        create_doc_video(srt_path=srt_path)
        root.after(0, lambda: messagebox.showinfo("Success", "Video generated successfully! Check final_video.mp4"))
        root.after(0, lambda: status_label.config(text="Ready", fg=FG_DIM))
    except Exception as e:
        err = str(e)
        root.after(0, lambda: messagebox.showerror("Error", f"Processing failed: {err}"))
        root.after(0, lambda: status_label.config(text="Failed", fg="red"))
    finally:
        root.after(0, lambda: btn_generate.config(state=tk.NORMAL))

# ---------------------------------------------------------
# REDDIT / GAMEPLAY PIPELINE
# ---------------------------------------------------------
def process_reddit_content(story, voice, is_short):
    try:
        cleanup_old_assets()
        script = format_story_for_tts(story)
        
        root.after(0, lambda: status_label.config(text="Generating Voice & Subtitles...", fg="blue"))
        audio_path, chunk_timings = generate_voice(script, output_path="short_audio.wav", preset=voice)
        srt_path = generate_srt_from_chunks(chunk_timings, output_srt="short_subs.srt")
        
        root.after(0, lambda: status_label.config(text="Rendering Gameplay Video...", fg="blue"))
        bg_video = "assets/background.mp4"
        out_name = "final_tiktok.mp4" if is_short else "final_youtube.mp4"
        
        success, msg = create_gameplay_video(audio_path, srt_path, bg_video_path=bg_video, output_path=out_name, is_short=is_short)
        
        if success:
            root.after(0, lambda: messagebox.showinfo("Success", f"Video successfully rendered as {out_name}!"))
            root.after(0, lambda: status_label.config(text="Ready", fg="green"))
        else:
            root.after(0, lambda: messagebox.showerror("Render Error", msg))
            root.after(0, lambda: status_label.config(text="Failed", fg="red"))
            
    except Exception as e:
        err = str(e)
        root.after(0, lambda: messagebox.showerror("Error", f"Reddit pipeline failed: {err}"))
        root.after(0, lambda: status_label.config(text="Failed", fg="red"))
    finally:
        root.after(0, lambda: btn_generate.config(state=tk.NORMAL))

def open_reddit_picker(subreddit, voice, is_short):
    root.after(0, lambda: status_label.config(text=f"Fetching top stories from r/{subreddit}...", fg="blue"))
    stories = get_reddit_stories(subreddit=subreddit, limit=10)
    
    if not stories:
        root.after(0, lambda: messagebox.showerror("Error", f"Could not find stories for r/{subreddit}."))
        root.after(0, lambda: status_label.config(text="Ready", fg=FG_DIM))
        root.after(0, lambda: btn_generate.config(state=tk.NORMAL))
        return

    def on_select():
        selection = listbox.curselection()
        if not selection:
            messagebox.showwarning("Warning", "Select a story first!")
            return
        selected_story = stories[selection[0]]
        picker_win.destroy()
        
        root.after(0, lambda: status_label.config(text="Processing Reddit Story...", fg="blue"))
        threading.Thread(target=process_reddit_content, args=(selected_story, voice, is_short), daemon=True).start()

    def on_close():
        picker_win.destroy()
        root.after(0, lambda: btn_generate.config(state=tk.NORMAL))
        root.after(0, lambda: status_label.config(text="Ready", fg=FG_DIM))

    picker_win = tk.Toplevel(root)
    picker_win.title(f"Top Stories from r/{subreddit}")
    picker_win.geometry("500x350")
    picker_win.configure(bg=BG_MAIN)
    picker_win.protocol("WM_DELETE_WINDOW", on_close)
    
    tk.Label(picker_win, text="Select a story to generate:", font=("Segoe UI", 11, "bold"), bg=BG_MAIN, fg=FG_TEXT).pack(pady=10)
    
    listbox = tk.Listbox(picker_win, width=70, height=12, font=("Segoe UI", 10))
    listbox.pack(padx=15, pady=5)
    
    for s in stories:
        listbox.insert(tk.END, s['title'])
        
    tk.Button(picker_win, text="Generate Video", bg=ACCENT_SECONDARY, fg="white", activebackground=ACCENT_SECONDARY_ACTIVE, activeforeground="white", font=("Segoe UI", 10, "bold"), cursor="hand2", command=on_select).pack(pady=10)


# ---------------------------------------------------------
# UI DYNAMICS & TRENDS
# ---------------------------------------------------------
def get_duration_minutes():
    try:
        return max(1, int(entry_minutes.get()))
    except (ValueError, TypeError):
        return 10

def update_ui_visibility(*args):
    """Actualizează interfața în funcție de sursa selectată (Reddit/Doc/Manual)"""
    source = var_source.get()
    
    if source == "Reddit":
        # Disable Image Settings & Subtopics
        entry_subtopics.config(state="disabled")
        entry_custom_images.config(state="disabled")
        check_web.config(state="disabled")
        check_ai.config(state="disabled")
        entry_minutes.config(state="disabled")
        
        lbl_topic.config(text="Subreddit Name (no r/):")
        btn_generate.config(text="Fetch Reddit Stories", bg=ACCENT_TREND, activebackground=ACCENT_TREND_ACTIVE)
        btn_trends.pack_forget() # Ascunde butonul de trends
        
    elif source == "Manual Script":
        # Enable Image Settings, Disable Topics
        entry_subtopics.config(state="disabled")
        entry_custom_images.config(state="normal")
        check_web.config(state="normal")
        check_ai.config(state="normal")
        entry_minutes.config(state="disabled")
        
        lbl_topic.config(text="Project Title (Optional):")
        btn_generate.config(text="Paste Script & Generate", bg=ACCENT_SECONDARY, activebackground=ACCENT_SECONDARY_ACTIVE)
        btn_trends.pack_forget()
        
    else: # AI Documentary
        # Enable Everything
        entry_subtopics.config(state="normal")
        entry_custom_images.config(state="normal")
        check_web.config(state="normal")
        check_ai.config(state="normal")
        entry_minutes.config(state="normal")
        
        lbl_topic.config(text="Main Topic / Subject:")
        btn_generate.config(text="AI Generate Full Video", bg=ACCENT_PRIMARY, activebackground=ACCENT_PRIMARY_ACTIVE)
        btn_trends.pack(side=tk.RIGHT) # Arată butonul de trends


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
    win.configure(bg=BG_MAIN)
    if rss_topics:
        for t in rss_topics:
            tk.Button(win, text=t, command=lambda topic=t: autofill_topic(topic, original_topic, win)).pack(pady=2)
    if pytrends_topics:
        for t in pytrends_topics:
            tk.Button(win, text=t, command=lambda topic=t: autofill_topic(topic, original_topic, win)).pack(pady=2)

def autofill_topic(selected_topic, original_topic, popup):
    popup.destroy()
    entry_topic.delete(0, tk.END)
    entry_topic.insert(0, selected_topic)
    entry_subtopics.delete(0, tk.END)
    if original_topic:
        entry_subtopics.insert(0, original_topic)
    var_source.set("AI Documentary")
    update_ui_visibility()

# ---------------------------------------------------------
# LAUNCH PIPELINE
# ---------------------------------------------------------
def on_generate(event=None):
    source = var_source.get()
    btn_generate.config(state=tk.DISABLED)
    
    # 1. REDDIT MODE
    if source == "Reddit":
        sub = entry_topic.get().strip() or "AmItheAsshole"
        voice = combo_voice.get()
        is_short = var_format.get() == "Short"
        threading.Thread(target=open_reddit_picker, args=(sub, voice, is_short), daemon=True).start()
        return

    custom_kw = entry_custom_images.get().strip()
    
    # 2. MANUAL SCRIPT MODE
    if source == "Manual Script":
        manual_window = tk.Toplevel(root)
        manual_window.title("Manual Input")
        manual_window.geometry("600x500")
        manual_window.configure(bg=BG_MAIN)
        tk.Label(manual_window, text="Paste your English script here:", font=("Segoe UI", 11, "bold"), bg=BG_MAIN).pack(pady=10)
        txt_area = tk.Text(manual_window, wrap=tk.WORD, width=70, height=20)
        txt_area.pack(padx=15, pady=10, fill=tk.BOTH, expand=True)
        def start():
            content = txt_area.get("1.0", tk.END).strip()
            manual_window.destroy()
            threading.Thread(target=process_content, args=(content, custom_kw), daemon=True).start()
        tk.Button(manual_window, text="START GENERATING", bg=ACCENT_SECONDARY, fg="white", font=("Segoe UI", 11, "bold"), command=start).pack(pady=15)
        btn_generate.config(state=tk.NORMAL)
        return

    # 3. AI DOCUMENTARY MODE
    topic = entry_topic.get()
    if not topic:
        messagebox.showwarning("Warning", "Please enter a topic!")
        btn_generate.config(state=tk.NORMAL)
        return
        
    status_label.config(text="AI is writing the script...", fg="blue")
    def pipeline():
        try:
            script = get_script(topic, entry_subtopics.get(), entry_minutes.get(), "Gemini")
            if script.startswith(("Error:", "AI Error:")):
                root.after(0, lambda: messagebox.showerror("Error", script))
                root.after(0, lambda: status_label.config(text="Failed", fg="red"))
                root.after(0, lambda: btn_generate.config(state=tk.NORMAL))
                return
            with open("generated_script.txt", "w", encoding="utf-8") as f:
                f.write(script)
            process_content(script, custom_kw)
        except Exception as e:
            root.after(0, lambda: messagebox.showerror("Error", f"Failed: {str(e)}"))
            root.after(0, lambda: status_label.config(text="Failed", fg="red"))
            root.after(0, lambda: btn_generate.config(state=tk.NORMAL))
    threading.Thread(target=pipeline, daemon=True).start()


# ---------------------------------------------------------
# GUI LAYOUT (WIDER & CLEANER)
# ---------------------------------------------------------
root = tk.Tk()
root.title("Auto Content Engine Pro")
root.geometry("980x500") # Design pe lățime
root.configure(bg=BG_MAIN)

style = ttk.Style()
style.theme_use('clam')
font_label = ("Segoe UI", 10, "bold")
font_entry = ("Segoe UI", 11)

# Header
header_frame = tk.Frame(root, bg=BG_MAIN)
header_frame.pack(fill=tk.X, pady=(15, 10))
tk.Label(header_frame, text="AUTO CONTENT ENGINE", font=("Segoe UI", 18, "bold"), bg=BG_MAIN, fg=FG_TEXT).pack()

# Creăm un Grid cu 3 coloane principale
main_content = tk.Frame(root, bg=BG_MAIN)
main_content.pack(fill=tk.BOTH, expand=True, padx=20)

main_content.columnconfigure(0, weight=1)
main_content.columnconfigure(1, weight=1)
main_content.columnconfigure(2, weight=1)

# === COLOANA 1: SURSA TEXTULUI & FORMAT ===
col1 = tk.Frame(main_content, bg=BG_CARD, padx=20, pady=15, highlightthickness=1, highlightbackground="#E5E7EB")
col1.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)

tk.Label(col1, text="1. SCRIPT & FORMAT", font=("Segoe UI", 11, "bold"), bg=BG_CARD, fg=ACCENT_PRIMARY).pack(anchor="w", pady=(0, 15))

tk.Label(col1, text="Text Source:", font=font_label, bg=BG_CARD).pack(anchor="w")
var_source = tk.StringVar(value="AI Documentary")
ttk.Radiobutton(col1, text="🧠 AI Script (Documentary)", variable=var_source, value="AI Documentary", command=update_ui_visibility).pack(anchor="w", pady=2)
ttk.Radiobutton(col1, text="🔥 Reddit Story (Gameplay)", variable=var_source, value="Reddit", command=update_ui_visibility).pack(anchor="w", pady=2)
ttk.Radiobutton(col1, text="✍️ Manual Script Paste", variable=var_source, value="Manual Script", command=update_ui_visibility).pack(anchor="w", pady=2)

tk.Label(col1, text="Video Format:", font=font_label, bg=BG_CARD).pack(anchor="w", pady=(20, 2))
var_format = tk.StringVar(value="Short")
ttk.Radiobutton(col1, text="📱 Vertical (9:16 Shorts)", variable=var_format, value="Short").pack(anchor="w", pady=2)
ttk.Radiobutton(col1, text="🖥️ Horizontal (16:9 YouTube)", variable=var_format, value="Long").pack(anchor="w", pady=2)

tk.Label(col1, text="Duration (AI Doc only):", font=font_label, bg=BG_CARD).pack(anchor="w", pady=(20,2))
entry_minutes = tk.Entry(col1, font=font_entry, width=10)
entry_minutes.insert(0, "10")
entry_minutes.pack(anchor="w")


# === COLOANA 2: DETALII CONTINUT ===
col2 = tk.Frame(main_content, bg=BG_CARD, padx=20, pady=15, highlightthickness=1, highlightbackground="#E5E7EB")
col2.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)

tk.Label(col2, text="2. CONTENT DETAILS", font=("Segoe UI", 11, "bold"), bg=BG_CARD, fg=ACCENT_PRIMARY).pack(anchor="w", pady=(0, 15))

lbl_topic = tk.Label(col2, text="Main Topic / Subject:", font=font_label, bg=BG_CARD)
lbl_topic.pack(anchor="w")
topic_frame = tk.Frame(col2, bg=BG_CARD)
topic_frame.pack(fill=tk.X, pady=(2, 10))
entry_topic = tk.Entry(topic_frame, font=font_entry)
entry_topic.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
btn_trends = tk.Button(topic_frame, text="🔥 Trends", bg=ACCENT_TREND, fg="white", command=on_find_trending, relief="flat")
btn_trends.pack(side=tk.RIGHT)

tk.Label(col2, text="Subtopics (Doc only):", font=font_label, bg=BG_CARD).pack(anchor="w")
entry_subtopics = tk.Entry(col2, font=font_entry)
entry_subtopics.pack(fill=tk.X, pady=(2, 15))

tk.Label(col2, text="Custom Image Keywords:", font=font_label, bg=BG_CARD).pack(anchor="w")
entry_custom_images = tk.Entry(col2, font=font_entry)
entry_custom_images.pack(fill=tk.X, pady=(2, 5))
tk.Label(col2, text="(comma separated, for Manual/Doc mode)", font=("Segoe UI", 8), bg=BG_CARD, fg=FG_DIM).pack(anchor="w")


# === COLOANA 3: AUDIO & GENERARE ===
col3 = tk.Frame(main_content, bg=BG_CARD, padx=20, pady=15, highlightthickness=1, highlightbackground="#E5E7EB")
col3.grid(row=0, column=2, sticky="nsew", padx=10, pady=10)

tk.Label(col3, text="3. MEDIA & RENDER", font=("Segoe UI", 11, "bold"), bg=BG_CARD, fg=ACCENT_PRIMARY).pack(anchor="w", pady=(0, 15))

tk.Label(col3, text="Voice Actor (Kokoro TTS):", font=font_label, bg=BG_CARD).pack(anchor="w")
combo_voice = ttk.Combobox(col3, values=list(VOICE_PRESETS.keys()), state="readonly", font=font_entry)
combo_voice.set("🇺🇸 AM - Michael (Deep/News)")
combo_voice.pack(fill=tk.X, pady=(2, 20))

tk.Label(col3, text="Background Images (Doc/Manual):", font=font_label, bg=BG_CARD).pack(anchor="w")
var_web_img = tk.BooleanVar(value=True)
var_ai_img = tk.BooleanVar(value=True)
check_web = tk.Checkbutton(col3, text="Scrape Real Web Images", variable=var_web_img, bg=BG_CARD)
check_web.pack(anchor="w")
check_ai = tk.Checkbutton(col3, text="Generate AI Images", variable=var_ai_img, bg=BG_CARD)
check_ai.pack(anchor="w", pady=(0, 30))

# Buton Generare
btn_generate = tk.Button(col3, text="AI Generate Full Video", font=("Segoe UI", 11, "bold"), bg=ACCENT_PRIMARY, fg="white", cursor="hand2", pady=10, command=on_generate)
btn_generate.pack(fill=tk.X, side=tk.BOTTOM)

# Footer
footer_frame = tk.Frame(root, bg=BG_MAIN)
footer_frame.pack(fill=tk.X, pady=5)
status_label = tk.Label(footer_frame, text="Ready", font=("Segoe UI", 10, "bold"), bg=BG_MAIN, fg=FG_DIM)
status_label.pack()

# Initializare stari UI
update_ui_visibility()
root.bind('<Return>', on_generate)