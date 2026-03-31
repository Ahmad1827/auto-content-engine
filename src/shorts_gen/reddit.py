import requests

def get_reddit_stories(subreddit="AmItheAsshole", limit=5):
    url = f"https://www.reddit.com/r/{subreddit}/top.json?t=day&limit={limit}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"}
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            stories = []
            for post in data.get('data', {}).get('children', []):
                post_data = post['data']
                if not post_data.get('stickied') and not post_data.get('over_18'):
                    title = post_data.get('title', '')
                    body = post_data.get('selftext', '')
                    if body:
                        stories.append({
                            "title": title,
                            "body": body,
                            "author": post_data.get('author', 'Anonymous')
                        })
            return stories
    except Exception as e:
        print(f"[Error] Reddit scrape failed: {e}")
    return []

def format_story_for_tts(story):
    return f"{story['title']}... \n\n{story['body']}"