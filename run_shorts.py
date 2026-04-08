import os
from src.shorts_gen.reddit import get_reddit_stories, format_story_for_tts
from src.voice_gen.kokoro_narration import generate_voice
from src.voice_gen.subtitles import generate_srt_from_chunks
from src.shorts_gen.editor import create_short_video

def main():
    print("=== TIKTOK / SHORTS REDDIT AUTOMATOR ===")
    
    # 1. Ask for Subreddit
    sub = input("Enter a subreddit (default: AmItheAsshole): ").strip()
    if not sub: sub = "AmItheAsshole"
        
    # 2. Fetch Stories
    print(f"\n[1/3] Fetching top stories from r/{sub}...")
    stories = get_reddit_stories(subreddit=sub, limit=10)
    
    if not stories:
        print("No text-based stories found today.")
        return
        
    print("\nTop Stories:")
    for i, s in enumerate(stories):
        print(f"[{i+1}] {s['title'][:80]}...")
        
    # 3. User Selection
    choice = input("\nPick a story number to generate a video (or 'q' to quit): ").strip()
    if choice.lower() == 'q': return
    
    try:
        selected_story = stories[int(choice) - 1]
    except:
        print("Invalid choice.")
        return

    script = format_story_for_tts(selected_story)
    
    # 4. Generate Voice and Subtitles
    print("\n[2/3] Generating Voice and Subtitles...")
    # Using the Storytelling preset for Reddit stories
    audio_path, chunk_timings = generate_voice(script, output_path="short_audio.wav", preset="🇬🇧 BF - Alice (Storytelling)")
    srt_path = generate_srt_from_chunks(chunk_timings, output_srt="short_subs.srt")
    
    # 5. Render Video
    print("\n[3/3] Rendering TikTok/Short...")
    create_short_video(audio_path, srt_path, bg_video_path="assets/background.mp4", output_path="final_tiktok.mp4")
    
    print("\n=== ALL DONE! Check final_tiktok.mp4 ===")

if __name__ == "__main__":
    main()