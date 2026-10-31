"""Voices each storyboard scene (Kokoro, Chatterbox or Edge) and returns word-level timings."""
import json
import os
import shutil
import subprocess
import tempfile

import numpy as np

from voice_gen.edge_narration import EDGE_VOICES, LANGUAGES, synthesize, voice_language
from voice_gen.kokoro_narration import VOICE_PRESETS, clean_script_text

SAMPLE_RATE = 24000
SCENE_GAP = 0.3
DEFAULT_PRESET = "🇺🇸 AM - Michael (Deep/News)"

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TTS_PYTHON = os.path.join(ROOT, "tts_env", "bin", "python")

# Chatterbox runs in its own venv (tts_env); ~10x slower than real time on CPU, much more natural than Kokoro.
CHATTERBOX_VOICES = {
    "🎙️ Chatterbox - Natural (free, slow)": {"model": "original", "exaggeration": 0.5, "cfg_weight": 0.5},
    "🎙️ Chatterbox - Dramatic (free, slow)": {"model": "original", "exaggeration": 0.8, "cfg_weight": 0.3},
    "🎙️ Chatterbox - Turbo (free, faster)": {"model": "turbo"},
}

# Spoken words per second (incl. scene gaps), used to size scripts to the target length.
WORDS_PER_SECOND = {"kokoro": 2.2, "chatterbox": 2.9}


def engine_for(preset):
    return "edge" if preset in EDGE_VOICES else "chatterbox" if preset in CHATTERBOX_VOICES else "kokoro"


def words_per_second(preset):
    engine = engine_for(preset)
    return LANGUAGES[voice_language(preset)]["wps"] if engine == "edge" else WORDS_PER_SECOND[engine]


def chatterbox_available():
    return os.path.exists(TTS_PYTHON)


def _words_from_tokens(tokens):
    """Kokoro gives punctuation as separate tokens; glue it onto the previous word."""
    words = []
    for tok in tokens or []:
        text = tok.text.strip()
        if not text:
            continue
        start = tok.start_ts if tok.start_ts is not None else (words[-1]["end"] if words else 0.0)
        end = tok.end_ts if tok.end_ts is not None else start
        if words and not any(ch.isalnum() for ch in text):
            words[-1]["text"] += text
            words[-1]["end"] = max(words[-1]["end"], end)
            continue
        words.append({"text": text, "start": start, "end": end})
    return words


def _kokoro_clips(texts, preset, speed, log):
    from kokoro import KPipeline

    p = VOICE_PRESETS.get(preset, VOICE_PRESETS[DEFAULT_PRESET])
    pipeline = KPipeline(lang_code=p["lang"], repo_id="hexgrad/Kokoro-82M")
    for i, text in enumerate(texts):
        log(f"[Voice] Scene {i + 1}/{len(texts)}: {text[:60]}")
        clips, words, cursor = [], [], 0.0
        for result in pipeline(text, voice=p["voice"], speed=speed):
            if result.audio is None:
                continue
            clip = result.audio.numpy() if hasattr(result.audio, "numpy") else np.asarray(result.audio)
            words += [dict(w, start=w["start"] + cursor, end=w["end"] + cursor) for w in _words_from_tokens(result.tokens)]
            clips.append(clip)
            cursor += len(clip) / SAMPLE_RATE
        yield (np.concatenate(clips) if clips else np.zeros(0, dtype=np.float32)), words


def _chatterbox_clips(texts, preset, log):
    import soundfile as sf

    if not chatterbox_available():
        raise RuntimeError("Chatterbox is not installed (tts_env missing). See README > Voices.")
    out_dir = tempfile.mkdtemp(prefix="chatterbox_")
    try:
        job = dict(CHATTERBOX_VOICES[preset], texts=texts, out_dir=out_dir)
        job_path = os.path.join(out_dir, "job.json")
        with open(job_path, "w", encoding="utf-8") as f:
            json.dump(job, f)
        log(f"[Voice] Chatterbox voicing {len(texts)} scenes (slow on CPU, ~10s per second of speech)...")
        worker = os.path.join(os.path.dirname(__file__), "chatterbox_worker.py")
        proc = subprocess.Popen([TTS_PYTHON, worker, job_path], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, bufsize=1)
        tail = []
        for line in proc.stdout:
            tail = (tail + [line.rstrip()])[-10:]
            if line.startswith("[Chatterbox]"):
                log(line.rstrip())
        if proc.wait() != 0:
            raise RuntimeError("Chatterbox failed:\n" + "\n".join(tail))
        with open(os.path.join(out_dir, "result.json"), encoding="utf-8") as f:
            for scene in json.load(f):
                audio, sr = sf.read(scene["wav"], dtype="float32")
                if sr != SAMPLE_RATE:
                    raise RuntimeError(f"Unexpected Chatterbox sample rate {sr}")
                yield audio, scene["words"]
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)


def _edge_clips(texts, preset, speed, log):
    for i, text in enumerate(texts):
        log(f"[Voice] Scene {i + 1}/{len(texts)}: {text[:60]}")
        yield synthesize(text, EDGE_VOICES[preset]["voice"], speed)


def voice_scenes(scenes, wav_path, preset=DEFAULT_PRESET, speed=1.1, log=print, scene_gap=SCENE_GAP):
    """Fills scene["start"]/["duration"] in place, writes one WAV, returns the word list."""
    import soundfile as sf

    texts = [clean_script_text(s["narration"]) for s in scenes]
    engine = engine_for(preset)
    clips = (_edge_clips(texts, preset, speed, log) if engine == "edge" else
             _chatterbox_clips(texts, preset, log) if engine == "chatterbox" else _kokoro_clips(texts, preset, speed, log))
    gap = np.zeros(int(SAMPLE_RATE * scene_gap), dtype=np.float32)

    audio, words, cursor = [], [], 0.0
    for scene, (clip, scene_words) in zip(scenes, clips):
        words += [dict(w, start=round(w["start"] + cursor, 3), end=round(w["end"] + cursor, 3)) for w in scene_words]
        audio += [clip, gap]
        scene["start"] = round(cursor, 3)
        scene["duration"] = round(len(clip) / SAMPLE_RATE + scene_gap, 3)
        cursor += scene["duration"]

    if not audio:
        raise RuntimeError("No audio was produced.")
    # A short tail so the last word isn't cut by the fade-out.
    scenes[-1]["duration"] = round(scenes[-1]["duration"] + 0.6, 3)
    audio.append(np.zeros(int(SAMPLE_RATE * 0.6), dtype=np.float32))
    sf.write(wav_path, np.concatenate(audio), SAMPLE_RATE)
    return words
