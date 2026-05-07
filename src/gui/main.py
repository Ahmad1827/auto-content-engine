import tkinter as tk
from tkinter import messagebox, ttk
import os
import sys
import shutil
import threading
import random

from script_gen.generator import get_script
from voice_gen.kokoro_narration import generate_voice, VOICE_PRESETS
from voice_gen.subtitles import generate_srt_from_chunks
from video_edit.editor import create_video as create_doc_video
from trend_finder.trends import get_trending, get_related
from video_edit.downloader import prepare_assets

try:
    from video_edit.thumbnail import create_thumbnail
except ImportError:
    def create_thumbnail(topic_hint, output_path="thumbnail.jpg"):
        print("[Warning] thumbnail.py is missing! Skipping thumbnail generation.")

from shorts_gen.reddit import get_reddit_stories, format_story_for_tts
from shorts_gen.editor import create_video as create_gameplay_video

BG_DESKTOP = "#008080"
WIN_FACE = "#C0C0C0"
WIN_TITLE = "#000080"
WIN_TEXT = "#FFFFFF"
TEXT_COLOR = "#000000"

FONT_MAIN = ("W95FA", 10)
FONT_BOLD = ("W95FA", 10, "bold")

BATCH_MODE = False
batch_queue = []




class RedirectText(object):
    def __init__(self, text_widget, tag=None):
        self.text_widget = text_widget
        self.tag = tag

    def write(self, string):
        self.text_widget.after(0, self._write, string)

    def _write(self, string):
        self.text_widget.config(state=tk.NORMAL)
        if self.tag:
            self.text_widget.insert(tk.END, string, (self.tag,))
        else:
            self.text_widget.insert(tk.END, string)
        self.text_widget.see(tk.END)
        self.text_widget.config(state=tk.DISABLED)

    def flush(self): pass

class Win95ProgressBar(tk.Canvas):
    def __init__(self, parent, height=20, bg="#FFFFFF", block_color="#000080", **kwargs):
        super().__init__(parent, height=height, bg=bg, relief="sunken", bd=2, **kwargs)
        self.block_color = block_color
        self.max_val = 100
        self.current_val = 0
        self.bind("<Configure>", self.draw)

    def set_progress(self, val):
        self.current_val = min(max(val, 0), self.max_val)
        self.draw()

    def draw(self, event=None):
        self.delete("block")
        if self.current_val <= 0: return
        
        width = self.winfo_width()
        height = self.winfo_height()
        
        block_w = 12
        gap = 2
        total_blocks = int(width / (block_w + gap))
        active_blocks = int((self.current_val / self.max_val) * total_blocks)
        
        for i in range(active_blocks):
            x0 = 2 + i * (block_w + gap)
            y0 = 2
            x1 = x0 + block_w
            y1 = height - 2
            self.create_rectangle(x0, y0, x1, y1, fill=self.block_color, outline="", tags="block")

def update_progress(val):
    root.after(0, lambda: progress_bar.set_progress(val))

def archive_output(base_video_path, topic_name):
    safe_name = "".join(c for c in topic_name if c.isalnum() or c in " _-").strip().replace(" ", "_")
    if not safe_name: safe_name = "Video"
    rand_id = random.randint(1000, 9999)
    
    new_vid = f"Output_{safe_name}_{rand_id}.mp4"
    new_thumb = f"Output_{safe_name}_{rand_id}_Thumb.jpg"
    
    if os.path.exists(base_video_path):
        shutil.move(base_video_path, new_vid)
    if os.path.exists("thumbnail.jpg"):
        shutil.move("thumbnail.jpg", new_thumb)
        
    print(f"[System] Successfully archived as {new_vid}")

# ==========================================
# PIPELINE LOGIC
# ==========================================
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
        root.after(0, lambda: messagebox.showwarning("Warning", "The script is empty!"))
        return
    try:
        update_progress(5)
        cleanup_old_assets()
        try: sec_per_img = max(2, int(sec_per_img_str))
        except: sec_per_img = 5
        try: img_count = max(1, int(img_count_str))
        except: img_count = 5
        
        update_progress(15)
        if do_web or do_ai:
            root.after(0, lambda: status_label.config(text=f"Fetching/Generating {img_count} images...", fg=WIN_TITLE))
            prepare_assets(text, use_web=do_web, use_ai=do_ai, custom_keywords=custom_keywords, image_count=img_count, is_short=is_short)
        
        update_progress(40)
        root.after(0, lambda: status_label.config(text="Generating Audio with Kokoro TTS...", fg=WIN_TITLE))
        selected_voice = voice if voice in VOICE_PRESETS else "🇺🇸 AM - Michael (Deep/News)"
        audio_path, chunk_timings = generate_voice(text, output_path="video_final.wav", preset=selected_voice)
        if not audio_path:
            raise Exception("Audio generation failed!")
            
        update_progress(60)
        srt_path = None
        if chunk_timings:
            srt_path = generate_srt_from_chunks(chunk_timings, output_srt="subtitles.srt")
            
        update_progress(75)
        root.after(0, lambda: status_label.config(text="Rendering cinematic video...", fg=WIN_TITLE))
        create_doc_video(srt_path=srt_path, is_short=is_short, scene_duration=sec_per_img)
        
        update_progress(90)
        root.after(0, lambda: status_label.config(text="Painting Thumbnail...", fg=WIN_TITLE))
        thumb_topic = custom_keywords if custom_keywords else topic
        create_thumbnail(topic_hint=thumb_topic)

        update_progress(100)
        archive_output("final_video.mp4", topic)
        
        if not BATCH_MODE:
            root.after(0, lambda: messagebox.showinfo("Success", "Video & Thumbnail generated successfully!"))
            root.after(0, lambda: status_label.config(text="Ready", fg=TEXT_COLOR))
            
    except Exception as e:
        print(f"[Error] Pipeline Failed: {e}", file=sys.stderr)
        root.after(0, lambda: status_label.config(text="Failed", fg="red"))
    finally:
        root.after(0, lambda: reset_buttons())

def process_gameplay_content(text_or_story, voice, is_short, topic="Video"):
    
    try:
        update_progress(5)
        cleanup_old_assets()
        
        
        if isinstance(text_or_story, dict):
            script = format_story_for_tts(text_or_story)
            topic = text_or_story.get('title', 'Reddit_Story')
        else:
            script = text_or_story
            
        update_progress(20)
        root.after(0, lambda: status_label.config(text="Generating Voice & Subtitles...", fg=WIN_TITLE))
        audio_path, chunk_timings = generate_voice(script, output_path="short_audio.wav", preset=voice)
        srt_path = generate_srt_from_chunks(chunk_timings, output_srt="short_subs.srt")
        
        update_progress(60)
        root.after(0, lambda: status_label.config(text="Rendering Gameplay Video...", fg=WIN_TITLE))
        bg_video = "assets/background.mp4"
        out_name = "final_tiktok.mp4" if is_short else "final_youtube.mp4"
        
        success, msg = create_gameplay_video(audio_path, srt_path, bg_video_path=bg_video, output_path=out_name, is_short=is_short)
        
        update_progress(100)
        if success:
            archive_output(out_name, topic)
            if not BATCH_MODE:
                root.after(0, lambda: messagebox.showinfo("Success", f"Gameplay Video successfully rendered!"))
                root.after(0, lambda: status_label.config(text="Ready", fg=TEXT_COLOR))
        else:
            print(f"[Render Error] {msg}", file=sys.stderr)
            root.after(0, lambda: status_label.config(text="Failed", fg="red"))
            
    except Exception as e:
        print(f"[Error] Gameplay pipeline failed: {e}", file=sys.stderr)
        root.after(0, lambda: status_label.config(text="Failed", fg="red"))
    finally:
        root.after(0, lambda: reset_buttons())




def update_queue_ui():
    queue_listbox.delete(0, tk.END)
    for i, t in enumerate(batch_queue):
        queue_listbox.insert(tk.END, f"{i+1}. [{t['format']}] {t['source']} ({t['bg_style']}) - {t['topic']}")

def add_to_queue():
    source = var_source.get()
    topic = entry_topic.get().strip()
    
    if source != "Manual Script" and not topic:
        messagebox.showwarning("Queue Error", "Please enter a Main Topic first!")
        return
        
    task = {
        "source": source,
        "format": var_format.get(),
        "bg_style": var_bg_style.get(),
        "topic": topic if topic else "Manual_Video",
        "subtopics": entry_subtopics.get().strip(),
        "custom_kw": entry_custom_images.get().strip(),
        "duration": get_duration_minutes(),
        "scene_dur": entry_scene_duration.get(),
        "img_count": entry_img_count.get(),
        "voice": combo_voice.get(),
        "do_web": var_web_img.get(),
        "do_ai": var_ai_img.get()
    }
    
    if source == "Manual Script":
        manual_window = tk.Toplevel(root)
        manual_window.title("")
        manual_window.geometry("600x500")
        manual_window.configure(bg=WIN_FACE)
        
        t_bar = tk.Frame(manual_window, bg=WIN_TITLE, relief="raised", bd=1)
        t_bar.pack(fill=tk.X, padx=2, pady=2)
        tk.Label(t_bar, text=" Notepad (Queue Mode) ", font=FONT_BOLD, bg=WIN_TITLE, fg=WIN_TEXT).pack(side=tk.LEFT)
        tk.Button(t_bar, text="X", font=("Arial", 8, "bold"), relief="raised", bd=2, bg=WIN_FACE, command=manual_window.destroy).pack(side=tk.RIGHT, padx=2, pady=2)

        txt_frame = tk.Frame(manual_window, relief="sunken", bd=2, bg="#FFFFFF")
        txt_frame.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

        txt_area = tk.Text(txt_frame, wrap=tk.WORD, width=70, height=15, font=("Courier", 11), bg="#FFFFFF", relief="flat")
        txt_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        scrollbar = tk.Scrollbar(txt_frame, orient="vertical", command=txt_area.yview)
        scrollbar.pack(side=tk.RIGHT, fill="y")
        txt_area.config(yscrollcommand=scrollbar.set)
        
        def save_to_queue():
            content = txt_area.get("1.0", tk.END).strip()
            if not content:
                messagebox.showwarning("Warning", "Cannot queue an empty script!")
                return
            manual_window.destroy()
            task["manual_text"] = content
            task["topic"] = task["custom_kw"] if task["custom_kw"] else "Manual_Video"
            batch_queue.append(task)
            update_queue_ui()
            print(f"[Batch Manager] Manual Script added to queue as '{task['topic']}'")
            
        tk.Button(manual_window, text="Save to Queue", bg=WIN_FACE, fg=TEXT_COLOR, font=FONT_BOLD, relief="raised", bd=2, width=15, command=save_to_queue).pack(pady=10)
        return

    batch_queue.append(task)
    update_queue_ui()
    print(f"[Batch Manager] Task added: {topic}")

def clear_queue():
    global batch_queue
    batch_queue = []
    update_queue_ui()
    print("[Batch Manager] Queue cleared.")

def start_batch():
    global BATCH_MODE
    if not batch_queue:
        messagebox.showinfo("Empty Queue", "Please add tasks to the queue first.")
        return
        
    BATCH_MODE = True
    btn_generate.config(state=tk.DISABLED)
    btn_random_viral.config(state=tk.DISABLED)
    btn_add_q.config(state=tk.DISABLED)
    btn_start_q.config(state=tk.DISABLED)
    
    threading.Thread(target=batch_worker, daemon=True).start()

def batch_worker():
    global BATCH_MODE
    print("\n" + "="*40)
    print("🌙 NIGHT SHIFT BATCH PROCESSING STARTED")
    print("="*40)
    
    while batch_queue:
        task = batch_queue.pop(0)
        root.after(0, update_queue_ui)
        
        print(f"\n[Night Shift] Executing Task: {task['topic']}")
        source = task["source"]
        topic = task["topic"]
        is_short = task["format"] == "Short"
        bg_style = task["bg_style"]
        
        try:
            if source == "Reddit":
                stories = get_reddit_stories(subreddit=topic, limit=1)
                if stories:
                    process_gameplay_content(stories[0], task["voice"], is_short, topic)
                else:
                    print(f"[Night Shift Error] No stories found for r/{topic}. Skipping.", file=sys.stderr)
                    
            elif source == "Manual Script":
                script = task.get("manual_text", "")
                with open("generated_script.txt", "w", encoding="utf-8") as f:
                    f.write(script)
                
                if bg_style == "Gameplay":
                    process_gameplay_content(script, task["voice"], is_short, topic)
                else:
                    process_content(script, task["custom_kw"], task["do_web"], task["do_ai"], is_short, str(task["scene_dur"]), str(task["img_count"]), task["voice"], topic)
                    
            else: 
                script = get_script(topic, task["subtopics"], str(task["duration"]), "Gemini")
                if script.startswith(("Error:", "AI Error:")):
                    print(f"[Night Shift Error] Gemini API failed: {script}", file=sys.stderr)
                else:
                    with open("generated_script.txt", "w", encoding="utf-8") as f:
                        f.write(script)
                        
                    if bg_style == "Gameplay":
                        process_gameplay_content(script, task["voice"], is_short, topic)
                    else:
                        process_content(script, task["custom_kw"], task["do_web"], task["do_ai"], is_short, str(task["scene_dur"]), str(task["img_count"]), task["voice"], topic)
                        
        except Exception as e:
            print(f"[Night Shift Error] Task crash: {e}", file=sys.stderr)
            
    print("\n" + "="*40)
    print("🌅 NIGHT SHIFT COMPLETE! ALL VIDEOS RENDERED.")
    print("="*40)
    
    BATCH_MODE = False
    root.after(0, reset_buttons)
    root.after(0, lambda: messagebox.showinfo("Night Shift Complete", "All queued videos have been successfully rendered and archived!"))




def reset_buttons():
    if BATCH_MODE: return
    
    btn_generate.config(state=tk.NORMAL)
    btn_random_viral.config(state=tk.NORMAL)
    btn_add_q.config(state=tk.NORMAL)
    btn_start_q.config(state=tk.NORMAL)
    status_label.config(text="Ready", fg=TEXT_COLOR)
    update_progress(0)

def hard_reset_app():
    if BATCH_MODE:
        messagebox.showwarning("Warning", "Cannot reboot while Night Shift is running!")
        return
        
    entry_topic.delete(0, tk.END)
    entry_subtopics.delete(0, tk.END)
    entry_custom_images.delete(0, tk.END)
    
    entry_minutes.delete(0, tk.END); entry_minutes.insert(0, "10")
    entry_scene_duration.delete(0, tk.END); entry_scene_duration.insert(0, "4")
    entry_img_count.delete(0, tk.END); entry_img_count.insert(0, "10")
    
    var_source.set("AI Documentary")
    var_format.set("Short")
    var_bg_style.set("Images")
    combo_voice.set("🇺🇸 AM - Michael (Deep/News)")
    
    update_ui_visibility()
    reset_buttons()
    clear_queue()
    
    console_text.config(state=tk.NORMAL)
    console_text.delete("1.0", tk.END)
    console_text.config(state=tk.DISABLED)
    
    print("Microsoft(R) Windows 95")
    print("   (C)Copyright Microsoft Corp 1981-1996.")
    print("\nC:\\ACE_PRO> System rebooted and memory cleared.")

def open_reddit_picker(subreddit, voice, is_short):
    root.after(0, lambda: status_label.config(text=f"Fetching top stories from r/{subreddit}...", fg=WIN_TITLE))
    stories = get_reddit_stories(subreddit=subreddit, limit=10)
    
    if not stories:
        root.after(0, lambda: messagebox.showerror("Error", f"Could not find stories for r/{subreddit}."))
        root.after(0, lambda: reset_buttons())
        return

    def on_select():
        selection = listbox.curselection()
        if not selection:
            messagebox.showwarning("Warning", "Select a story first!")
            return
        selected_story = stories[selection[0]]
        picker_win.destroy()
        
        root.after(0, lambda: status_label.config(text="Processing Reddit Story...", fg=WIN_TITLE))
        threading.Thread(target=process_gameplay_content, args=(selected_story, voice, is_short), daemon=True).start()

    picker_win = tk.Toplevel(root)
    picker_win.title("")
    picker_win.geometry("520x400")
    picker_win.configure(bg=WIN_FACE)
    
    t_bar = tk.Frame(picker_win, bg=WIN_TITLE, relief="raised", bd=1)
    t_bar.pack(fill=tk.X, padx=2, pady=2)
    tk.Label(t_bar, text=f" Select Story - r/{subreddit}", font=FONT_BOLD, bg=WIN_TITLE, fg=WIN_TEXT).pack(side=tk.LEFT)
    tk.Button(t_bar, text="X", font=("Arial", 8, "bold"), relief="raised", bd=2, bg=WIN_FACE, command=picker_win.destroy).pack(side=tk.RIGHT, padx=2, pady=2)
    
    frame_list = tk.Frame(picker_win, relief="sunken", bd=2, bg="#FFFFFF")
    frame_list.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)
    listbox = tk.Listbox(frame_list, width=70, height=12, font=FONT_MAIN, bg="#FFFFFF", fg=TEXT_COLOR, relief="flat")
    listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    
    for s in stories: listbox.insert(tk.END, s['title'])
    tk.Button(picker_win, text="OK", width=15, bg=WIN_FACE, font=FONT_BOLD, relief="raised", bd=2, command=on_select).pack(pady=10)

def on_generate(event=None):
    source = var_source.get()
    bg_style = var_bg_style.get()
    
    btn_generate.config(state=tk.DISABLED)
    btn_random_viral.config(state=tk.DISABLED) 
    update_progress(0)
    print("\n[System] Initialization started...")
    
    if source == "Reddit":
        sub = entry_topic.get().strip() or "AmItheAsshole"
        voice = combo_voice.get()
        is_short = var_format.get() == "Short"
        threading.Thread(target=open_reddit_picker, args=(sub, voice, is_short), daemon=True).start()
        return

    topic = entry_topic.get().strip()
    custom_kw = entry_custom_images.get().strip()
    do_web = var_web_img.get()
    do_ai = var_ai_img.get()
    is_short = (var_format.get() == "Short")
    sec_per_img_str = entry_scene_duration.get()
    img_count_str = entry_img_count.get()
    voice = combo_voice.get()
    
    if source == "Manual Script":
        manual_window = tk.Toplevel(root)
        manual_window.title("")
        manual_window.geometry("600x500")
        manual_window.configure(bg=WIN_FACE)
        
        t_bar = tk.Frame(manual_window, bg=WIN_TITLE, relief="raised", bd=1)
        t_bar.pack(fill=tk.X, padx=2, pady=2)
        tk.Label(t_bar, text=" Notepad ", font=FONT_BOLD, bg=WIN_TITLE, fg=WIN_TEXT).pack(side=tk.LEFT)
        
        def on_close_manual():
            manual_window.destroy()
            reset_buttons()
            
        tk.Button(t_bar, text="X", font=("Arial", 8, "bold"), relief="raised", bd=2, bg=WIN_FACE, command=on_close_manual).pack(side=tk.RIGHT, padx=2, pady=2)

        txt_frame = tk.Frame(manual_window, relief="sunken", bd=2, bg="#FFFFFF")
        txt_frame.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

        txt_area = tk.Text(txt_frame, wrap=tk.WORD, width=70, height=15, font=("Courier", 11), bg="#FFFFFF", relief="flat")
        txt_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        def start():
            content = txt_area.get("1.0", tk.END).strip()
            manual_window.destroy()
            print(f"[System] User provided manual script. Background Mode: {bg_style}")
            
            if bg_style == "Gameplay":
                threading.Thread(target=process_gameplay_content, args=(content, voice, is_short, custom_kw or "Manual_Video"), daemon=True).start()
            else:
                threading.Thread(target=process_content, args=(content, custom_kw, do_web, do_ai, is_short, sec_per_img_str, img_count_str, voice, "Manual_Video"), daemon=True).start()
            
        manual_window.protocol("WM_DELETE_WINDOW", on_close_manual)
        tk.Button(manual_window, text="Process", bg=WIN_FACE, fg=TEXT_COLOR, font=FONT_BOLD, relief="raised", bd=2, width=15, command=start).pack(pady=10)
        return

    if not topic:
        messagebox.showwarning("Warning", "Please enter a topic!")
        reset_buttons()
        return
        
    print(f"[Gemini] Writing script for topic: {topic}")
    def pipeline():
        try:
            update_progress(5)
            script = get_script(topic, entry_subtopics.get(), entry_minutes.get(), "Gemini")
            if script.startswith(("Error:", "AI Error:")):
                print(f"[Error] Gemini failed: {script}", file=sys.stderr)
                root.after(0, lambda: reset_buttons())
                return
            with open("generated_script.txt", "w", encoding="utf-8") as f:
                f.write(script)
                
            if bg_style == "Gameplay":
                process_gameplay_content(script, voice, is_short, topic)
            else:
                process_content(script, custom_kw, do_web, do_ai, is_short, sec_per_img_str, img_count_str, voice, topic)
                
        except Exception as e:
            print(f"[Error] Pipeline crashed: {str(e)}", file=sys.stderr)
            root.after(0, lambda: reset_buttons())
            
    threading.Thread(target=pipeline, daemon=True).start()

def get_duration_minutes():
    try: return max(1, int(entry_minutes.get()))
    except: return 10

def update_ui_visibility(*args):
    source = var_source.get()
    bg_style = var_bg_style.get()
    
    if source == "Reddit":
        for widget in [entry_subtopics, entry_custom_images, entry_img_count, entry_minutes, entry_scene_duration]:
            widget.config(state="disabled", bg=WIN_FACE)
        for widget in [check_web, check_ai]: widget.config(state="disabled")
        
        rb_bg_images.config(state="disabled")
        rb_bg_gameplay.config(state="disabled")
        btn_generate.config(text="FETCH REDDIT STORIES")
    else:
        rb_bg_images.config(state="normal")
        rb_bg_gameplay.config(state="normal")
        
        if bg_style == "Gameplay":
            
            for widget in [entry_custom_images, entry_img_count, entry_scene_duration]: widget.config(state="disabled", bg=WIN_FACE)
            for widget in [check_web, check_ai]: widget.config(state="disabled")
        else:
            for widget in [entry_custom_images, entry_img_count, entry_scene_duration]: widget.config(state="normal", bg="#FFFFFF")
            for widget in [check_web, check_ai]: widget.config(state="normal")
            
        if source == "Manual Script":
            entry_subtopics.config(state="disabled", bg=WIN_FACE)
            entry_minutes.config(state="disabled", bg=WIN_FACE)
            btn_generate.config(text="PASTE SCRIPT & GENERATE")
        else:
            entry_subtopics.config(state="normal", bg="#FFFFFF")
            entry_minutes.config(state="normal", bg="#FFFFFF")
            btn_generate.config(text="AI GENERATE VIDEO")

def on_find_trending():
    topic_input = entry_topic.get().strip()
    duration = get_duration_minutes()
    def fetch():
        if topic_input:
            print(f"[Trends] Finding trends for '{topic_input}'...")
            results = get_related(topic_input, duration_min=duration)
        else:
            print("[Trends] Finding trending topics globally...")
            results = get_trending(duration_min=duration)
            
        rss = results.get("rss", [])
        pytr = results.get("pytrends", [])
        if not rss and not pytr:
            print("[Trends] No topics found.", file=sys.stderr)
            return
            
        win = tk.Toplevel(root)
        win.title("")
        win.geometry("450x500")
        win.configure(bg=WIN_FACE)
        
        t_bar = tk.Frame(win, bg=WIN_TITLE, relief="raised", bd=1)
        t_bar.pack(fill=tk.X, padx=2, pady=2)
        tk.Label(t_bar, text=" Found Trends ", font=FONT_BOLD, bg=WIN_TITLE, fg=WIN_TEXT).pack(side=tk.LEFT)
        tk.Button(t_bar, text="X", font=("Arial", 8, "bold"), relief="raised", bd=2, bg=WIN_FACE, command=win.destroy).pack(side=tk.RIGHT, padx=2, pady=2)

        container = tk.Frame(win, bg=WIN_FACE, relief="sunken", bd=2)
        container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        def fill(t):
            win.destroy()
            entry_topic.delete(0, tk.END)
            entry_topic.insert(0, t)
            entry_subtopics.delete(0, tk.END)
            if topic_input: entry_subtopics.insert(0, topic_input)
            var_source.set("AI Documentary")
            update_ui_visibility()

        for t in rss_topics + pytrends_topics:
            tk.Button(container, text=t, font=FONT_MAIN, bg=WIN_FACE, relief="raised", bd=2, anchor="w", padx=10, command=lambda topic=t: fill(topic)).pack(fill=tk.X, padx=5, pady=3)
            
    threading.Thread(target=fetch, daemon=True).start()

def on_random_viral():
    format_choice = var_random_format.get()
    type_choice = var_random_type.get()
    
    btn_generate.config(state=tk.DISABLED)
    btn_random_viral.config(state=tk.DISABLED)
    update_progress(0)
    print("\n[AutoViral] Analyzing internet for trending concepts...")

    def fetch_and_propose():
        try:
            results = get_trending(duration_min=10)
            all_topics = results.get("rss", []) + results.get("pytrends", [])
            valid_topics = [t for t in all_topics if len(t) > 3]
            if not valid_topics: valid_topics = ["Elon Musk", "AI Future", "Space Exploration"]
            
            def propose_topic():
                proposed = random.choice(valid_topics)
                popup = tk.Toplevel(root)
                popup.geometry("450x220")
                popup.configure(bg=WIN_FACE)
                popup.attributes("-topmost", True)
                
                t_bar = tk.Frame(popup, bg=WIN_TITLE, relief="raised", bd=1)
                t_bar.pack(fill=tk.X, padx=2, pady=2)
                tk.Label(t_bar, text=" Viral Target ", font=FONT_BOLD, bg=WIN_TITLE, fg=WIN_TEXT).pack(side=tk.LEFT)
                
                tk.Label(popup, text=proposed, font=FONT_BOLD, fg=TEXT_COLOR, bg=WIN_FACE, wraplength=400).pack(pady=20)
                
                btn_frame = tk.Frame(popup, bg=WIN_FACE)
                btn_frame.pack(side=tk.BOTTOM, pady=15)
                tk.Button(btn_frame, text="Yes", bg=WIN_FACE, font=FONT_BOLD, relief="raised", bd=2, width=10, command=lambda: [popup.destroy(), execute_viral_pipeline(proposed, format_choice, type_choice)]).pack(side=tk.LEFT, padx=5)
                tk.Button(btn_frame, text="No", bg=WIN_FACE, font=FONT_BOLD, relief="raised", bd=2, width=10, command=lambda: [popup.destroy(), propose_topic()]).pack(side=tk.LEFT, padx=5)
                tk.Button(btn_frame, text="Cancel", bg=WIN_FACE, font=FONT_BOLD, relief="raised", bd=2, width=10, command=lambda: [popup.destroy(), reset_buttons()]).pack(side=tk.LEFT, padx=5)

            root.after(0, propose_topic)
        except Exception as e:
            print(f"[Error] {e}", file=sys.stderr)
            root.after(0, reset_buttons)

    threading.Thread(target=fetch_and_propose, daemon=True).start()

def execute_viral_pipeline(topic, format_choice, type_choice):
    print(f"\n[AutoViral] Generating {type_choice} about '{topic}'...")
    is_short = (format_choice == "9:16 Shorts")
    voice = combo_voice.get() 
    
    if type_choice == "Gameplay Video":
        def gameplay_pipeline():
            try:
                update_progress(5)
                script = get_script(topic, "Viral Storytelling style", "1", "Gemini")
                
                process_gameplay_content(script, voice, is_short, topic)
            except Exception as e: print(f"[Error] {e}", file=sys.stderr)
        threading.Thread(target=gameplay_pipeline, daemon=True).start()
    else:
        def doc_pipeline():
            try:
                update_progress(5)
                script = get_script(topic, "Quick Documentary summary", "1", "Gemini")
                with open("generated_script.txt", "w", encoding="utf-8") as f: f.write(script)
                process_content(script, topic, True, True, is_short, "4", "8", voice, topic)
            except Exception as e: print(f"[Error] {e}", file=sys.stderr)
        threading.Thread(target=doc_pipeline, daemon=True).start()

# ==========================================
# GUI SETUP (WIN 95 THEME)
# ==========================================
def create_groupbox(parent, title_text):
    lf = tk.LabelFrame(parent, text=f" {title_text} ", font=FONT_MAIN, bg=WIN_FACE, fg=TEXT_COLOR, relief="groove", bd=2)
    content_area = tk.Frame(lf, bg=WIN_FACE)
    content_area.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)
    return lf, content_area

def create_pixel_radio(parent, text, var, val, cmd=None):
    return tk.Radiobutton(parent, text=text, variable=var, value=val, command=cmd, font=FONT_MAIN, bg=WIN_FACE, activebackground=WIN_FACE, fg=TEXT_COLOR, relief="flat", highlightthickness=0)

def create_pixel_check(parent, text, var):
    return tk.Checkbutton(parent, text=text, variable=var, font=FONT_MAIN, bg=WIN_FACE, activebackground=WIN_FACE, fg=TEXT_COLOR, relief="flat", highlightthickness=0)

root = tk.Tk()
root.title("Auto Content Engine Pro")
root.geometry("1100x950")
root.configure(bg=BG_DESKTOP)
style = ttk.Style()
style.theme_use('classic')

app_win = tk.Frame(root, bg=WIN_FACE, relief="raised", bd=3)
app_win.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.96, relheight=0.96)

t_bar = tk.Frame(app_win, bg=WIN_TITLE)
t_bar.pack(fill=tk.X, padx=2, pady=2)
tk.Label(t_bar, text=" Auto Content Engine Pro", font=FONT_BOLD, bg=WIN_TITLE, fg=WIN_TEXT).pack(side=tk.LEFT, pady=2)
tk.Button(t_bar, text="X", font=("Arial", 8, "bold"), relief="raised", bd=2, bg=WIN_FACE, padx=4, pady=0, command=root.quit).pack(side=tk.RIGHT, padx=2, pady=2)

m_bar = tk.Frame(app_win, bg=WIN_FACE, relief="raised", bd=1)
m_bar.pack(fill=tk.X)
tk.Label(m_bar, text="File   Edit   View   Help", font=FONT_MAIN, bg=WIN_FACE, fg=TEXT_COLOR).pack(side=tk.LEFT, padx=5, pady=2)
tk.Button(m_bar, text="[ REBOOT SYSTEM ]", font=FONT_BOLD, bg=WIN_FACE, fg="#800000", relief="raised", bd=2, command=hard_reset_app).pack(side=tk.RIGHT, padx=5, pady=2)

main_content = tk.Frame(app_win, bg=WIN_FACE)
main_content.pack(fill=tk.X, padx=10, pady=(10, 0))

main_content.columnconfigure(0, weight=1)
main_content.columnconfigure(1, weight=1)
main_content.columnconfigure(2, weight=1)


col1_panel, col1 = create_groupbox(main_content, "Settings.exe")
col1_panel.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)
tk.Label(col1, text="Text Source:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
var_source = tk.StringVar(value="AI Documentary")
create_pixel_radio(col1, "AI Script", var_source, "AI Documentary", update_ui_visibility).pack(anchor="w", pady=2)
create_pixel_radio(col1, "Reddit Story", var_source, "Reddit", update_ui_visibility).pack(anchor="w", pady=2)
create_pixel_radio(col1, "Manual Script", var_source, "Manual Script", update_ui_visibility).pack(anchor="w", pady=2)
tk.Label(col1, text="Video Format:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w", pady=(10, 2))
var_format = tk.StringVar(value="Short")
create_pixel_radio(col1, "Vertical (9:16)", var_format, "Short").pack(anchor="w", pady=2)
create_pixel_radio(col1, "Horizontal (16:9)", var_format, "Long").pack(anchor="w", pady=2)
frame_durations = tk.Frame(col1, bg=WIN_FACE)
frame_durations.pack(fill=tk.X, pady=(10, 0))
tk.Label(frame_durations, text="Duration (min):", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).grid(row=0, column=0, sticky="w", pady=2)
entry_minutes = tk.Entry(frame_durations, font=FONT_MAIN, bg="#FFFFFF", fg=TEXT_COLOR, relief="sunken", bd=2, width=8); entry_minutes.insert(0, "10"); entry_minutes.grid(row=0, column=1, padx=5, pady=2)
tk.Label(frame_durations, text="Secs per Image:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).grid(row=1, column=0, sticky="w", pady=2)
entry_scene_duration = tk.Entry(frame_durations, font=FONT_MAIN, bg="#FFFFFF", fg=TEXT_COLOR, relief="sunken", bd=2, width=8); entry_scene_duration.insert(0, "4"); entry_scene_duration.grid(row=1, column=1, padx=5, pady=2)


col2_panel, col2 = create_groupbox(main_content, "Content.dll")
col2_panel.grid(row=0, column=1, sticky="nsew", padx=5, pady=5)
tk.Label(col2, text="Main Topic / Subject:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
topic_frame = tk.Frame(col2, bg=WIN_FACE)
topic_frame.pack(fill=tk.X, pady=(2, 10))
entry_topic = tk.Entry(topic_frame, font=FONT_MAIN, bg="#FFFFFF", relief="sunken", bd=2)
entry_topic.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
tk.Button(topic_frame, text="Trends", bg=WIN_FACE, fg=TEXT_COLOR, font=FONT_BOLD, relief="raised", bd=2, command=on_find_trending).pack(side=tk.RIGHT)
tk.Label(col2, text="Subtopics (Doc only):", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
entry_subtopics = tk.Entry(col2, font=FONT_MAIN, bg="#FFFFFF", relief="sunken", bd=2); entry_subtopics.pack(fill=tk.X, pady=(2, 10))
tk.Label(col2, text="Custom Keywords:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
entry_custom_images = tk.Entry(col2, font=FONT_MAIN, bg="#FFFFFF", relief="sunken", bd=2); entry_custom_images.pack(fill=tk.X, pady=(2, 5))
tk.Label(col2, text="Images to Gen:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w", pady=(10, 2))
entry_img_count = tk.Entry(col2, font=FONT_MAIN, bg="#FFFFFF", relief="sunken", bd=2); entry_img_count.insert(0, "10"); entry_img_count.pack(fill=tk.X, pady=(2, 5))


col3_panel, col3 = create_groupbox(main_content, "Render.bat")
col3_panel.grid(row=0, column=2, sticky="nsew", padx=5, pady=5)


tk.Label(col3, text="Background Style:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w", pady=(0, 2))
var_bg_style = tk.StringVar(value="Images")
rb_bg_images = create_pixel_radio(col3, "🖼️ Images (Ken Burns)", var_bg_style, "Images", update_ui_visibility)
rb_bg_images.pack(anchor="w")
rb_bg_gameplay = create_pixel_radio(col3, "🎮 Gameplay Video", var_bg_style, "Gameplay", update_ui_visibility)
rb_bg_gameplay.pack(anchor="w", pady=(0, 10))


tk.Label(col3, text="Voice Actor:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
combo_voice = ttk.Combobox(col3, values=list(VOICE_PRESETS.keys()), state="readonly", font=FONT_MAIN); combo_voice.set("🇺🇸 AM - Michael (Deep/News)"); combo_voice.pack(fill=tk.X, pady=(2, 15))

tk.Label(col3, text="Image Settings:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
var_web_img = tk.BooleanVar(value=True); var_ai_img = tk.BooleanVar(value=True)
check_web = create_pixel_check(col3, "Scrape Web Images", var_web_img)
check_web.pack(anchor="w")
check_ai = create_pixel_check(col3, "Generate AI Images", var_ai_img)
check_ai.pack(anchor="w", pady=(0, 15))

btn_generate = tk.Button(col3, text="EXECUTE", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR, cursor="hand2", relief="raised", bd=2, pady=10, command=on_generate)
btn_generate.pack(fill=tk.X, side=tk.BOTTOM)


q_panel, q_frame = create_groupbox(app_win, "BatchManager.exe (Night Shift)")
q_panel.pack(fill=tk.X, padx=15, pady=(5, 5))

queue_listbox = tk.Listbox(q_frame, height=3, font=("Courier", 10), bg="#FFFFFF", fg=TEXT_COLOR, relief="sunken", bd=2)
queue_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))

btn_q_frame = tk.Frame(q_frame, bg=WIN_FACE)
btn_q_frame.pack(side=tk.RIGHT)
btn_add_q = tk.Button(btn_q_frame, text="Add Current To Queue", font=FONT_BOLD, bg=WIN_FACE, relief="raised", bd=2, width=20, command=add_to_queue)
btn_add_q.pack(pady=(0, 2))
btn_start_q = tk.Button(btn_q_frame, text="Start Night Shift", font=FONT_BOLD, bg=WIN_FACE, fg="#000080", relief="raised", bd=2, width=20, command=start_batch)
btn_start_q.pack(pady=(0, 2))
btn_clear_q = tk.Button(btn_q_frame, text="Clear Queue", font=FONT_MAIN, bg=WIN_FACE, relief="raised", bd=2, width=20, command=clear_queue)
btn_clear_q.pack()


viral_panel, viral_frame = create_groupbox(app_win, "AutoViral System")
viral_panel.pack(fill=tk.X, padx=15, pady=(0, 5))
var_random_format = tk.StringVar(value="9:16 Shorts")
create_pixel_radio(viral_frame, "9:16 Shorts", var_random_format, "9:16 Shorts").pack(side=tk.LEFT, padx=10)
create_pixel_radio(viral_frame, "16:9 YouTube", var_random_format, "16:9 YouTube").pack(side=tk.LEFT, padx=10)
var_random_type = tk.StringVar(value="Documentary (Images)")
create_pixel_radio(viral_frame, "Documentary", var_random_type, "Documentary (Images)").pack(side=tk.LEFT, padx=10)
create_pixel_radio(viral_frame, "Gameplay", var_random_type, "Gameplay Video").pack(side=tk.LEFT, padx=10)
btn_random_viral = tk.Button(viral_frame, text="1-CLICK VIRAL", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR, relief="raised", bd=2, cursor="hand2", pady=5, padx=20, command=on_random_viral)
btn_random_viral.pack(side=tk.RIGHT)


console_panel, console_frame = create_groupbox(app_win, "C:\\MS-DOS Prompt")
console_panel.pack(fill=tk.BOTH, expand=True, padx=15, pady=(0, 10))
console_text = tk.Text(console_frame, bg="black", fg="#C0C0C0", font=("Courier", 10, "bold"), relief="sunken", bd=2, state=tk.DISABLED)
console_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

console_text.tag_config("error", foreground="#FF6B6B")

scroll = tk.Scrollbar(console_frame, command=console_text.yview)
scroll.pack(side=tk.RIGHT, fill=tk.Y)
console_text.config(yscrollcommand=scroll.set)

sys.stdout = RedirectText(console_text)
sys.stderr = RedirectText(console_text, tag="error") 

print("Microsoft(R) Windows 95")
print("   (C)Copyright Microsoft Corp 1981-1996.")
print("\nC:\\ACE_PRO> System ready.")


progress_frame = tk.Frame(app_win, bg=WIN_FACE)
progress_frame.pack(fill=tk.X, padx=15, pady=(0, 5))
tk.Label(progress_frame, text="Processing... ", font=FONT_MAIN, bg=WIN_FACE, fg=TEXT_COLOR).pack(side=tk.LEFT)
progress_bar = Win95ProgressBar(progress_frame, height=20)
progress_bar.pack(side=tk.LEFT, fill=tk.X, expand=True)

status_bar = tk.Frame(app_win, bg=WIN_FACE, relief="sunken", bd=1)
status_bar.pack(fill=tk.X, side=tk.BOTTOM, padx=2, pady=2)
status_label = tk.Label(status_bar, text="Ready", font=FONT_MAIN, bg=WIN_FACE, fg=TEXT_COLOR, anchor="w", padx=5)
status_label.pack(fill=tk.X)

update_ui_visibility()
root.bind('<Return>', on_generate)
root.mainloop()