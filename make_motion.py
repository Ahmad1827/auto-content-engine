"""Command-line motion video maker.

    python make_motion.py "The Karboğazı ambush, 1920" --style atlas
    python make_motion.py "The fall of Constantinople" --language ro
    python make_motion.py "Why you can't escape quicksand" --style film   # Claude builds a one-off 3D film for this topic
    python make_motion.py --from-storyboard output/<name>.storyboard.json   # re-render after editing
"""
import argparse
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from motion_gen.film import FORMATS
from motion_gen.narration import CHATTERBOX_VOICES, DEFAULT_PRESET
from motion_gen.pipeline import make_motion_video, rerender_storyboard
from voice_gen.edge_narration import LANGUAGES, voice_language


def main():
    parser = argparse.ArgumentParser(description="Make an animated TikTok from a topic.")
    parser.add_argument("topic", nargs="?")
    parser.add_argument("--from-storyboard", help="Re-render a saved .storyboard.json instead of writing a new one")
    parser.add_argument("--style", choices=["auto", "atlas", "ink", "parchment", "neon", "newspaper", "pixel", "diorama", "film"], default="auto")
    parser.add_argument("--format", dest="film_format", choices=["auto", *FORMATS], default="auto", help="Kind of story for --style film")
    parser.add_argument("--language", choices=list(LANGUAGES), help="Language of the video; picks that language's first voice")
    parser.add_argument("--voice",
                        help="A Kokoro preset (voice_gen/kokoro_narration.py), a Chatterbox voice (motion_gen/narration.py), "
                             "an Edge voice (voice_gen/edge_narration.py), or 'chatterbox'")
    parser.add_argument("--speed", type=float, default=1.1)
    parser.add_argument("--handle", default="", help="e.g. @yourchannel, shown at the bottom")
    parser.add_argument("--no-captions", action="store_true")
    parser.add_argument("--seconds", type=int, default=55, help="Target video length")
    args = parser.parse_args()
    if args.from_storyboard:
        rerender_storyboard(args.from_storyboard)
        return
    if not args.topic:
        parser.error("give a topic or --from-storyboard")
    if args.voice == "chatterbox":
        args.voice = next(iter(CHATTERBOX_VOICES))
    if not args.voice:
        args.voice = next(iter(LANGUAGES[args.language or "en"]["voices"]), DEFAULT_PRESET)
    elif args.language and voice_language(args.voice) != args.language:
        parser.error(f"--voice speaks {LANGUAGES[voice_language(args.voice)]['name']}, not {LANGUAGES[args.language]['name']}")
    make_motion_video(args.topic, style=args.style, voice=args.voice, speed=args.speed,
                      captions=not args.no_captions, handle=args.handle, seconds=args.seconds, film_format=args.film_format)


if __name__ == "__main__":
    main()
