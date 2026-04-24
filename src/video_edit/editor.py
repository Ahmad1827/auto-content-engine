import os
import subprocess
import numpy as np
from PIL import Image
from moviepy import AudioFileClip, ImageClip, concatenate_videoclips, CompositeAudioClip, VideoClip

def apply_cyclical_ken_burns(clip, duration, VIDEO_SIZE, img_index):
    w, h = VIDEO_SIZE
    
    img = Image.fromarray(clip.get_frame(0))
    img_w, img_h = img.size
    
    target_ratio = w / h
    img_ratio = img_w / img_h
    
    if img_ratio > target_ratio:
        base_h = img_h
        base_w = base_h * target_ratio
    else:
        base_w = img_w
        base_h = base_w / target_ratio
        
    cx, cy = img_w / 2, img_h / 2
    effect_type = img_index % 4
    
    resample_method = getattr(Image, 'Resampling', Image).BICUBIC
    
    def make_frame(t):
        progress = min(1.0, t / duration)
        
        if effect_type == 0:
            scale = 1.0 - (0.08 * progress)
            cur_cx, cur_cy = cx, cy
        elif effect_type == 1:
            scale = 0.92 + (0.08 * progress)
            cur_cx, cur_cy = cx, cy
        elif effect_type == 2:
            scale = 0.92
            shift_max = base_w * 0.04
            cur_cx = (cx - shift_max) + (shift_max * 2 * progress)
            cur_cy = cy
        else:
            scale = 0.92
            shift_max = base_w * 0.04
            cur_cx = (cx + shift_max) - (shift_max * 2 * progress)
            cur_cy = cy
            
        vw = base_w * scale
        vh = base_h * scale
        
        box = (
            cur_cx - vw / 2,
            cur_cy - vh / 2,
            cur_cx + vw / 2,
            cur_cy + vh / 2
        )
        
        frame_img = img.transform(
            (w, h),
            Image.EXTENT,
            data=box,
            resample=resample_method
        )
        return np.array(frame_img)
        
    return VideoClip(make_frame, duration=duration)

def create_video(srt_path=None, is_short=False, scene_duration=5): # <-- Parametru nou (default 5)
    audio_path = "video_final.wav"
    if not os.path.exists(audio_path):
        audio_path = "video_final.mp3"

    pool_dir = "assets/curated_pool"
    music_path = "assets/music/background.mp3"
    output_path = "final_video.mp4"

    # FOLOSIM SETAREA DIN INTERFAȚĂ ÎN LOC SĂ FIE HARDCODATĂ
    SCENE_DURATION = scene_duration 
    VIDEO_SIZE = (1080, 1920) if is_short else (1920, 1080)

    if not os.path.exists(audio_path):
        raise FileNotFoundError("Audio file missing.")

    voice_clip = AudioFileClip(audio_path)
    total_duration = voice_clip.duration

    final_audio = voice_clip

    if os.path.exists(music_path):
        try:
            background_music = AudioFileClip(music_path).with_duration(total_duration)
            background_music = background_music.with_volume_scaled(0.15)
            final_audio = CompositeAudioClip([voice_clip, background_music])
        except Exception:
            pass

    if not os.path.exists(pool_dir):
        os.makedirs(pool_dir)

    source_images = [os.path.join(pool_dir, img) for img in sorted(os.listdir(pool_dir)) if img.lower().endswith(('jpg', 'png', 'jpeg', 'webp'))]

    if not source_images:
        placeholder_path = os.path.join(pool_dir, "fallback_black.jpg")
        img = Image.new('RGB', VIDEO_SIZE, color='black')
        img.save(placeholder_path)
        source_images = [placeholder_path]

    num_scenes_needed = int(total_duration / SCENE_DURATION) + 1

    clips = []

    for i in range(num_scenes_needed):
        img_path = source_images[i % len(source_images)]
        img_clip = ImageClip(img_path)

        current_scene_duration = SCENE_DURATION
        if i == num_scenes_needed - 1:
            current_scene_duration = total_duration - (i * SCENE_DURATION)
            if current_scene_duration <= 0:
                break

        cinematic_clip = apply_cyclical_ken_burns(img_clip, current_scene_duration, VIDEO_SIZE, i)
        clips.append(cinematic_clip)

    video = concatenate_videoclips(clips, method="compose")
    video = video.with_audio(final_audio)

    if srt_path and os.path.exists(srt_path):
        temp_path = "temp_no_subs.mp4"
        video.write_videofile(temp_path, fps=24, codec="libx264", audio_codec="aac", bitrate="8000k", threads=4)

        success = burn_subtitles(temp_path, srt_path, output_path, is_short)

        if os.path.exists(temp_path):
            if success:
                os.remove(temp_path)
            else:
                os.rename(temp_path, output_path)
    else:
        video.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac", bitrate="8000k", threads=4)

    return output_path

def burn_subtitles(video_path, srt_path, output_path, is_short=False):
    srt_abs = os.path.abspath(srt_path).replace("\\", "/").replace(":", "\\:")
    
    if is_short:
        sub_style = f"subtitles='{srt_abs}':force_style='FontSize=22,FontName=Arial,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,Alignment=5'"
    else:
        sub_style = f"subtitles='{srt_abs}':force_style='FontSize=18,FontName=Arial,PrimaryColour=&H00FFFFFF,BorderStyle=3,Outline=1,Shadow=0,MarginV=30'"

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", sub_style,
        "-c:a", "copy",
        "-b:v", "8000k",
        output_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return True
        else:
            return False
    except FileNotFoundError:
        return False