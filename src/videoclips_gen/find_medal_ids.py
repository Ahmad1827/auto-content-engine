"""Cauta categoryId-urile reale pt jocurile noastre."""
import requests, os, json
from dotenv import load_dotenv
load_dotenv()

key = os.getenv("MEDAL_GAME_KEY_CS2")
r = requests.get("https://developers.medal.tv/v1/categories", headers={"Authorization": key})
cats = r.json()

# Jocurile pe care le vrem
search = ["counter-strike", "cs2", "fortnite", "valorant", "roblox", 
          "minecraft", "sea of thieves", "apex", "call of duty", "warzone",
          "league of legends", "rocket league", "gta", "overwatch", "pubg",
          "rainbow six", "dead by daylight", "among us", "fall guys", 
          "destiny", "halo", "world of"]

games_only = [c for c in cats if c.get("isGame") or c.get("game")]
print(f"Total categories: {len(cats)}, Games: {len(games_only)}\n")

print("=== MATCHING GAMES ===")
found = set()
for term in search:
    for c in cats:
        name = c.get("categoryName", "").lower()
        alt = c.get("alternativeName", "").lower()
        slug = c.get("slug", "").lower()
        if term in name or term in alt or term in slug:
            cid = c["categoryId"]
            if cid not in found:
                found.add(cid)
                clips = c.get("publishedClipCount", 0)
                print(f'    "{slug}": ("{cid}", "{c["categoryName"]}"),  # {clips:,} clips')

print(f"\n=== TOP 20 GAMES BY CLIPS ===")
games_only.sort(key=lambda c: c.get("publishedClipCount", 0), reverse=True)
for c in games_only[:20]:
    cid = c["categoryId"]
    clips = c.get("publishedClipCount", 0)
    slug = c.get("slug", "")
    print(f'    "{slug}": "{cid}",  # {c["categoryName"]} ({clips:,} clips)')
