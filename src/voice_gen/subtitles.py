"""
subtitles.py — Genereaza subtitrari SRT din timing-urile Kokoro.
Nu are nevoie de Aeneas sau alt tool extern.
Kokoro ne da textul si audio-ul per chunk — calculam timestamp-urile direct.
"""
import re


def format_srt_time(seconds):
    """Converteste secunde in format SRT: HH:MM:SS,mmm"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def generate_srt_from_chunks(chunk_timings, output_srt="subtitles.srt"):
    """
    Genereaza fisier SRT din lista de (text, start_sec, end_sec).
    
    Args:
        chunk_timings: lista de dict-uri [{"text": "...", "start": 0.0, "end": 5.2}, ...]
        output_srt: calea fisierului SRT
    
    Returns:
        output_srt path
    """
    with open(output_srt, "w", encoding="utf-8") as f:
        for i, chunk in enumerate(chunk_timings, 1):
            start = format_srt_time(chunk["start"])
            end = format_srt_time(chunk["end"])
            text = chunk["text"].strip()
            f.write(f"{i}\n{start} --> {end}\n{text}\n\n")

    print(f"[Subtitles] SRT salvat: {output_srt} ({len(chunk_timings)} entries)")
    return output_srt
