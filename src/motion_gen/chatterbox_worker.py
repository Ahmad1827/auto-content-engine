"""Voices scenes with Chatterbox and finds word timings with faster-whisper.

Runs inside tts_env (Chatterbox needs its own torch version), called by narration.py:
    tts_env/bin/python src/motion_gen/chatterbox_worker.py job.json
job.json: {"texts": [...], "out_dir": "...", "model": "original"|"turbo", "exaggeration": 0.6, "cfg_weight": 0.4}
Writes out_dir/result.json: [{"wav": path, "duration": seconds, "words": [{text, start, end}]}]
"""
import json
import os
import re
import sys
from difflib import SequenceMatcher


def _norm(word):
    return re.sub(r"[^a-z0-9]", "", word.lower())


def align(script_words, heard, duration):
    """Gives each script word the time whisper heard it; unheard words are spread between their neighbours."""
    times = [None] * len(script_words)
    matcher = SequenceMatcher(a=[_norm(w) for w in script_words], b=[_norm(w["text"]) for w in heard], autojunk=False)
    for a, b, size in matcher.get_matching_blocks():
        for k in range(size):
            times[a + k] = (heard[b + k]["start"], heard[b + k]["end"])

    speech_start = heard[0]["start"] if heard else 0.0
    speech_end = heard[-1]["end"] if heard else duration
    i = 0
    while i < len(times):
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < len(times) and times[j] is None:
            j += 1
        lo = times[i - 1][1] if i > 0 else speech_start
        hi = times[j][0] if j < len(times) else speech_end
        step = max(hi - lo, 0.05 * (j - i)) / (j - i)
        for k in range(i, j):
            times[k] = (lo + (k - i) * step, lo + (k - i + 1) * step)
        i = j
    return [{"text": w, "start": round(s, 3), "end": round(e, 3)} for w, (s, e) in zip(script_words, times)]


def main(job_path):
    with open(job_path, encoding="utf-8") as f:
        job = json.load(f)

    import torch
    import torchaudio
    from faster_whisper import WhisperModel

    torch.set_num_threads(os.cpu_count() or 4)
    if job.get("model") == "turbo":
        from chatterbox.tts_turbo import ChatterboxTurboTTS as Model
    else:
        from chatterbox.tts import ChatterboxTTS as Model
    tts = Model.from_pretrained(device="cpu")
    whisper = WhisperModel("base.en", device="cpu", compute_type="int8")

    results = []
    for i, text in enumerate(job["texts"]):
        print(f"[Chatterbox] Scene {i + 1}/{len(job['texts'])}", flush=True)
        kwargs = {} if job.get("model") == "turbo" else {
            "exaggeration": job.get("exaggeration", 0.6), "cfg_weight": job.get("cfg_weight", 0.4)}
        wav = tts.generate(text, **kwargs)
        path = os.path.join(job["out_dir"], f"scene_{i:02d}.wav")
        torchaudio.save(path, wav, tts.sr)
        duration = wav.shape[-1] / tts.sr

        # Hand whisper 16 kHz samples directly; its file decoder breaks with some PyAV versions.
        audio16k = torchaudio.functional.resample(wav, tts.sr, 16000).squeeze(0).numpy()
        segments, _ = whisper.transcribe(audio16k, word_timestamps=True, initial_prompt=text, language="en")
        heard = [{"text": w.word.strip(), "start": w.start, "end": w.end} for seg in segments for w in seg.words]
        results.append({"wav": path, "duration": duration, "words": align(text.split(), heard, duration)})

    with open(os.path.join(job["out_dir"], "result.json"), "w", encoding="utf-8") as f:
        json.dump(results, f)


if __name__ == "__main__":
    main(sys.argv[1])
