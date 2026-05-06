import tkinter as tk
from tkinter import messagebox, ttk
import os
import threading
import random

from script_gen.generator import get_script
from voice_gen.kokoro_narration import generate_voice, VOICE_PRESETS
from voice_gen.subtitles import generate_srt_from_chunks
from video_edit.editor import create_video as create_doc_video
from trend_finder.trends import get_trending, get_related
from video_edit.downloader import prepare_assets

from shorts_gen.reddit import get_reddit_stories, format_story_for_tts
from shorts_gen.editor import create_video as create_gameplay_video

BG_DESKTOP = "#008080"
WIN_FACE = "#C0C0C0"
WIN_TITLE = "#000080"
WIN_TEXT = "#FFFFFF"
TEXT_COLOR = "#000000"

FONT_MAIN = ("W95FA", 10)
FONT_BOLD = ("W95FA", 10, "bold")

def cleanup_old_assets():
    files_to_delete = ["video_final.wav", "video_final.mp3", "generated_script.txt",
                       "final_video.mp4", "subtitles.srt", "temp_no_subs.mp4",
                       "short_audio.wav", "short_subs.srt", "final_tiktok.mp4", "final_youtube.mp4"]
    for file in files_to_delete:
        if os.path.exists(file):
            os.remove(file)

def process_content(text, custom_keywords, do_web, do_ai, is_short, sec_per_img_str, img_count_str, voice):
    if not text.strip():
        root.after(0, lambda: messagebox.showwarning("Warning", "The script is empty!"))
        return
    try:
        cleanup_old_assets()
        try:
            sec_per_img = max(2, int(sec_per_img_str))
        except:
            sec_per_img = 5
            
        try:
            img_count = max(1, int(img_count_str))
        except:
            img_count = 5
        
        if do_web or do_ai:
            root.after(0, lambda: messagebox.showinfo("Status", f"Fetching/Generating {img_count} images...\nThis will take a moment."))
            prepare_assets(text, use_web=do_web, use_ai=do_ai, custom_keywords=custom_keywords, image_count=img_count, is_short=is_short)
        
        root.after(0, lambda: status_label.config(text="Generating Audio with Kokoro TTS...", fg=WIN_TITLE))
        selected_voice = voice if voice in VOICE_PRESETS else "🇺🇸 AM - Michael (Deep/News)"
        
        audio_path, chunk_timings = generate_voice(text, output_path="video_final.wav", preset=selected_voice)
        if not audio_path:
            root.after(0, lambda: messagebox.showerror("Error", "Audio generation failed!"))
            return
            
        srt_path = None
        if chunk_timings:
            srt_path = generate_srt_from_chunks(chunk_timings, output_srt="subtitles.srt")
            
        root.after(0, lambda: status_label.config(text="Rendering cinematic video...", fg=WIN_TITLE))
        create_doc_video(srt_path=srt_path, is_short=is_short, scene_duration=sec_per_img)
        
        root.after(0, lambda: messagebox.showinfo("Success", "Video generated successfully! Check final_video.mp4"))
        root.after(0, lambda: status_label.config(text="Ready", fg=TEXT_COLOR))
    except Exception as e:
        root.after(0, lambda: messagebox.showerror("Error", f"Processing failed: {str(e)}"))
        root.after(0, lambda: status_label.config(text="Failed", fg="red"))
    finally:
        root.after(0, lambda: reset_buttons())

def process_reddit_content(story, voice, is_short):
    try:
        cleanup_old_assets()
        script = format_story_for_tts(story)
        
        root.after(0, lambda: status_label.config(text="Generating Voice & Subtitles...", fg=WIN_TITLE))
        audio_path, chunk_timings = generate_voice(script, output_path="short_audio.wav", preset=voice)
        srt_path = generate_srt_from_chunks(chunk_timings, output_srt="short_subs.srt")
        
        root.after(0, lambda: status_label.config(text="Rendering Gameplay Video...", fg=WIN_TITLE))
        bg_video = "assets/background.mp4"
        out_name = "final_tiktok.mp4" if is_short else "final_youtube.mp4"
        
        success, msg = create_gameplay_video(audio_path, srt_path, bg_video_path=bg_video, output_path=out_name, is_short=is_short)
        
        if success:
            root.after(0, lambda: messagebox.showinfo("Success", f"Video successfully rendered as {out_name}!"))
            root.after(0, lambda: status_label.config(text="Ready", fg=TEXT_COLOR))
        else:
            root.after(0, lambda: messagebox.showerror("Render Error", msg))
            root.after(0, lambda: status_label.config(text="Failed", fg="red"))
            
    except Exception as e:
        root.after(0, lambda: messagebox.showerror("Error", f"Reddit pipeline failed: {str(e)}"))
        root.after(0, lambda: status_label.config(text="Failed", fg="red"))
    finally:
        root.after(0, lambda: reset_buttons())

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
        threading.Thread(target=process_reddit_content, args=(selected_story, voice, is_short), daemon=True).start()

    def on_close():
        picker_win.destroy()
        root.after(0, lambda: reset_buttons())

    picker_win = tk.Toplevel(root)
    picker_win.title("")
    picker_win.geometry("520x400")
    picker_win.configure(bg=WIN_FACE)
    picker_win.protocol("WM_DELETE_WINDOW", on_close)
    
    t_bar = tk.Frame(picker_win, bg=WIN_TITLE, relief="raised", bd=1)
    t_bar.pack(fill=tk.X, padx=2, pady=2)
    tk.Label(t_bar, text=f" Select Story - r/{subreddit}", font=FONT_BOLD, bg=WIN_TITLE, fg=WIN_TEXT).pack(side=tk.LEFT)
    tk.Button(t_bar, text="X", font=("Arial", 8, "bold"), relief="raised", bd=2, bg=WIN_FACE, command=on_close).pack(side=tk.RIGHT, padx=2, pady=2)
    
    frame_list = tk.Frame(picker_win, relief="sunken", bd=2, bg="#FFFFFF")
    frame_list.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)
    
    listbox = tk.Listbox(frame_list, width=70, height=12, font=FONT_MAIN, bg="#FFFFFF", fg=TEXT_COLOR, relief="flat")
    listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    
    scrollbar = tk.Scrollbar(frame_list, orient="vertical", command=listbox.yview)
    scrollbar.pack(side=tk.RIGHT, fill="y")
    listbox.config(yscrollcommand=scrollbar.set)
    
    for s in stories:
        listbox.insert(tk.END, s['title'])
        
    tk.Button(picker_win, text="OK", width=15, bg=WIN_FACE, fg=TEXT_COLOR, font=FONT_BOLD, relief="raised", bd=2, command=on_select).pack(pady=10)

def get_duration_minutes():
    try:
        return max(1, int(entry_minutes.get()))
    except:
        return 10

def update_ui_visibility(*args):
    source = var_source.get()
    
    if source == "Reddit":
        for widget in [entry_subtopics, entry_custom_images, entry_img_count, entry_minutes, entry_scene_duration]:
            widget.config(state="disabled", bg=WIN_FACE)
        for widget in [check_web, check_ai]:
            widget.config(state="disabled")
        
        lbl_topic.config(text="Subreddit Name (no r/):")
        btn_generate.config(text="Fetch Reddit Stories")
        btn_trends.pack_forget() 
        
    elif source == "Manual Script":
        for widget in [entry_custom_images, entry_img_count, entry_scene_duration]:
            widget.config(state="normal", bg="#FFFFFF")
        entry_subtopics.config(state="disabled", bg=WIN_FACE)
        entry_minutes.config(state="disabled", bg=WIN_FACE)
        for widget in [check_web, check_ai]:
            widget.config(state="normal")
        
        lbl_topic.config(text="Project Title (Optional):")
        btn_generate.config(text="Paste Script & Generate")
        btn_trends.pack_forget()
        
    else: 
        for widget in [entry_subtopics, entry_custom_images, entry_img_count, entry_minutes, entry_scene_duration]:
            widget.config(state="normal", bg="#FFFFFF")
        for widget in [check_web, check_ai]:
            widget.config(state="normal")
        
        lbl_topic.config(text="Main Topic / Subject:")
        btn_generate.config(text="AI Generate Video")
        btn_trends.pack(side=tk.RIGHT, padx=5) 

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
    win.title("")
    win.geometry("450x500")
    win.configure(bg=WIN_FACE)
    
    t_bar = tk.Frame(win, bg=WIN_TITLE, relief="raised", bd=1)
    t_bar.pack(fill=tk.X, padx=2, pady=2)
    tk.Label(t_bar, text=" Found Trends ", font=FONT_BOLD, bg=WIN_TITLE, fg=WIN_TEXT).pack(side=tk.LEFT)
    tk.Button(t_bar, text="X", font=("Arial", 8, "bold"), relief="raised", bd=2, bg=WIN_FACE, command=win.destroy).pack(side=tk.RIGHT, padx=2, pady=2)

    container = tk.Frame(win, bg=WIN_FACE, relief="sunken", bd=2)
    container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

    if rss_topics:
        for t in rss_topics:
            tk.Button(container, text=t, font=FONT_MAIN, bg=WIN_FACE, relief="raised", bd=2, anchor="w", padx=10, command=lambda topic=t: autofill_topic(topic, original_topic, win)).pack(fill=tk.X, padx=5, pady=3)
    if pytrends_topics:
        for t in pytrends_topics:
            tk.Button(container, text=t, font=FONT_MAIN, bg=WIN_FACE, relief="raised", bd=2, anchor="w", padx=10, command=lambda topic=t: autofill_topic(topic, original_topic, win)).pack(fill=tk.X, padx=5, pady=3)

def autofill_topic(selected_topic, original_topic, popup):
    popup.destroy()
    entry_topic.delete(0, tk.END)
    entry_topic.insert(0, selected_topic)
    entry_subtopics.delete(0, tk.END)
    if original_topic:
        entry_subtopics.insert(0, original_topic)
    var_source.set("AI Documentary")
    update_ui_visibility()

def on_random_viral():
    format_choice = var_random_format.get()
    type_choice = var_random_type.get()
    
    btn_generate.config(state=tk.DISABLED)
    btn_random_viral.config(state=tk.DISABLED)
    status_label.config(text="Analyzing current internet trends...", fg=WIN_TITLE)

    def fetch_and_propose():
        try:
            results = get_trending(duration_min=10)
            all_topics = results.get("rss", []) + results.get("pytrends", [])
            valid_topics = [t for t in all_topics if len(t) > 3]
            
            if not valid_topics:
                valid_topics = ["Elon Musk Latest News", "Artificial Intelligence Future", "Weird History Facts", "Space Exploration"]
            
            def propose_topic():
                proposed = random.choice(valid_topics)
                
                popup = tk.Toplevel(root)
                popup.title("")
                popup.geometry("450x220")
                popup.configure(bg=WIN_FACE)
                popup.attributes("-topmost", True)
                
                t_bar = tk.Frame(popup, bg=WIN_TITLE, relief="raised", bd=1)
                t_bar.pack(fill=tk.X, padx=2, pady=2)
                tk.Label(t_bar, text=" Viral Target ", font=FONT_BOLD, bg=WIN_TITLE, fg=WIN_TEXT).pack(side=tk.LEFT)
                
                tk.Label(popup, text=proposed, font=FONT_BOLD, fg=TEXT_COLOR, bg=WIN_FACE, wraplength=400).pack(pady=20)
                
                def accept():
                    popup.destroy()
                    execute_viral_pipeline(proposed, format_choice, type_choice)
                def reject():
                    popup.destroy()
                    propose_topic() 
                def cancel():
                    popup.destroy()
                    reset_buttons()

                btn_frame = tk.Frame(popup, bg=WIN_FACE)
                btn_frame.pack(side=tk.BOTTOM, pady=15)
                
                tk.Button(btn_frame, text="Yes", bg=WIN_FACE, font=FONT_BOLD, relief="raised", bd=2, width=10, command=accept).pack(side=tk.LEFT, padx=5)
                tk.Button(btn_frame, text="No", bg=WIN_FACE, font=FONT_BOLD, relief="raised", bd=2, width=10, command=reject).pack(side=tk.LEFT, padx=5)
                tk.Button(btn_frame, text="Cancel", bg=WIN_FACE, font=FONT_BOLD, relief="raised", bd=2, width=10, command=cancel).pack(side=tk.LEFT, padx=5)

            root.after(0, propose_topic)
        except Exception as e:
            root.after(0, lambda: messagebox.showerror("Error", f"Failed to fetch trends: {e}"))
            root.after(0, lambda: reset_buttons())

    threading.Thread(target=fetch_and_propose, daemon=True).start()

def execute_viral_pipeline(topic, format_choice, type_choice):
    status_label.config(text=f"Generating Viral {type_choice} for '{topic}'...", fg=WIN_TITLE)
    is_short = (format_choice == "9:16 Shorts")
    voice = combo_voice.get() 
    
    if type_choice == "Gameplay Video":
        def gameplay_pipeline():
            try:
                script = get_script(topic, "Viral Storytelling style", "1", "Gemini")
                if script.startswith(("Error:", "AI Error:")):
                    root.after(0, lambda: messagebox.showerror("AI Error", script))
                    root.after(0, lambda: reset_buttons())
                    return
                fake_reddit_story = {'title': topic, 'selftext': script, 'body': script}
                process_reddit_content(fake_reddit_story, voice, is_short)
            except Exception as e:
                root.after(0, lambda: messagebox.showerror("Pipeline Error", f"Viral gameplay failed: {e}"))
                root.after(0, lambda: reset_buttons())
        threading.Thread(target=gameplay_pipeline, daemon=True).start()
        
    else:
        def doc_pipeline():
            try:
                script = get_script(topic, "Quick Documentary summary", "1", "Gemini")
                if script.startswith(("Error:", "AI Error:")):
                    root.after(0, lambda: messagebox.showerror("AI Error", script))
                    root.after(0, lambda: reset_buttons())
                    return
                with open("generated_script.txt", "w", encoding="utf-8") as f:
                    f.write(script)
                process_content(script, custom_keywords=topic, do_web=True, do_ai=True, is_short=is_short, sec_per_img_str="4", img_count_str="8", voice=voice)
            except Exception as e:
                root.after(0, lambda: messagebox.showerror("Pipeline Error", f"Viral doc failed: {e}"))
                root.after(0, lambda: reset_buttons())
        threading.Thread(target=doc_pipeline, daemon=True).start()

def reset_buttons():
    btn_generate.config(state=tk.NORMAL)
    btn_random_viral.config(state=tk.NORMAL)
    status_label.config(text="Ready", fg=TEXT_COLOR)

def on_generate(event=None):
    source = var_source.get()
    btn_generate.config(state=tk.DISABLED)
    btn_random_viral.config(state=tk.DISABLED) 
    
    if source == "Reddit":
        sub = entry_topic.get().strip() or "AmItheAsshole"
        voice = combo_voice.get()
        is_short = var_format.get() == "Short"
        threading.Thread(target=open_reddit_picker, args=(sub, voice, is_short), daemon=True).start()
        return

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
        tk.Button(t_bar, text="X", font=("Arial", 8, "bold"), relief="raised", bd=2, bg=WIN_FACE, command=manual_window.destroy).pack(side=tk.RIGHT, padx=2, pady=2)

        txt_frame = tk.Frame(manual_window, relief="sunken", bd=2, bg="#FFFFFF")
        txt_frame.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

        txt_area = tk.Text(txt_frame, wrap=tk.WORD, width=70, height=15, font=("Courier", 11), bg="#FFFFFF", relief="flat")
        txt_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        scrollbar = tk.Scrollbar(txt_frame, orient="vertical", command=txt_area.yview)
        scrollbar.pack(side=tk.RIGHT, fill="y")
        txt_area.config(yscrollcommand=scrollbar.set)
        
        def start():
            content = txt_area.get("1.0", tk.END).strip()
            manual_window.destroy()
            threading.Thread(target=process_content, args=(content, custom_kw, do_web, do_ai, is_short, sec_per_img_str, img_count_str, voice), daemon=True).start()
        
        def on_close_manual():
            manual_window.destroy()
            reset_buttons()
            
        manual_window.protocol("WM_DELETE_WINDOW", on_close_manual)
        tk.Button(manual_window, text="Process", bg=WIN_FACE, fg=TEXT_COLOR, font=FONT_BOLD, relief="raised", bd=2, width=15, command=start).pack(pady=10)
        return

    topic = entry_topic.get()
    if not topic:
        messagebox.showwarning("Warning", "Please enter a topic!")
        reset_buttons()
        return
        
    status_label.config(text="AI is writing the script...", fg=WIN_TITLE)
    def pipeline():
        try:
            script = get_script(topic, entry_subtopics.get(), entry_minutes.get(), "Gemini")
            if script.startswith(("Error:", "AI Error:")):
                root.after(0, lambda: messagebox.showerror("Error", script))
                root.after(0, lambda: reset_buttons())
                return
            with open("generated_script.txt", "w", encoding="utf-8") as f:
                f.write(script)
            process_content(script, custom_kw, do_web, do_ai, is_short, sec_per_img_str, img_count_str, voice)
        except Exception as e:
            root.after(0, lambda: messagebox.showerror("Error", f"Failed: {str(e)}"))
            root.after(0, lambda: reset_buttons())
    threading.Thread(target=pipeline, daemon=True).start()

def create_groupbox(parent, title_text):
    lf = tk.LabelFrame(parent, text=f" {title_text} ", font=FONT_MAIN, bg=WIN_FACE, fg=TEXT_COLOR, relief="groove", bd=2)
    content_area = tk.Frame(lf, bg=WIN_FACE)
    content_area.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)
    return lf, content_area

def create_pixel_entry(parent):
    return tk.Entry(parent, font=FONT_MAIN, bg="#FFFFFF", fg=TEXT_COLOR, relief="sunken", bd=2, insertbackground=TEXT_COLOR)

def create_pixel_radio(parent, text, var, val, cmd=None):
    return tk.Radiobutton(parent, text=text, variable=var, value=val, command=cmd, font=FONT_MAIN, bg=WIN_FACE, activebackground=WIN_FACE, fg=TEXT_COLOR, relief="flat", highlightthickness=0)

def create_pixel_check(parent, text, var):
    return tk.Checkbutton(parent, text=text, variable=var, font=FONT_MAIN, bg=WIN_FACE, activebackground=WIN_FACE, fg=TEXT_COLOR, relief="flat", highlightthickness=0)

root = tk.Tk()
root.title("Auto Content Engine Pro")
root.geometry("1100x800")
root.configure(bg=BG_DESKTOP)

style = ttk.Style()
style.theme_use('classic')

app_win = tk.Frame(root, bg=WIN_FACE, relief="raised", bd=3)
app_win.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.95, relheight=0.90)

t_bar = tk.Frame(app_win, bg=WIN_TITLE)
t_bar.pack(fill=tk.X, padx=2, pady=2)
tk.Label(t_bar, text=" Auto Content Engine Pro", font=FONT_BOLD, bg=WIN_TITLE, fg=WIN_TEXT).pack(side=tk.LEFT, pady=2)
tk.Button(t_bar, text="X", font=("Arial", 8, "bold"), relief="raised", bd=2, bg=WIN_FACE, padx=4, pady=0, command=root.quit).pack(side=tk.RIGHT, padx=2, pady=2)

m_bar = tk.Frame(app_win, bg=WIN_FACE, relief="raised", bd=1)
m_bar.pack(fill=tk.X)
tk.Label(m_bar, text="File   Edit   View   Help", font=FONT_MAIN, bg=WIN_FACE, fg=TEXT_COLOR).pack(side=tk.LEFT, padx=5, pady=2)

main_content = tk.Frame(app_win, bg=WIN_FACE)
main_content.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

main_content.columnconfigure(0, weight=1)
main_content.columnconfigure(1, weight=1)
main_content.columnconfigure(2, weight=1)

col1_panel, col1 = create_groupbox(main_content, "Settings")
col1_panel.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)

tk.Label(col1, text="Text Source:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
var_source = tk.StringVar(value="AI Documentary")
create_pixel_radio(col1, "AI Script", var_source, "AI Documentary", update_ui_visibility).pack(anchor="w", pady=2)
create_pixel_radio(col1, "Reddit Story", var_source, "Reddit", update_ui_visibility).pack(anchor="w", pady=2)
create_pixel_radio(col1, "Manual Script", var_source, "Manual Script", update_ui_visibility).pack(anchor="w", pady=2)

tk.Label(col1, text="Video Format:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w", pady=(15, 2))
var_format = tk.StringVar(value="Short")
create_pixel_radio(col1, "Vertical (9:16)", var_format, "Short").pack(anchor="w", pady=2)
create_pixel_radio(col1, "Horizontal (16:9)", var_format, "Long").pack(anchor="w", pady=2)

frame_durations = tk.Frame(col1, bg=WIN_FACE)
frame_durations.pack(fill=tk.X, pady=(15, 0))
tk.Label(frame_durations, text="Duration (min):", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).grid(row=0, column=0, sticky="w", pady=2)
entry_minutes = create_pixel_entry(frame_durations)
entry_minutes.config(width=8)
entry_minutes.insert(0, "10")
entry_minutes.grid(row=0, column=1, padx=5, pady=2)

tk.Label(frame_durations, text="Secs per Image:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).grid(row=1, column=0, sticky="w", pady=2)
entry_scene_duration = create_pixel_entry(frame_durations)
entry_scene_duration.config(width=8)
entry_scene_duration.insert(0, "4")
entry_scene_duration.grid(row=1, column=1, padx=5, pady=2)

col2_panel, col2 = create_groupbox(main_content, "Content")
col2_panel.grid(row=0, column=1, sticky="nsew", padx=5, pady=5)

lbl_topic = tk.Label(col2, text="Main Topic / Subject:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR)
lbl_topic.pack(anchor="w")
topic_frame = tk.Frame(col2, bg=WIN_FACE)
topic_frame.pack(fill=tk.X, pady=(2, 10))
entry_topic = create_pixel_entry(topic_frame)
entry_topic.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
btn_trends = tk.Button(topic_frame, text="Trends", bg=WIN_FACE, fg=TEXT_COLOR, font=FONT_BOLD, relief="raised", bd=2, command=on_find_trending)
btn_trends.pack(side=tk.RIGHT)

tk.Label(col2, text="Subtopics (Doc only):", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
entry_subtopics = create_pixel_entry(col2)
entry_subtopics.pack(fill=tk.X, pady=(2, 15))

tk.Label(col2, text="Custom Keywords:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
entry_custom_images = create_pixel_entry(col2)
entry_custom_images.pack(fill=tk.X, pady=(2, 5))

tk.Label(col2, text="Images to Gen:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w", pady=(15, 2))
entry_img_count = create_pixel_entry(col2)
entry_img_count.insert(0, "10") 
entry_img_count.pack(fill=tk.X, pady=(2, 5))

col3_panel, col3 = create_groupbox(main_content, "Render")
col3_panel.grid(row=0, column=2, sticky="nsew", padx=5, pady=5)

tk.Label(col3, text="Voice Actor:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
combo_voice = ttk.Combobox(col3, values=list(VOICE_PRESETS.keys()), state="readonly", font=FONT_MAIN)
combo_voice.set("🇺🇸 AM - Michael (Deep/News)")
combo_voice.pack(fill=tk.X, pady=(2, 20))

tk.Label(col3, text="Background Assets:", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR).pack(anchor="w")
var_web_img = tk.BooleanVar(value=True)
var_ai_img = tk.BooleanVar(value=True)
check_web = create_pixel_check(col3, "Scrape Web Images", var_web_img)
check_web.pack(anchor="w")
check_ai = create_pixel_check(col3, "Generate AI Images", var_ai_img)
check_ai.pack(anchor="w", pady=(0, 30))

btn_generate = tk.Button(col3, text="EXECUTE", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR, cursor="hand2", relief="raised", bd=2, pady=10, command=on_generate)
btn_generate.pack(fill=tk.X, side=tk.BOTTOM)

viral_panel, viral_frame = create_groupbox(app_win, "AutoViral System")
viral_panel.pack(fill=tk.X, padx=15, pady=(0, 10))

var_random_format = tk.StringVar(value="9:16 Shorts")
create_pixel_radio(viral_frame, "9:16 Shorts", var_random_format, "9:16 Shorts").pack(side=tk.LEFT, padx=10)
create_pixel_radio(viral_frame, "16:9 YouTube", var_random_format, "16:9 YouTube").pack(side=tk.LEFT, padx=10)

var_random_type = tk.StringVar(value="Documentary (Images)")
create_pixel_radio(viral_frame, "Documentary", var_random_type, "Documentary (Images)").pack(side=tk.LEFT, padx=10)
create_pixel_radio(viral_frame, "Gameplay", var_random_type, "Gameplay Video").pack(side=tk.LEFT, padx=10)

btn_random_viral = tk.Button(viral_frame, text="1-CLICK VIRAL", font=FONT_BOLD, bg=WIN_FACE, fg=TEXT_COLOR, relief="raised", bd=2, cursor="hand2", pady=5, padx=20, command=on_random_viral)
btn_random_viral.pack(side=tk.RIGHT)

status_bar = tk.Frame(app_win, bg=WIN_FACE, relief="sunken", bd=1)
status_bar.pack(fill=tk.X, side=tk.BOTTOM, padx=2, pady=2)
status_label = tk.Label(status_bar, text="Ready", font=FONT_MAIN, bg=WIN_FACE, fg=TEXT_COLOR, anchor="w", padx=5)
status_label.pack(fill=tk.X)

update_ui_visibility()
root.bind('<Return>', on_generate)
root.mainloop()