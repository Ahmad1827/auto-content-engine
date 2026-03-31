"""
talking_cat.py — Genereaza un video cu o pisica cartoon draguta care vorbeste.
Sincronizeaza miscarea gurii cu audio-ul. Desenata cu Pillow, export moviepy.
Zero dependinte externe — doar Pillow + numpy + moviepy (deja le ai).

Folosire:
    python talking_cat.py video_final.wav cat_video.mp4
    python talking_cat.py video_final.wav cat_video.mp4 --bg "#1a1a2e"
    python talking_cat.py video_final.wav cat_video.mp4 --size 400
"""
import numpy as np
import argparse
import math
import os
from PIL import Image, ImageDraw

FPS = 24
DEFAULT_SIZE = 400
DEFAULT_BG = "#1a1a2e"

# ── CAT COLORS ───────────────────────────────────────────────
CAT_BODY = "#f4a460"       # sandy brown
CAT_DARK = "#d2884a"       # darker shade
CAT_LIGHT = "#ffe4c4"      # light belly/cheeks
CAT_NOSE = "#ff6b81"       # pink nose
CAT_EYE = "#2d3436"        # dark eyes
CAT_EYE_SHINE = "#ffffff"  # eye shine
CAT_MOUTH = "#c0392b"      # mouth interior
CAT_WHISKER = "#636e72"    # whiskers


def draw_cat_frame(size, mouth_open=0.0, eye_blink=0.0, head_tilt=0.0, bg_color=DEFAULT_BG):
    """
    Deseneaza un frame cu o pisica cartoon.
    
    Args:
        size:       Dimensiunea canvas-ului (patrat)
        mouth_open: 0.0 (inchisa) → 1.0 (complet deschisa)
        eye_blink:  0.0 (deschisi) → 1.0 (inchisi)
        head_tilt:  -1.0 (stanga) → 1.0 (dreapta), offset subtil
    
    Returns:
        PIL Image
    """
    img = Image.new('RGBA', (size, size), bg_color)
    draw = ImageDraw.Draw(img)

    cx = size // 2 + int(head_tilt * size * 0.02)
    cy = size // 2 + int(abs(head_tilt) * size * 0.01)
    r = int(size * 0.32)  # head radius

    # ── EARS ──
    ear_h = int(r * 0.7)
    ear_w = int(r * 0.45)
    # Left ear
    draw.polygon([
        (cx - r + ear_w//2, cy - r + 10),
        (cx - r - ear_w//3, cy - r - ear_h),
        (cx - r + ear_w, cy - r - ear_h//4),
    ], fill=CAT_BODY, outline=CAT_DARK)
    # Left ear inner
    draw.polygon([
        (cx - r + ear_w//2 + 5, cy - r + 15),
        (cx - r - ear_w//3 + 8, cy - r - ear_h + 10),
        (cx - r + ear_w - 5, cy - r - ear_h//4 + 5),
    ], fill=CAT_NOSE)
    # Right ear
    draw.polygon([
        (cx + r - ear_w//2, cy - r + 10),
        (cx + r + ear_w//3, cy - r - ear_h),
        (cx + r - ear_w, cy - r - ear_h//4),
    ], fill=CAT_BODY, outline=CAT_DARK)
    # Right ear inner
    draw.polygon([
        (cx + r - ear_w//2 - 5, cy - r + 15),
        (cx + r + ear_w//3 - 8, cy - r - ear_h + 10),
        (cx + r - ear_w + 5, cy - r - ear_h//4 + 5),
    ], fill=CAT_NOSE)

    # ── HEAD (ellipse) ──
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CAT_BODY, outline=CAT_DARK)

    # ── CHEEKS ──
    cheek_r = int(r * 0.25)
    draw.ellipse([cx - r + 5, cy + r//6, cx - r + 5 + cheek_r*2, cy + r//6 + cheek_r], fill=CAT_LIGHT)
    draw.ellipse([cx + r - 5 - cheek_r*2, cy + r//6, cx + r - 5, cy + r//6 + cheek_r], fill=CAT_LIGHT)

    # ── EYES ──
    eye_y = cy - int(r * 0.15)
    eye_x_offset = int(r * 0.35)
    eye_r = int(r * 0.18)
    eye_h = max(2, int(eye_r * 2 * (1.0 - eye_blink)))

    for side in [-1, 1]:
        ex = cx + side * eye_x_offset
        if eye_blink > 0.8:
            # Closed — just a line
            draw.line([(ex - eye_r, eye_y), (ex + eye_r, eye_y)], fill=CAT_EYE, width=3)
        else:
            # Open eye
            draw.ellipse([ex - eye_r, eye_y - eye_h//2, ex + eye_r, eye_y + eye_h//2], fill=CAT_EYE)
            # Pupil shine
            shine_r = max(2, int(eye_r * 0.35))
            draw.ellipse([ex - shine_r + 3, eye_y - shine_r - 1,
                         ex + shine_r + 3, eye_y + shine_r - 1], fill=CAT_EYE_SHINE)

    # ── NOSE ──
    nose_y = cy + int(r * 0.15)
    nose_size = int(r * 0.1)
    draw.polygon([
        (cx, nose_y + nose_size),
        (cx - nose_size, nose_y - nose_size//2),
        (cx + nose_size, nose_y - nose_size//2),
    ], fill=CAT_NOSE)

    # ── MOUTH ──
    mouth_y = nose_y + nose_size + 2
    mouth_w = int(r * 0.3)
    mouth_h = int(r * 0.25 * mouth_open)

    if mouth_open > 0.05:
        # Open mouth
        draw.ellipse([
            cx - mouth_w, mouth_y,
            cx + mouth_w, mouth_y + mouth_h * 2
        ], fill=CAT_MOUTH)
        # Tongue hint
        if mouth_open > 0.3:
            tongue_h = int(mouth_h * 0.6)
            draw.ellipse([
                cx - mouth_w//2, mouth_y + mouth_h//2,
                cx + mouth_w//2, mouth_y + mouth_h + tongue_h
            ], fill="#e17055")
    else:
        # Closed — smile line
        draw.arc([cx - mouth_w, mouth_y - int(r*0.08),
                  cx + mouth_w, mouth_y + int(r*0.08)],
                 start=0, end=180, fill=CAT_DARK, width=2)

    # ── WHISKERS ──
    whisker_y = nose_y + nose_size
    whisker_len = int(r * 0.6)
    for side in [-1, 1]:
        for angle_offset in [-12, 0, 12]:
            x1 = cx + side * int(r * 0.3)
            y1 = whisker_y + angle_offset
            x2 = cx + side * (int(r * 0.3) + whisker_len)
            y2 = whisker_y + angle_offset * 2
            draw.line([(x1, y1), (x2, y2)], fill=CAT_WHISKER, width=1)

    return img


def get_audio_amplitudes(audio_path, fps=FPS):
    """Extrage amplitudinea audio per frame."""
    import soundfile as sf
    
    data, sr = sf.read(audio_path)
    if len(data.shape) > 1:
        data = data.mean(axis=1)  # mono

    samples_per_frame = sr // fps
    num_frames = len(data) // samples_per_frame

    amplitudes = []
    for i in range(num_frames):
        chunk = data[i * samples_per_frame : (i + 1) * samples_per_frame]
        amp = np.abs(chunk).mean()
        amplitudes.append(amp)

    # Normalize 0-1
    max_amp = max(amplitudes) if amplitudes else 1
    if max_amp > 0:
        amplitudes = [a / max_amp for a in amplitudes]

    return amplitudes


def generate_cat_video(audio_path, output_path="cat_video.mp4", 
                       size=DEFAULT_SIZE, bg_color=DEFAULT_BG):
    """
    Genereaza video cu pisica care vorbeste, sincronizata cu audio.
    
    Args:
        audio_path:  WAV/MP3 cu narration
        output_path: Unde salveaza video-ul
        size:        Dimensiunea pisicii (pixeli)
        bg_color:    Culoarea background-ului
    
    Returns:
        output_path
    """
    from moviepy import AudioFileClip, ImageSequenceClip

    print(f"[Cat] Analyzing audio: {audio_path}")
    amplitudes = get_audio_amplitudes(audio_path, FPS)
    total_frames = len(amplitudes)
    print(f"[Cat] {total_frames} frames @ {FPS}fps = {total_frames/FPS:.1f}s")

    print(f"[Cat] Drawing {total_frames} frames...")
    frames = []

    for frame_idx in range(total_frames):
        t = frame_idx / FPS
        amp = amplitudes[frame_idx]

        # Mouth opens with audio amplitude
        mouth_open = min(1.0, amp * 1.5)

        # Eyes blink every ~4 seconds for ~0.2s
        blink_cycle = t % 4.0
        eye_blink = 1.0 if 3.8 < blink_cycle < 4.0 else 0.0

        # Subtle head movement — sinusoidal
        head_tilt = math.sin(t * 0.8) * 0.5

        img = draw_cat_frame(size, mouth_open, eye_blink, head_tilt, bg_color)
        frames.append(np.array(img.convert('RGB')))

        if (frame_idx + 1) % 100 == 0:
            print(f"  Frame {frame_idx + 1}/{total_frames}")

    print(f"[Cat] Assembling video...")
    clip = ImageSequenceClip(frames, fps=FPS)

    # Adauga audio original
    audio_clip = AudioFileClip(audio_path)
    clip = clip.with_audio(audio_clip)

    clip.write_videofile(output_path, fps=FPS, codec="libx264", audio_codec="aac", threads=4)
    print(f"[Cat] DONE! {output_path}")
    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate talking cat video synced to audio")
    parser.add_argument("audio", help="Path to WAV/MP3 audio file")
    parser.add_argument("output", nargs="?", default="cat_video.mp4", help="Output MP4 path")
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE, help="Cat size in pixels")
    parser.add_argument("--bg", type=str, default=DEFAULT_BG, help="Background color hex")
    args = parser.parse_args()

    if not os.path.exists(args.audio):
        print(f"Audio file not found: {args.audio}")
        sys.exit(1)

    generate_cat_video(args.audio, args.output, args.size, args.bg)
