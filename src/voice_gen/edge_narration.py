"""Voices for languages other than English: Microsoft's neural voices through edge-tts (free, needs internet)."""
import asyncio
import io
import re
import time

SAMPLE_RATE = 24000
PHRASE_WORDS = 6

# wps = spoken words per second at speed 1.1 (incl. scene gaps), used to size scripts to the target length.
# Chinese and Japanese have no spaces, so a "word" there means two characters.
LANGUAGES = {
    "en": {"name": "English", "voices": {}},
    "ar": {"name": "Arabic", "wps": 1.5, "voices": {
        "🇸🇦 Hamed (Male)": "ar-SA-HamedNeural", "🇸🇦 Zariyah (Female)": "ar-SA-ZariyahNeural",
        "🇪🇬 Shakir (Male)": "ar-EG-ShakirNeural", "🇪🇬 Salma (Female)": "ar-EG-SalmaNeural"}},
    "zh": {"name": "Chinese", "wps": 1.8, "voices": {
        "🇨🇳 Yunjian (Male)": "zh-CN-YunjianNeural", "🇨🇳 Xiaoxiao (Female)": "zh-CN-XiaoxiaoNeural"}},
    "nl": {"name": "Dutch", "wps": 2.1, "voices": {
        "🇳🇱 Maarten (Male)": "nl-NL-MaartenNeural", "🇳🇱 Colette (Female)": "nl-NL-ColetteNeural"}},
    "fr": {"name": "French", "wps": 2.2, "voices": {
        "🇫🇷 Henri (Male)": "fr-FR-HenriNeural", "🇫🇷 Denise (Female)": "fr-FR-DeniseNeural"}},
    "de": {"name": "German", "wps": 2.0, "voices": {
        "🇩🇪 Conrad (Male)": "de-DE-ConradNeural", "🇩🇪 Katja (Female)": "de-DE-KatjaNeural"}},
    "hi": {"name": "Hindi", "wps": 2.2, "voices": {
        "🇮🇳 Madhur (Male)": "hi-IN-MadhurNeural", "🇮🇳 Swara (Female)": "hi-IN-SwaraNeural"}},
    "id": {"name": "Indonesian", "wps": 1.75, "voices": {
        "🇮🇩 Ardi (Male)": "id-ID-ArdiNeural", "🇮🇩 Gadis (Female)": "id-ID-GadisNeural"}},
    "it": {"name": "Italian", "wps": 2.05, "voices": {
        "🇮🇹 Diego (Male)": "it-IT-DiegoNeural", "🇮🇹 Elsa (Female)": "it-IT-ElsaNeural"}},
    "ja": {"name": "Japanese", "wps": 2.45, "voices": {
        "🇯🇵 Keita (Male)": "ja-JP-KeitaNeural", "🇯🇵 Nanami (Female)": "ja-JP-NanamiNeural"}},
    "ko": {"name": "Korean", "wps": 1.6, "voices": {
        "🇰🇷 InJoon (Male)": "ko-KR-InJoonNeural", "🇰🇷 SunHi (Female)": "ko-KR-SunHiNeural"}},
    "pl": {"name": "Polish", "wps": 1.95, "voices": {
        "🇵🇱 Marek (Male)": "pl-PL-MarekNeural", "🇵🇱 Zofia (Female)": "pl-PL-ZofiaNeural"}},
    "pt": {"name": "Portuguese", "wps": 2.1, "voices": {
        "🇧🇷 Antonio (Male)": "pt-BR-AntonioNeural", "🇧🇷 Francisca (Female)": "pt-BR-FranciscaNeural"}},
    "ro": {"name": "Romanian", "wps": 2.4, "voices": {
        "🇷🇴 Emil (Male)": "ro-RO-EmilNeural", "🇷🇴 Alina (Female)": "ro-RO-AlinaNeural"}},
    "ru": {"name": "Russian", "wps": 1.8, "voices": {
        "🇷🇺 Dmitry (Male)": "ru-RU-DmitryNeural", "🇷🇺 Svetlana (Female)": "ru-RU-SvetlanaNeural"}},
    "es": {"name": "Spanish", "wps": 2.0, "voices": {
        "🇪🇸 Alvaro (Male)": "es-ES-AlvaroNeural", "🇪🇸 Elvira (Female)": "es-ES-ElviraNeural",
        "🇲🇽 Jorge (Male)": "es-MX-JorgeNeural", "🇲🇽 Dalia (Female)": "es-MX-DaliaNeural"}},
    "tr": {"name": "Turkish", "wps": 1.6, "voices": {
        "🇹🇷 Ahmet (Male)": "tr-TR-AhmetNeural", "🇹🇷 Emel (Female)": "tr-TR-EmelNeural"}},
    "uk": {"name": "Ukrainian", "wps": 1.7, "voices": {
        "🇺🇦 Ostap (Male)": "uk-UA-OstapNeural", "🇺🇦 Polina (Female)": "uk-UA-PolinaNeural"}},
}

EDGE_VOICES = {preset: {"voice": voice, "lang": code} for code, lang in LANGUAGES.items() for preset, voice in lang["voices"].items()}


def voice_language(preset):
    """Every voice speaks one language; anything that isn't an Edge voice (Kokoro, Chatterbox) is English."""
    return EDGE_VOICES[preset]["lang"] if preset in EDGE_VOICES else "en"


def _timed_words(text, events):
    """Boundaries leave out punctuation, so find each word in the script and glue the punctuation back on."""
    words, pos = [], 0
    for event in events:
        start = event["offset"] / 1e7
        word = {"text": event["text"], "start": round(start, 3), "end": round(start + event["duration"] / 1e7, 3)}
        at = text.find(event["text"], pos)
        if at >= 0:
            before, _, after = re.match(r"(\S*)(.*?)(\S*)$", text[pos:at], re.S).groups()
            if words:
                words[-1]["text"] += before
            word["text"] = after + word["text"]
            pos = at + len(event["text"])
        words.append(word)
    if words:
        words[-1]["text"] += text[pos:].strip()
    return words


def synthesize(text, voice, speed=1.0, attempts=6):
    """Returns (float32 samples at 24 kHz, [{text, start, end}]). voice is an edge-tts voice id."""
    import edge_tts
    import soundfile as sf

    async def stream():
        mp3, events = bytearray(), []
        rate = f"{round((speed - 1) * 100):+d}%"
        async for chunk in edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary").stream():
            if chunk["type"] == "audio":
                mp3 += chunk["data"]
            elif chunk["type"] == "WordBoundary":
                events.append(chunk)
        return bytes(mp3), events

    # A voice can drop out for half a minute and come back, so keep trying for about that long.
    for attempt in range(attempts):
        try:
            mp3, events = asyncio.run(stream())
            break
        except Exception as e:
            if attempt == attempts - 1:
                raise RuntimeError(f"Online voice failed (these voices need internet): {e}") from e
            time.sleep(2 ** attempt)

    audio, sr = sf.read(io.BytesIO(mp3), dtype="float32")
    if sr != SAMPLE_RATE:
        raise RuntimeError(f"Unexpected Edge voice sample rate {sr}")
    return audio, _timed_words(text, events)


def generate_edge_voice(text, output_path, preset):
    """Same result as generate_voice: writes the WAV and returns (path, timed subtitle phrases)."""
    import soundfile as sf

    lang = EDGE_VOICES[preset]["lang"]
    print(f"[Edge] Voice: {EDGE_VOICES[preset]['voice']}")
    audio, words = synthesize(text, EDGE_VOICES[preset]["voice"])
    sf.write(output_path, audio, SAMPLE_RATE)

    glue = "" if lang in ("zh", "ja") else " "
    phrases = [words[i:i + PHRASE_WORDS] for i in range(0, len(words), PHRASE_WORDS)]
    return output_path, [{"text": glue.join(w["text"] for w in p), "start": p[0]["start"], "end": p[-1]["end"]} for p in phrases]
