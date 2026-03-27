"""
kokoro_narration.py — Genereaza narration audio cu Kokoro TTS (local, gratis)
Exporta generate_voice() care returneaza si timing-uri pt subtitrari.
"""
import os
import re
import numpy as np

VOICE_PRESETS = {
    "calm":       {"voice": "af_heart", "speed": 0.85, "lang": "a", "pause": 0.5},
    "narration":  {"voice": "af_heart", "speed": 0.90, "lang": "a", "pause": 0.4},
    "storytell":  {"voice": "af_bella", "speed": 0.95, "lang": "a", "pause": 0.35},
    "educational":{"voice": "af_bella", "speed": 1.00, "lang": "a", "pause": 0.3},
    "british":    {"voice": "bf_emma",  "speed": 0.90, "lang": "b", "pause": 0.4},
}

MIN_WORDS = 15
MAX_WORDS = 70


def clean_script_text(text):
    """Curata formatting Gemini: bold, italic, headere, bullets."""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'#{1,6}\s*', '', text)
    text = re.sub(r'^\s*[-*•]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def smart_split(text):
    text = text.strip()
    text = re.sub(r'\n{3,}', '\n\n', text)
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    chunks = []
    buffer = ""
    for para in paragraphs:
        sentences = re.split(r'(?<=[.!?])\s+', para)
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            test = f"{buffer} {sentence}".strip() if buffer else sentence
            word_count = len(test.split())
            if word_count <= MAX_WORDS:
                buffer = test
            else:
                if buffer and len(buffer.split()) >= MIN_WORDS:
                    chunks.append(buffer)
                    buffer = sentence
                elif buffer:
                    chunks.append(test)
                    buffer = ""
                else:
                    parts = sentence.split(', ')
                    sub_buffer = ""
                    for part in parts:
                        sub_test = f"{sub_buffer}, {part}".strip(', ') if sub_buffer else part
                        if len(sub_test.split()) > MAX_WORDS:
                            if sub_buffer:
                                chunks.append(sub_buffer)
                            sub_buffer = part
                        else:
                            sub_buffer = sub_test
                    if sub_buffer:
                        buffer = sub_buffer
    if buffer:
        if len(buffer.split()) < MIN_WORDS and chunks:
            chunks[-1] = f"{chunks[-1]} {buffer}"
        else:
            chunks.append(buffer)
    return chunks


def generate_voice(text, output_path="video_final.wav", preset="narration",
                   voice=None, speed=None, lang=None, pause_seconds=None):
    """
    Genereaza audio WAV din text cu Kokoro TTS.
    
    Returns:
        (output_path, chunk_timings) — chunk_timings e lista de {"text", "start", "end"}
        sau (None, []) daca esueaza.
    """
    import soundfile as sf
    from kokoro import KPipeline

    text = clean_script_text(text)

    p = VOICE_PRESETS.get(preset, VOICE_PRESETS["narration"])
    v = voice or p["voice"]
    s = speed or p["speed"]
    l = lang or p["lang"]
    pause = pause_seconds or p["pause"]

    print(f"[Kokoro] Voice: {v} | Speed: {s} | Preset: {preset}")
    pipeline = KPipeline(lang_code=l, repo_id='hexgrad/Kokoro-82M')

    chunks = smart_split(text)
    print(f"[Kokoro] {len(chunks)} chunks")

    all_audio = []
    chunk_timings = []
    silence = np.zeros(int(24000 * pause))
    current_time = 0.0

    for idx, chunk in enumerate(chunks):
        print(f"  [{idx+1}/{len(chunks)}] \"{chunk[:60]}...\"")
        chunk_audio = []
        for i, (gs, ps, audio) in enumerate(pipeline(chunk, voice=v, speed=s)):
            chunk_audio.append(audio)
        
        if chunk_audio:
            combined = np.concatenate(chunk_audio)
            chunk_duration = len(combined) / 24000

            # Salveaza timing pentru SRT
            chunk_timings.append({
                "text": chunk,
                "start": current_time,
                "end": current_time + chunk_duration
            })

            all_audio.append(combined)
            current_time += chunk_duration

            # Adauga pauza
            if idx < len(chunks) - 1:
                all_audio.append(silence)
                current_time += pause

    if not all_audio:
        print("[Kokoro] EROARE: Nu s-a generat audio!")
        return None, []

    full_audio = np.concatenate(all_audio)
    sf.write(output_path, full_audio, 24000)
    duration = len(full_audio) / 24000
    print(f"[Kokoro] GATA! {output_path} ({duration:.1f}s)")
    return output_path, chunk_timings
