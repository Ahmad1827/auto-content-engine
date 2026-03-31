"""
medal_fetcher.py — Descarca gaming clips de pe Medal.tv
ID-uri reale din Medal API (stringuri, nu numere).
Daca jocul nu e in lista, cauta automat prin /v1/categories.

Locatie: src/videoclips_gen/medal_fetcher.py
"""
import os
import re
import sys
import time
import subprocess
import requests
import argparse
from dotenv import load_dotenv

load_dotenv()

MEDAL_API = "https://developers.medal.tv/v1"
OUTPUT_DIR = "assets/gaming_clips"
PROXIES_FILE = "proxies.txt"
MAX_PROXY_TRIES = 25
BATCH_SIZE = 3
IP_COOLDOWN = 30

# ── REAL CATEGORY IDs (from /v1/categories, March 2026) ─────
GAME_CONFIG = {
    "cs2":              ("1giLEcuGln2", "CS2"),
    "csgo":             ("eyoeshcla",   "CS2"),
    "counter-strike":   ("1giLEcuGln2", "CS2"),
    "counter-strike 2": ("1giLEcuGln2", "CS2"),
    "valorant":         ("fW3AZxHf_c",  "VALORANT"),
    "fortnite":         ("10cJzcPADb",  "FORTNITE"),
    "apex legends":     ("5FsRVgww4b",  "APEX"),
    "apex":             ("5FsRVgww4b",  "APEX"),
    "overwatch":        ("17TfcRrk82u", "OVERWATCH"),
    "overwatch 2":      ("17TfcRrk82u", "OVERWATCH"),
    "pubg":             ("F6MuXa5mt",   "PUBG"),
    "r6":               ("HAuR_DD5N",   "R6"),
    "rainbow six":      ("HAuR_DD5N",   "R6"),
    "r6 siege":         ("HAuR_DD5N",   "R6"),
    "halo infinite":    ("105S0lvUpwS", "HALO"),
    "halo":             ("105S0lvUpwS", "HALO"),
    "escape from tarkov": ("58Hcgg-9iy","TARKOV"),
    "tarkov":           ("58Hcgg-9iy",  "TARKOV"),
    "rust":             ("zEbPMXAEQ",   "RUST"),
    "call of duty":     ("9dhq1LMjfa",  "COD"),
    "cod":              ("9dhq1LMjfa",  "COD"),
    "warzone":          ("asDKz37w_2",  "WARZONE"),
    "cod warzone":      ("asDKz37w_2",  "WARZONE"),
    "cod mw2":          ("1c8qYLgO5mz", "CODMW2"),
    "cod mw3":          ("1ptnxyUOipV", "CODMW3"),
    "modern warfare 2": ("1c8qYLgO5mz", "CODMW2"),
    "modern warfare 3": ("1ptnxyUOipV", "CODMW3"),
    "black ops 6":      ("1AgyvzoAPxx", "CODBO6"),
    "bo6":              ("1AgyvzoAPxx", "CODBO6"),
    "cold war":         ("ASQM0P4P8Y",  "CODCW"),
    "black ops 3":      ("aHGYsEp_zQ",  "CODBO3"),
    "minecraft":        ("hAXdelx2t",   "MINECRAFT"),
    "roblox":           ("1e2Ad6EOaE",  "ROBLOX"),
    "gta":              ("r-K7qepLC",   "GTA"),
    "gta v":            ("r-K7qepLC",   "GTA"),
    "gta 5":            ("r-K7qepLC",   "GTA"),
    "garry's mod":      ("1pDATMX2mB",  "GMOD"),
    "gmod":             ("1pDATMX2mB",  "GMOD"),
    "sea of thieves":   ("5aeY-3rMsM",  "SEAOFTHIEVES"),
    "lethal company":   ("1pTYd0iI8WH", "LETHALCOMPANY"),
    "red dead":         ("2gEBKR396v",  "RDR2"),
    "rdr2":             ("2gEBKR396v",  "RDR2"),
    "league of legends":("bQnfO2HXP",  "LOL"),
    "lol":              ("bQnfO2HXP",  "LOL"),
    "rocket league":    ("adufon9HW",   "ROCKETLEAGUE"),
    "dead by daylight": ("NhmIr3ilN",   "DBD"),
    "dbd":              ("NhmIr3ilN",   "DBD"),
    "among us":         ("jWJFXzRX-z",  "AMONGUS"),
    "fall guys":        ("qsSVr0draJ",  "FALLGUYS"),
    "destiny 2":        ("T0D0Hv3ba",   "DESTINY2"),
    "repo":             ("1HfH5qHqa1y", "REPO"),
}

_category_cache = {}


def resolve_api_key(game_name):
    key_lower = game_name.lower().strip()
    suffix = None
    for name, (_, env_suffix) in GAME_CONFIG.items():
        if key_lower == name or key_lower in name or name in key_lower:
            suffix = env_suffix
            break
    if not suffix:
        suffix = re.sub(r'[^a-zA-Z0-9]', '', game_name.upper())

    env_key = f"MEDAL_GAME_KEY_{suffix}"
    api_key = os.getenv(env_key, "")
    if api_key:
        print(f"[Medal] Using key: {env_key}")
        return api_key

    api_key = os.getenv("MEDAL_API_KEY", "")
    if api_key:
        print(f"[Medal] Using MEDAL_API_KEY (general)")
        return api_key

    for key, val in os.environ.items():
        if key.startswith("MEDAL_GAME_KEY_") and val:
            print(f"[Medal] Fallback: {key}")
            return val

    print(f"[Medal] No API key found!")
    return ""


def find_game_id(game_name, api_key=""):
    key = game_name.lower().strip()
    for name, (cat_id, _) in GAME_CONFIG.items():
        if key == name or key in name or name in key:
            print(f"[Medal] '{game_name}' -> {cat_id}")
            return cat_id
    return _dynamic_game_lookup(game_name, api_key)


def _dynamic_game_lookup(game_name, api_key):
    global _category_cache
    if not api_key:
        return None

    if not _category_cache:
        print(f"[Medal] Loading categories from API...")
        try:
            resp = requests.get(f"{MEDAL_API}/categories",
                                headers={"Authorization": api_key}, timeout=10)
            if resp.status_code == 200:
                for cat in resp.json():
                    if cat.get("isGame") or cat.get("game"):
                        name = cat.get("categoryName", "").lower()
                        slug = cat.get("slug", "").lower()
                        _category_cache[name] = cat["categoryId"]
                        _category_cache[slug] = cat["categoryId"]
                print(f"[Medal] Cached {len(_category_cache)} games")
        except Exception as e:
            print(f"[Medal] Categories fetch failed: {e}")
            return None

    search = game_name.lower().strip()
    if search in _category_cache:
        cid = _category_cache[search]
        print(f"[Medal] Dynamic match: '{game_name}' -> {cid}")
        return cid

    for name, cid in _category_cache.items():
        if search in name or name in search:
            print(f"[Medal] Partial match: '{game_name}' ~ '{name}' -> {cid}")
            return cid

    print(f"[Medal] No game found for '{game_name}'")
    return None


# ── PROXY ────────────────────────────────────────────────────
def load_proxies():
    if not os.path.exists(PROXIES_FILE):
        return []
    with open(PROXIES_FILE, "r") as f:
        return [line.strip() for line in f if line.strip()]


def refresh_proxies():
    for path in [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "utils", "proxy_api.py"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "proxy_api.py"),
    ]:
        if os.path.exists(path):
            try:
                subprocess.run([sys.executable, path], check=True,
                               capture_output=True, text=True, timeout=120)
            except Exception as e:
                print(f"[PROXY] Failed: {e}")
            return load_proxies()
    return load_proxies()


def get_proxy_dict(px):
    if px.startswith("http"):
        return {"http": px, "https": px}
    return {"http": f"http://{px}", "https": f"http://{px}"}


def fetch_json(url, headers, proxies_list, prx_idx, last_ip_time):
    if time.time() - last_ip_time >= IP_COOLDOWN or last_ip_time == 0:
        try:
            resp = requests.get(url, headers=headers, timeout=8)
            last_ip_time = time.time()
            if resp.status_code == 200:
                return resp.json(), prx_idx, last_ip_time
            elif resp.status_code == 429:
                print(f"    [RATE-LIMITED] Direct IP")
        except Exception:
            last_ip_time = time.time()

    tries = 0
    batch_count = 0
    while tries < MAX_PROXY_TRIES:
        if prx_idx >= len(proxies_list):
            proxies_list = refresh_proxies()
            prx_idx = 0
            if not proxies_list:
                break
        if batch_count >= BATCH_SIZE:
            prx_idx += 1
            batch_count = 0
            continue
        px = proxies_list[prx_idx]
        try:
            resp = requests.get(url, headers=headers, timeout=6,
                                proxies=get_proxy_dict(px))
            if resp.status_code == 200:
                batch_count += 1
                return resp.json(), prx_idx, last_ip_time
            else:
                prx_idx += 1
                batch_count = 0
                tries += 1
        except Exception:
            prx_idx += 1
            batch_count = 0
            tries += 1

    return None, prx_idx, last_ip_time


# ── MEDAL API ────────────────────────────────────────────────
def get_trending_clips(game_name, limit=10):
    api_key = resolve_api_key(game_name)
    if not api_key:
        return []

    game_id = find_game_id(game_name, api_key)
    headers = {"Authorization": api_key}
    proxies = load_proxies()
    prx_idx = 0
    last_ip = 0.0
    all_clips = []

    if game_id:
        url = f"{MEDAL_API}/trending?categoryId={game_id}&limit={limit}"
        print(f"[Medal] Trending: {game_name} (ID: {game_id})")
        data, prx_idx, last_ip = fetch_json(url, headers, proxies, prx_idx, last_ip)
        if data and "contentObjects" in data:
            all_clips.extend(data["contentObjects"])
            print(f"[Medal] Got {len(data['contentObjects'])} trending clips")

    if len(all_clips) < limit:
        remaining = limit - len(all_clips)
        url2 = f"{MEDAL_API}/search?text={game_name}&limit={remaining}"
        print(f"[Medal] Search: '{game_name}' ({remaining} more)")
        time.sleep(0.5)
        data2, prx_idx, last_ip = fetch_json(url2, headers, proxies, prx_idx, last_ip)
        if data2 and "contentObjects" in data2:
            all_clips.extend(data2["contentObjects"])

    if not all_clips:
        print("[Medal] No clips found")
        return []

    print(f"[Medal] Total clips: {len(all_clips)}")
    return all_clips


# ── DOWNLOAD ─────────────────────────────────────────────────
def extract_video_url(clip_page_url):
    try:
        resp = requests.get(clip_page_url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        if resp.status_code != 200:
            return None
        patterns = [
            r'<meta\s+property="og:video"\s+content="([^"]+)"',
            r'<meta\s+content="([^"]+)"\s+property="og:video"',
            r'"contentUrl"\s*:\s*"([^"]+\.mp4[^"]*)"',
            r'"videoUrl"\s*:\s*"([^"]+\.mp4[^"]*)"',
            r'src="(https://[^"]+\.mp4[^"]*)"',
            r'"(https://cdn\.medal\.tv/[^"]+)"',
        ]
        for pattern in patterns:
            match = re.search(pattern, resp.text)
            if match:
                url = match.group(1)
                if '.mp4' in url or 'cdn.medal' in url:
                    return url
        return None
    except Exception:
        return None


def download_clips(clips, output_dir=OUTPUT_DIR, max_clips=10):
    os.makedirs(output_dir, exist_ok=True)
    for f in os.listdir(output_dir):
        if f.startswith('clip_') and f.endswith('.mp4'):
            os.remove(os.path.join(output_dir, f))

    downloaded = []
    print(f"\n[Download] Up to {min(len(clips), max_clips)} clips...")

    for i, clip in enumerate(clips[:max_clips]):
        title = clip.get("contentTitle", "untitled")[:50]
        clip_url = clip.get("directClipUrl", "")
        duration = clip.get("videoLengthSeconds", 0)

        print(f"  [{i+1}] \"{title}\" ({duration}s)")
        if not clip_url:
            continue

        video_url = extract_video_url(clip_url)
        if not video_url:
            print(f"       -> Can't extract video URL")
            continue

        file_path = os.path.join(output_dir, f"clip_{i+1:03d}.mp4")
        try:
            resp = requests.get(video_url, timeout=30, stream=True,
                                headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                with open(file_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        f.write(chunk)
                size_mb = os.path.getsize(file_path) / (1024 * 1024)
                if size_mb < 0.01:
                    os.remove(file_path)
                    continue
                downloaded.append(file_path)
                print(f"       -> OK: {file_path} ({size_mb:.1f}MB)")
            else:
                print(f"       -> HTTP {resp.status_code}")
        except Exception as e:
            print(f"       -> Error: {str(e)[:60]}")
        time.sleep(0.3)

    print(f"[Download] Got {len(downloaded)}/{min(len(clips), max_clips)} clips")
    return downloaded


def fetch_gaming_clips(game_name, num_clips=5):
    clips = get_trending_clips(game_name, limit=num_clips * 3)
    if not clips:
        return []
    
    # Skip montages, edits, intros — vrem gameplay raw
    skip_words = ["montage", "edit", "intro", "cinematic", "trailer", 
                  "highlight reel", "compilation", "movavi", "filmora",
                  "capcut", "thumbnail"]
    
    filtered = []
    for c in clips:
        title = c.get("contentTitle", "").lower()
        duration = c.get("videoLengthSeconds", 0)
        # Skip: titluri cu edit words, clipuri prea scurte (<5s) sau prea lungi (>45s)
        if any(w in title for w in skip_words):
            continue
        if duration < 5 or duration > 45:
            continue
        filtered.append(c)
    
    if not filtered:
        filtered = [c for c in clips if 5 <= c.get("videoLengthSeconds", 0) <= 60]
    if not filtered:
        filtered = clips
    
    filtered.sort(key=lambda c: c.get("contentViews", 0), reverse=True)
    return download_clips(filtered, max_clips=num_clips)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("game", nargs="?")
    parser.add_argument("count", nargs="?", type=int, default=5)
    args = parser.parse_args()
    if args.game:
        fetch_gaming_clips(args.game, args.count)
    else:
        print("Usage: python medal_fetcher.py 'CS2' 5")
