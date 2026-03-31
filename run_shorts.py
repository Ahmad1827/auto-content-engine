import os
from src.shorts_gen.reddit import get_reddit_stories, format_story_for_tts
from src.voice_gen.kokoro_narration import generate_voice
from src.voice_gen.subtitles import generate_srt_from_chunks
from src.shorts_gen.editor import create_short_video

def main():
    print("=== TIKTOK / SHORTS REDDIT AUTOMATOR ===")
    
    # Ensure you have a background video ready
    bg_video = "assets/background.mp4"
    if not os.path.exists(bg_video):
        print(f"\n[!] WARNING: Please put a satisfying background video (like Minecraft Parkour) at {bg_video}")
        return

    sub = input("Enter a subreddit (default: AmItheAsshole): ").strip()
    if not sub: sub = "AmItheAsshole"
        
    print(f"\nFetching top stories from r/{sub}...")
    stories = get_reddit_stories(subreddit=sub, limit=10)
    
    if not stories:
        print("No text-based stories found today.")
        return
        
    print("\nTop Stories:")
    for i, s in enumerate(stories):
        print(f"[{i+1}] {s['title'][:80]}...")
        
    choice = input("\nPick a story number to generate a video (or 'q' to quit): ").strip()
    if choice.lower() == 'q': return
    
    try:
        story_idx = int(choice) - 1
        selected_story = stories[story_idx]
    except:
        print("Invalid choice.")
        return
        
    script = format_story_for_tts(selected_story)
    print("\n[1/3] Generating Voice with Kokoro TTS...")
    
    # We use a good storytelling voice
    audio_path, chunk_timings = generate_voice(script, output_path="short_audio.wav", preset="🇺🇸 AM - Michael (Deep/News)")
    
    print("\n[2/3] Generating Subtitles...")
    srt_path = generate_srt_from_chunks(chunk_timings, output_srt="short_subs.srt")
    
    print("\n[3/3] Rendering TikTok/Short...")
    create_short_video(audio_path, srt_path, bg_video, output_path="final_tiktok.mp4")
    
    print("\n=== ALL DONE! ===")

if __name__ == "__main__":
    main()