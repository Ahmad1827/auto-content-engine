import re

def format_srt_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def split_text_into_subchunks(text, start_time, end_time, max_words=6):
    words = text.split()
    if not words:
        return []
    
    total_duration = end_time - start_time
    time_per_word = total_duration / len(words)
    
    subchunks = []
    current_words = []
    current_start = start_time
    
    for i, word in enumerate(words):
        current_words.append(word)
        if len(current_words) >= max_words or i == len(words) - 1:
            chunk_duration = len(current_words) * time_per_word
            current_end = current_start + chunk_duration
            subchunks.append({
                "text": " ".join(current_words),
                "start": current_start,
                "end": current_end
            })
            current_start = current_end
            current_words = []
            
    return subchunks

def generate_srt_from_chunks(chunk_timings, output_srt="subtitles.srt"):
    all_subchunks = []
    for chunk in chunk_timings:
        refined = split_text_into_subchunks(chunk["text"], chunk["start"], chunk["end"])
        all_subchunks.extend(refined)

    with open(output_srt, "w", encoding="utf-8") as f:
        for i, chunk in enumerate(all_subchunks, 1):
            start = format_srt_time(chunk["start"])
            end = format_srt_time(chunk["end"])
            text = chunk["text"].strip()
            f.write(f"{i}\n{start} --> {end}\n{text}\n\n")

    return output_srt