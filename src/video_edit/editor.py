import os
from moviepy import AudioFileClip, ImageClip, concatenate_videoclips

def create_video():
    audio_path = "video_final.mp3"
    images_dir = "assets/images"
    output_path = "final_video.mp4"

    if not os.path.exists(audio_path):
        raise FileNotFoundError("Audio file missing.")
    
    image_files = [os.path.join(images_dir, img) for img in sorted(os.listdir(images_dir)) if img.endswith(('jpg', 'png', 'jpeg'))]
    
    if not image_files:
        raise FileNotFoundError("Images missing.")

    audio_clip = AudioFileClip(audio_path)
    duration_per_image = audio_clip.duration / len(image_files)

    clips = []
    for img_path in image_files:
        clip = (ImageClip(img_path)
                .with_duration(duration_per_image)
                .resized((1920, 1080)))
        clips.append(clip)

    video = concatenate_videoclips(clips, method="compose")
    video = video.with_audio(audio_clip)

    video.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac")
    return output_path