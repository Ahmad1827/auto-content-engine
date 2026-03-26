import os
import random
from moviepy import AudioFileClip, ImageClip, concatenate_videoclips, CompositeAudioClip, CompositeVideoClip

def apply_ken_burns_no_bars(clip, duration, VIDEO_SIZE):
    zoom_ratio = 0.08
    overscan = 0.1

    base_clip = clip.resized(height=VIDEO_SIZE[1] * (1 + overscan))
    centered_base = base_clip.with_duration(duration).with_position('center')

    if random.random() > 0.5:
        panning_clip = centered_base.resized(
            lambda t: 1 + (zoom_ratio * t / duration)
        )
    else:
        panning_clip = centered_base.resized(
            lambda t: (1 + zoom_ratio) - (zoom_ratio * t / duration)
        )

    final_view = panning_clip.cropped(width=VIDEO_SIZE[0], height=VIDEO_SIZE[1], x_center=panning_clip.w/2, y_center=panning_clip.h/2)
    
    return final_view

def create_video():
    audio_path = "video_final.mp3"
    pool_dir = "assets/curated_pool"
    music_path = "assets/music/background.mp3"
    output_path = "final_video.mp4"
    
    SCENE_DURATION = 25
    VIDEO_SIZE = (1920, 1080) # 16:9 aspect ratio (standard landscape)

    if not os.path.exists(audio_path):
        raise FileNotFoundError("Audio file missing.")
    
    if not os.path.exists(pool_dir) or not os.listdir(pool_dir):
        raise FileNotFoundError(f"Missing images in {pool_dir}")

    print("Preparing audio...")
    voice_clip = AudioFileClip(audio_path)
    total_duration = voice_clip.duration
    
    final_audio = voice_clip

    if os.path.exists(music_path):
        try:
            background_music = AudioFileClip(music_path).with_duration(total_duration)
            background_music = background_music.with_volume_scaled(0.15) 
            final_audio = CompositeAudioClip([voice_clip, background_music])
            print("Music mixed successfully.")
        except Exception:
            pass

    source_images = [os.path.join(pool_dir, img) for img in sorted(os.listdir(pool_dir)) if img.endswith(('jpg', 'png', 'jpeg'))]
    
    num_scenes_needed = int(total_duration / SCENE_DURATION) + 1
    print(f"Creating {num_scenes_needed} scenes using {len(source_images)} source images.")

    clips = []
    
    for i in range(num_scenes_needed):
        img_path = source_images[i % len(source_images)]
        
        img_clip = ImageClip(img_path)
        
        current_scene_duration = SCENE_DURATION
        if i == num_scenes_needed - 1:
            current_scene_duration = total_duration - (i * SCENE_DURATION)
            if current_scene_duration <= 0: break

        cinematic_clip = apply_ken_burns_no_bars(img_clip, current_scene_duration, VIDEO_SIZE)
        
        clips.append(cinematic_clip)

    print("Assembling final video...")
    video = concatenate_videoclips(clips, method="compose")
    video = video.with_audio(final_audio)

    print("Starting cinematic rendering (no bars)... This will take several minutes.")
    video.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac", threads=4)
    print("Video generation successful! No letterboxing.")
    return output_path