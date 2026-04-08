"""
karaoke_subs.py — Genereaza subtitrari ASS cu highlight pe cuvant (stil TikTok).
Fiecare cuvant se coloreaza cand e rostit, restul raman albe.

Locatie: src/voice_gen/karaoke_subs.py
"""

# Culori ASS format: &HAABBGGRR& (BGR, nu RGB!)
COLOR_NORMAL = "&H00FFFFFF"    # alb
COLOR_HIGHLIGHT = "&H0000FFFF"  # galben (TikTok-style)
# Alternative: "&H000000FF" = rosu, "&H0000FF00" = verde, "&H00FF8000" = cyan


def format_ass_time(seconds):
    """Converte secunde in format ASS: H:MM:SS.cc"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def generate_karaoke_ass(chunk_timings, output_ass="short_subs.ass",
                          font_size=21, highlight_color=None,
                          is_vertical=True, words_per_group=5):
    """
    Genereaza subtitrari ASS cu highlight pe cuvantul curent.
    
    Args:
        chunk_timings: [(start, end, text), ...] de la Kokoro
        output_ass: fisier output
        font_size: marimea fontului
        highlight_color: culoarea cuvantului activ (ASS BGR format)
        is_vertical: True pt 9:16 (TikTok), False pt 16:9
        words_per_group: cate cuvinte afisate simultan
    
    Returns:
        calea la fisierul ASS generat
    """
    if highlight_color is None:
        highlight_color = COLOR_HIGHLIGHT

    # Rezolutie video
    if is_vertical:
        res_x, res_y = 1080, 1920
        margin_v = 200
    else:
        res_x, res_y = 1920, 1080
        margin_v = 50

    # Header ASS
    header = f"""[Script Info]
Title: Karaoke Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: {res_x}
PlayResY: {res_y}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,{font_size},{COLOR_NORMAL},{highlight_color},&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,2,20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    dialogues = []

    for chunk_start, chunk_end, chunk_text in chunk_timings:
        if not chunk_text or not chunk_text.strip():
            continue

        words = chunk_text.strip().split()
        if not words:
            continue

        chunk_duration = chunk_end - chunk_start

        # Estimeaza timing per cuvant proportional cu lungimea
        total_chars = sum(len(w) for w in words)
        if total_chars == 0:
            continue

        word_timings = []
        current_time = chunk_start
        for word in words:
            # Durata proportionala cu lungimea cuvantului
            word_dur = (len(word) / total_chars) * chunk_duration
            # Minim 0.15s per cuvant
            word_dur = max(0.15, word_dur)
            word_timings.append((current_time, current_time + word_dur, word))
            current_time += word_dur

        # Normalizeaza sa se termine exact la chunk_end
        if word_timings:
            scale = chunk_duration / (current_time - chunk_start)
            adjusted = []
            t = chunk_start
            for _, _, w in word_timings:
                dur = (len(w) / total_chars) * chunk_duration
                dur = max(0.15, dur) * scale
                adjusted.append((t, t + dur, w))
                t += dur
            word_timings = adjusted

        # Grupeaza cuvintele (arata words_per_group cuvinte simultan)
        for group_start_idx in range(0, len(word_timings), words_per_group):
            group = word_timings[group_start_idx:group_start_idx + words_per_group]
            if not group:
                continue

            group_words = [w for _, _, w in group]

            # Pt fiecare cuvant din grup, creeaza o linie de dialog
            for word_idx, (w_start, w_end, word) in enumerate(group):
                # Construieste textul cu highlight pe cuvantul curent
                parts = []
                for j, gw in enumerate(group_words):
                    if j == word_idx:
                        # Cuvantul activ — highlight
                        parts.append(f"{{\\c{highlight_color}}}{gw}{{\\c{COLOR_NORMAL}}}")
                    else:
                        parts.append(gw)

                text = " ".join(parts)
                start_str = format_ass_time(w_start)
                end_str = format_ass_time(w_end)

                dialogues.append(
                    f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text}"
                )

    # Scrie fisierul ASS
    with open(output_ass, "w", encoding="utf-8") as f:
        f.write(header)
        for line in dialogues:
            f.write(line + "\n")

    print(f"[Karaoke] Generated {len(dialogues)} dialogue lines -> {output_ass}")
    return output_ass


def generate_karaoke_simple(chunk_timings, output_ass="short_subs.ass",
                             font_size=21, highlight_color=None,
                             is_vertical=True):
    """
    Varianta simplificata — arata tot chunk-ul, highlight cuvant cu cuvant.
    Mai putine linii de dialog, arata mai curat pe ecrane mici.
    """
    if highlight_color is None:
        highlight_color = COLOR_HIGHLIGHT

    if is_vertical:
        res_x, res_y = 1080, 1920
        margin_v = 200
    else:
        res_x, res_y = 1920, 1080
        margin_v = 50

    header = f"""[Script Info]
Title: Karaoke Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: {res_x}
PlayResY: {res_y}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,{font_size},{COLOR_NORMAL},{highlight_color},&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,2,20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    dialogues = []

    for chunk_start, chunk_end, chunk_text in chunk_timings:
        if not chunk_text or not chunk_text.strip():
            continue

        words = chunk_text.strip().split()
        if not words:
            continue

        chunk_duration = chunk_end - chunk_start
        total_chars = max(1, sum(len(w) for w in words))

        # Calculeaza durata per cuvant in centisecunde (pt \kf tag)
        kf_parts = []
        for word in words:
            word_dur_cs = max(15, int((len(word) / total_chars) * chunk_duration * 100))
            kf_parts.append(f"{{\\kf{word_dur_cs}}}{word}")

        text = " ".join(kf_parts)
        start_str = format_ass_time(chunk_start)
        end_str = format_ass_time(chunk_end)

        dialogues.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text}")

    with open(output_ass, "w", encoding="utf-8") as f:
        f.write(header)
        for line in dialogues:
            f.write(line + "\n")

    print(f"[Karaoke] Generated {len(dialogues)} karaoke lines -> {output_ass}")
    return output_ass
