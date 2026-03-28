import os
import re
import numpy as np

VOICE_PRESETS = {
    "🇺🇸 AF - Heart (Warm/Default)": {"voice": "af_heart", "speed": 0.90, "lang": "a", "pause": 0.4},
    "🇺🇸 AF - Bella (Energetic)": {"voice": "af_bella", "speed": 0.95, "lang": "a", "pause": 0.35},
    "🇺🇸 AF - Nicole (Professional)": {"voice": "af_nicole", "speed": 0.95, "lang": "a", "pause": 0.4},
    "🇺🇸 AF - Sarah (Calm/Reliable)": {"voice": "af_sarah", "speed": 0.90, "lang": "a", "pause": 0.4},
    "🇺🇸 AF - Sky (Soft/Soothing)": {"voice": "af_sky", "speed": 0.85, "lang": "a", "pause": 0.5},
    "🇺🇸 AF - Alloy (Authoritative)": {"voice": "af_alloy", "speed": 0.95, "lang": "a", "pause": 0.4},
    "🇺🇸 AF - Aoede (Expressive)": {"voice": "af_aoede", "speed": 0.90, "lang": "a", "pause": 0.4},
    "🇺🇸 AF - Jessica (Friendly)": {"voice": "af_jessica", "speed": 0.95, "lang": "a", "pause": 0.4},
    "🇺🇸 AF - Kore (Balanced)": {"voice": "af_kore", "speed": 0.95, "lang": "a", "pause": 0.4},
    "🇺🇸 AF - Nova (Upbeat)": {"voice": "af_nova", "speed": 0.95, "lang": "a", "pause": 0.35},
    "🇺🇸 AF - River (Smooth)": {"voice": "af_river", "speed": 0.90, "lang": "a", "pause": 0.4},
    "🇺🇸 AM - Michael (Deep/News)": {"voice": "am_michael", "speed": 0.90, "lang": "a", "pause": 0.4},
    "🇺🇸 AM - Adam (Classic)": {"voice": "am_adam", "speed": 0.95, "lang": "a", "pause": 0.4},
    "🇺🇸 AM - Echo (Resonant)": {"voice": "am_echo", "speed": 0.95, "lang": "a", "pause": 0.4},
    "🇺🇸 AM - Eric (Professional)": {"voice": "am_eric", "speed": 0.95, "lang": "a", "pause": 0.4},
    "🇺🇸 AM - Fenrir (Powerful)": {"voice": "am_fenrir", "speed": 0.95, "lang": "a", "pause": 0.4},
    "🇺🇸 AM - Liam (Friendly)": {"voice": "am_liam", "speed": 0.95, "lang": "a", "pause": 0.4},
    "🇺🇸 AM - Onyx (Rich/Elegant)": {"voice": "am_onyx", "speed": 0.90, "lang": "a", "pause": 0.45},
    "🇺🇸 AM - Puck (Playful)": {"voice": "am_puck", "speed": 0.95, "lang": "a", "pause": 0.35},
    "🇺🇸 AM - Santa (Jolly)": {"voice": "am_santa", "speed": 0.90, "lang": "a", "pause": 0.4},
    "🇬🇧 BF - Emma (Elegant)": {"voice": "bf_emma", "speed": 0.90, "lang": "b", "pause": 0.4},
    "🇬🇧 BF - Isabella (Articulate)": {"voice": "bf_isabella", "speed": 0.95, "lang": "b", "pause": 0.4},
    "🇬🇧 BF - Alice (Storytelling)": {"voice": "bf_alice", "speed": 0.90, "lang": "b", "pause": 0.4},
    "🇬🇧 BF - Lily (Gentle)": {"voice": "bf_lily", "speed": 0.85, "lang": "b", "pause": 0.45},
    "🇬🇧 BM - George (Commanding)": {"voice": "bm_george", "speed": 0.90, "lang": "b", "pause": 0.4},
    "🇬🇧 BM - Fable (Expressive)": {"voice": "bm_fable", "speed": 0.90, "lang": "b", "pause": 0.4},
    "🇬🇧 BM - Lewis (Clear)": {"voice": "bm_lewis", "speed": 0.95, "lang": "b", "pause": 0.4},
    "🇬🇧 BM - Daniel (Modern)": {"voice": "bm_daniel", "speed": 0.95, "lang": "b", "pause": 0.4},
}

MIN_WORDS = 15
MAX_WORDS = 70

def clean_script_text(text):
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

def generate_voice(text, output_path="video_final.wav", preset="🇺🇸 AF - Heart (Warm/Default)",
                   voice=None, speed=None, lang=None, pause_seconds=None):
    import soundfile as sf
    from kokoro import KPipeline

    text = clean_script_text(text)

    p = VOICE_PRESETS.get(preset, VOICE_PRESETS["🇺🇸 AF - Heart (Warm/Default)"])
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

            chunk_timings.append({
                "text": chunk,
                "start": current_time,
                "end": current_time + chunk_duration
            })

            all_audio.append(combined)
            current_time += chunk_duration

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