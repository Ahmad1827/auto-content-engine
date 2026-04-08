import os
import re
import time
import requests
from dotenv import load_dotenv

load_dotenv()

MEDAL_API = "https://developers.medal.tv/v1"
OUTPUT_DIR = "assets/gaming_clips"

GAME_CONFIG = {
    "cs2":              ("1giLEcuGln2", "CS2"),
    "valorant":         ("fW3AZxHf_c",  "VALORANT"),
    "fortnite":         ("10cJzcPADb",  "FORTNITE"),
    "minecraft":        ("hAXdelx2t",   "MINECRAFT"),
    "gta":              ("r-K7qepLC",   "GTA"),
    "gta v":            ("r-K7qepLC",   "GTA"),
    "rocket league":    ("adufon9HW",   "ROCKETLEAGUE"),
}

def resolve_api_key(game_name):
    key_lower = game_name.lower().strip()
    suffix = next((env_suffix for name, (_, env_suffix) in GAME_CONFIG.items() if key_lower in name), None)
    if not suffix:
        suffix = re.sub(r'[^a-zA-Z0-9]', '', game_name.upper())

    env_key = f"MEDAL_GAME_KEY_{suffix}"
    api_key = os.getenv(env_key) or os.getenv("MEDAL_API_KEY", "")
    if not api_key:
        print("[Medal] WARNING: No MEDAL_API_KEY found in .env!")
    return api_key

def get_trending_clips(game_name, limit=5):
    api_key = resolve_api_key(game_name)
    if not api_key: return []

    game_id = next((cat_id for name, (cat_id, _) in GAME_CONFIG.items() if game_name.lower().strip() in name), None)
    if not game_id:
        print(f"[Medal] Game ID for '{game_name}' not found in config. Skipping.")
        return []

    url = f"{MEDAL_API}/trending?categoryId={game_id}&limit={limit}"
    try:
        resp = requests.get(url, headers={"Authorization": api_key}, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("contentObjects", [])
    except Exception as e:
        print(f"[Medal] API Error: {e}")
    return []

def extract_video_url(clip_page_url):
    try:
        resp = requests.get(clip_page_url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200: return None
        
        patterns = [
            r'"contentUrl"\s*:\s*"([^"]+\.mp4[^"]*)"',
            r'"videoUrl"\s*:\s*"([^"]+\.mp4[^"]*)"',
            r'src="(https://[^"]+\.mp4[^"]*)"',
            r'"(https://cdn\.medal\.tv/[^"]+)"'
        ]
        for pattern in patterns:
            match = re.search(pattern, resp.text)
            if match and ('.mp4' in match.group(1) or 'cdn.medal' in match.group(1)):
                return match.group(1)
    except: pass
    return None

def fetch_gaming_clips(game_name, num_clips=1):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    clips = get_trending_clips(game_name, limit=num_clips * 3)
    if not clips: return []

    skip_words = ["montage", "edit", "intro", "cinematic", "trailer"]
    filtered = [c for c in clips if not any(w in c.get("contentTitle", "").lower() for w in skip_words) and 15 <= c.get("videoLengthSeconds", 0) <= 60]
    
    if not filtered: filtered = clips
    filtered.sort(key=lambda c: c.get("contentViews", 0), reverse=True)

    downloaded = []
    print(f"[Medal] Found {len(filtered)} potential clips. Downloading top {num_clips}...")

    for i, clip in enumerate(filtered[:num_clips]):
        clip_url = clip.get("directClipUrl", "")
        if not clip_url: continue

        video_url = extract_video_url(clip_url)
        if not video_url: continue

        file_path = os.path.join(OUTPUT_DIR, f"bg_clip_{i+1}.mp4")
        try:
            resp = requests.get(video_url, stream=True, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
            if resp.status_code == 200:
                with open(file_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192): f.write(chunk)
                downloaded.append(file_path)
                print(f"[Medal] Downloaded: {clip.get('contentTitle', 'Untitled')}")
        except: continue

    return downloaded