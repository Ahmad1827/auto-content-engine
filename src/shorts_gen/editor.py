import os
import subprocess
import random

def get_video_length(video_path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", video_path]
    try:
        return float(subprocess.run(cmd, capture_output=True, text=True).stdout.strip())
    except Exception:
        return 60.0

def create_video(audio_path, srt_path, bg_video_path="assets/background.mp4", output_path="final_video.mp4", is_short=True):
    if not os.path.exists(bg_video_path):
        return False, f"Background video not found at {bg_video_path}"
        
    srt_abs = os.path.abspath(srt_path).replace("\\", "/").replace(":", "\\:")
    
    bg_duration = get_video_length(bg_video_path)
    audio_duration = get_video_length(audio_path)
    
    max_start = max(0, int(bg_duration - audio_duration - 5))
    random_start = random.randint(0, max_start)
    
    if is_short:
        print(f"[Editor] Rendering Vertical Short (9:16) for {audio_duration:.1f} seconds...")
        vf_filter = f"crop=ih*(9/16):ih,scale=1080:1920,subtitles='{srt_abs}':force_style='FontSize=22,FontName=Arial,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=5'"
    else:
        print(f"[Editor] Rendering Long-Form Video (16:9) for {audio_duration:.1f} seconds...")
        vf_filter = f"scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,subtitles='{srt_abs}':force_style='FontSize=18,FontName=Arial,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0'"

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(random_start),
        "-stream_loop", "-1",
        "-i", bg_video_path,           
        "-i", audio_path,             
        "-t", str(audio_duration + 1),
        "-map", "0:v:0",               
        "-map", "1:a:0",               
        "-vf", vf_filter,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-b:v", "8000k",
        output_path
    ]
    
    result = subprocess.run(cmd, capture_output=False)
    
    if result.returncode == 0:
        return True, "Success"
    else:
        return False, "FFmpeg failed. Check terminal for details."