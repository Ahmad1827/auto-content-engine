import os
import subprocess

def create_short_video(audio_path, srt_path, bg_video_path, output_path="final_short.mp4"):
    if not os.path.exists(bg_video_path):
        raise FileNotFoundError(f"Background video not found at {bg_video_path}!")
        
    srt_abs = os.path.abspath(srt_path).replace("\\", "/").replace(":", "\\:")
    
    # FFmpeg magic: Loops the background, crops to 9:16 vertical, resizes to 1080x1920, and adds TikTok-style subtitles
    cmd = [
        "ffmpeg", "-y",
        "-stream_loop", "-1", 
        "-i", bg_video_path,
        "-i", audio_path,
        "-vf", f"crop=ih*(9/16):ih,scale=1080:1920,subtitles='{srt_abs}':force_style='FontSize=22,FontName=Arial,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=5'",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-b:v", "8000k",
        "-shortest", 
        output_path
    ]
    
    print("[Shorts Editor] Assembling vertical video and burning subtitles...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print(f"[Shorts Editor] Success! Video saved to {output_path}")
        return True
    else:
        print(f"[Shorts Editor] FFmpeg Error: {result.stderr[:500]}")
        return False