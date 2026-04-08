"""
run_shorts.py — Lanseaza pipeline-ul Reddit Story / Shorts.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))

from shorts_gen.reddit import get_reddit_stories, format_story_for_tts
from shorts_gen.editor import create_video
from voice_gen.kokoro_narration import generate_voice, VOICE_PRESETS
from voice_gen.subtitles import generate_srt_from_chunks


def main():
    print("=== Reddit Story Video Generator ===\n")

    subreddit = input("Subreddit (default: AmItheAsshole): ").strip() or "AmItheAsshole"
    print(f"\nFetching stories from r/{subreddit}...")

    stories = get_reddit_stories(subreddit=subreddit, limit=10)
    if not stories:
        print("No stories found!")
        return

    print(f"\nFound {len(stories)} stories:\n")
    for i, s in enumerate(stories):
        print(f"  {i+1}. {s['title'][:80]}")

    choice = int(input("\nPick a story (number): ").strip()) - 1
    if choice < 0 or choice >= len(stories):
        print("Invalid choice!")
        return

    story = stories[choice]
    script = format_story_for_tts(story)

    # Voice
    print("\nAvailable voices:")
    voice_list = list(VOICE_PRESETS.keys())
    for i, v in enumerate(voice_list[:10]):
        print(f"  {i+1}. {v}")
    v_choice = input(f"Voice (1-{min(10, len(voice_list))}, default 1): ").strip()
    voice = voice_list[int(v_choice) - 1] if v_choice.isdigit() else voice_list[0]

    # Format
    fmt = input("Format — Short (s) or Long (l)? [s]: ").strip().lower()
    is_short = fmt != 'l'

    # Generate
    print("\n[1/3] Generating voice...")
    audio_path, timings = generate_voice(script, output_path="short_audio.wav", preset=voice)
    if not audio_path:
        print("Audio generation failed!")
        return

    print("[2/3] Generating subtitles...")
    srt_path = generate_srt_from_chunks(timings, output_srt="short_subs.srt")

    print("[3/3] Rendering video...")
    bg_video = "assets/background.mp4"
    out = "final_tiktok.mp4" if is_short else "final_youtube.mp4"

    success, msg = create_video(audio_path, srt_path, bg_video_path=bg_video,
                                 output_path=out, is_short=is_short)
    if success:
        print(f"\nDone! → {out}")
    else:
        print(f"\nFailed: {msg}")


if __name__ == "__main__":
    main()
