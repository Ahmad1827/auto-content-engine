"""Topic -> finished motion-graphics TikTok (storyboard, voice, render)."""
import json
import os
import re

from llm.provider import describe_provider
from motion_gen.film import make_film, render_film
from motion_gen.narration import DEFAULT_PRESET, voice_language, voice_scenes, words_per_second
from motion_gen.render import ROOT, render
from motion_gen.storyboard import make_storyboard

OUTPUT_DIR = os.path.join(ROOT, "output")
MUSIC_PATH = os.path.join(ROOT, "assets", "music", "background.mp3")


def _slug(text):
    return re.sub(r"\W+", "_", text.lower()).strip("_")[:60] or "video"


def make_motion_video(topic, style="auto", voice=DEFAULT_PRESET, speed=1.1, captions=True, handle="", seconds=55, film_format="auto", log=print):
    log(f"[Motion] AI: {describe_provider()}")
    if style == "film":
        return make_film(topic, _slug, voice, speed=speed, captions=captions, handle=handle, seconds=seconds, music_path=MUSIC_PATH,
                         output_dir=OUTPUT_DIR, film_format=film_format, log=log)
    log(f"[Motion] Writing storyboard for: {topic}")
    language = voice_language(voice)
    board = make_storyboard(topic, style, seconds, words_per_second(voice), language)
    log(f"[Motion] '{board['title']}' - {len(board['scenes'])} scenes, style {board['style']}")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    base = os.path.join(OUTPUT_DIR, _slug(board["title"]))
    with open(base + ".caption.txt", "w", encoding="utf-8") as f:
        f.write(board["caption"] + "\n")

    props = {
        "title": board["title"], "style": board["style"], "fps": 30, "width": 1080, "height": 1920, "captions": captions, "handle": handle,
        "voice": voice, "speed": speed, "language": language, "scenes": board["scenes"],
    }
    video_path = _voice_and_render(props, base, log)
    log(f"[Motion] Caption: {board['caption']}")
    return {"video": video_path, "title": board["title"], "caption": board["caption"]}


def rerender_storyboard(storyboard_path, log=print):
    """Re-voices and re-renders a saved .storyboard.json, e.g. after editing narration or visuals by hand."""
    with open(storyboard_path, encoding="utf-8") as f:
        props = json.load(f)
    base = storyboard_path.removesuffix(".storyboard.json")
    if props.get("film"):
        return render_film(props["film"], base + ".mp4", log)
    return _voice_and_render(props, base, log)


def _voice_and_render(props, base, log):
    wav_path = base + ".wav"
    # Save before voicing too, so a voice or render failure never loses the AI-written storyboard.
    with open(base + ".storyboard.json", "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False, indent=2)
    props["words"] = voice_scenes(props["scenes"], wav_path, preset=props.get("voice", DEFAULT_PRESET),
                                  speed=props.get("speed", 1.1), log=log)
    # Keep the storyboard next to the video so it can be edited and re-rendered.
    with open(base + ".storyboard.json", "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False, indent=2)
    try:
        video_path = render(props, wav_path, base + ".mp4", music_path=MUSIC_PATH, log=log)
    finally:
        os.remove(wav_path)
    log(f"[Motion] Done: {video_path}")
    return video_path
