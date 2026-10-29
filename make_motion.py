"""Command-line motion video maker.

    python make_motion.py "The Karboğazı ambush, 1920" --style atlas
    python make_motion.py --from-storyboard output/<name>.storyboard.json   # re-render after editing
"""
import argparse
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from motion_gen.narration import CHATTERBOX_VOICES, DEFAULT_PRESET
from motion_gen.pipeline import make_motion_video, rerender_storyboard


def main():
    parser = argparse.ArgumentParser(description="Make an animated TikTok from a topic.")
    parser.add_argument("topic", nargs="?")
    parser.add_argument("--from-storyboard", help="Re-render a saved .storyboard.json instead of writing a new one")
    parser.add_argument("--style", choices=["auto", "atlas", "ink", "parchment", "neon", "newspaper", "pixel", "diorama"], default="auto")
    parser.add_argument("--voice", default=DEFAULT_PRESET,
                        help="A Kokoro preset (voice_gen/kokoro_narration.py), a Chatterbox voice (motion_gen/narration.py), or 'chatterbox'")
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
    make_motion_video(args.topic, style=args.style, voice=args.voice, speed=args.speed,
                      captions=not args.no_captions, handle=args.handle, seconds=args.seconds)


if __name__ == "__main__":
    main()
