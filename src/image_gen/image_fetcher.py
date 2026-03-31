"""
image_fetcher.py — Descarca imagini relevante de pe internet pt video content.

Surse (in ordine):
  1. DuckDuckGo Image Search (FREE, no API key, cauta pe TOT internetul)
  2. Gemini Flash Image (FREE, 500/zi — fallback/augmentare AI)

Gemini genereaza query-uri optimizate → DuckDuckGo gaseste poze reale HD.
Daca DDG nu gaseste destule, Gemini genereaza restul cu AI.

Instalare: pip install duckduckgo-search

Folosire:
    python image_fetcher.py "Ancient Rome" 8
    python image_fetcher.py --script generated_script.txt 10
"""
import os
import re
import sys
import time
import requests
import argparse
from dotenv import load_dotenv

load_dotenv()

OUTPUT_DIR = "assets/curated_pool"


# ── GEMINI QUERY GENERATOR ───────────────────────────────────
def generate_search_queries(topic_or_script, num_images):
    """Gemini genereaza query-uri optimizate pt image search."""
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return _simple_queries(topic_or_script, num_images)

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')

        prompt = f"""You are a visual director. Generate exactly {num_images} image search queries for a YouTube narration video.

RULES:
- Each query: 4-8 words, highly specific and visual
- Queries must match the content IN ORDER (scene by scene)
- Focus on: landscapes, historical sites, objects, nature, architecture, dramatic scenes
- Add style words like: "aerial view", "close-up", "cinematic", "dramatic lighting", "4K"
- NO people faces, NO text overlays, NO logos, NO cartoons
- NO weapons, NO guns, NO violence, NO blood, NO gore, NO military combat
- Focus on environments, scenery, objects, abstract concepts, emotions through visuals
- Each query MUST be unique
- Think like a photographer searching for the perfect shot

CONTENT:
{topic_or_script[:3000]}

Return ONLY the search queries, one per line, no numbering, no quotes."""

        response = model.generate_content(prompt)
        queries = []
        for line in response.text.strip().split('\n'):
            line = re.sub(r'^\d+[\.\)\-]\s*', '', line.strip())
            line = line.strip('"').strip("'").strip('-').strip('•').strip()
            if line and len(line) > 3:
                queries.append(line)

        while len(queries) < num_images:
            queries.append(f"{topic_or_script.split('.')[0]} cinematic 4K")

        print(f"[ImageFetcher] Gemini generated {len(queries[:num_images])} search queries")
        return queries[:num_images]
    except Exception as e:
        print(f"[ImageFetcher] Gemini query error: {e}")
        return _simple_queries(topic_or_script, num_images)


def _simple_queries(text, n):
    """Fallback: extrage cuvinte cheie simple."""
    words = text.split()[:50]
    chunks = [' '.join(words[i:i+4]) for i in range(0, min(len(words), n*4), 4)]
    while len(chunks) < n:
        chunks.append("cinematic landscape dramatic")
    return chunks[:n]


# ── DUCKDUCKGO IMAGE SEARCH (PRIMARY) ────────────────────────
def search_duckduckgo(queries, output_dir=OUTPUT_DIR):
    """
    Cauta imagini pe tot internetul via DuckDuckGo.
    FREE, no API key, HD images, powered by Bing.
    """
    from duckduckgo_search import DDGS

    os.makedirs(output_dir, exist_ok=True)
    _clean_old_scenes(output_dir)

    downloaded = []
    ddgs = DDGS()

    print(f"\n[DuckDuckGo] Searching {len(queries)} images...")

    for i, query in enumerate(queries):
        print(f"  [{i+1}/{len(queries)}] \"{query}\"")
        try:
            results = ddgs.images(
                keywords=query,
                region="wt-wt",
                safesearch="off",
                size="Large",          # doar imagini HD
                type_image="photo",    # doar fotografii, nu clipart
                layout="Wide",         # landscape orientation
                max_results=3,         # ia 3 si alege prima care merge
            )

            saved = False
            for result in results:
                img_url = result.get("image", "")
                if not img_url:
                    continue
                try:
                    resp = requests.get(img_url, timeout=10, headers={
                        "User-Agent": "Mozilla/5.0"
                    })
                    if resp.status_code == 200 and len(resp.content) > 10000:
                        ext = "jpg"
                        if "png" in resp.headers.get("Content-Type", ""):
                            ext = "png"
                        file_path = os.path.join(output_dir, f"scene_{i+1:03d}.{ext}")
                        with open(file_path, "wb") as f:
                            f.write(resp.content)
                        downloaded.append(file_path)
                        print(f"           -> Saved: {file_path} ({len(resp.content)//1024}KB)")
                        saved = True
                        break
                except Exception:
                    continue

            if not saved:
                print(f"           -> No downloadable image found")

            time.sleep(0.5)  # politeness delay

        except Exception as e:
            print(f"           -> DDG error: {str(e)[:80]}")

    print(f"[DuckDuckGo] Downloaded {len(downloaded)}/{len(queries)} images")
    return downloaded


# ── GEMINI FLASH IMAGE (FALLBACK/AUGMENTATION) ───────────────
def generate_with_gemini_image(prompts, output_dir=OUTPUT_DIR, start_idx=0):
    """
    Genereaza imagini cu Gemini Flash Image (FREE, 500/zi).
    Folosit ca fallback cand DDG nu gaseste destule.
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("[Gemini Image] google-genai not installed. pip install google-genai")
        return []

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return []

    client = genai.Client(api_key=api_key)
    os.makedirs(output_dir, exist_ok=True)
    generated = []

    print(f"\n[Gemini Image] Generating {len(prompts)} images (FREE)...")

    for i, prompt in enumerate(prompts):
        idx = start_idx + i + 1
        print(f"  [{i+1}/{len(prompts)}] \"{prompt[:60]}...\"")
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash-image',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=['IMAGE'],
                    image_config=types.ImageConfig(aspect_ratio='16:9')
                )
            )

            image_bytes = None
            if response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        image_bytes = part.inline_data.data
                        break

            if image_bytes:
                file_path = os.path.join(output_dir, f"scene_{idx:03d}.png")
                with open(file_path, "wb") as f:
                    f.write(image_bytes)
                generated.append(file_path)
                print(f"           -> Generated: {file_path}")
            else:
                print(f"           -> No image returned")
        except Exception as e:
            err = str(e)
            print(f"           -> Error: {err[:80]}")
            if "429" in err or "quota" in err.lower():
                print("[Gemini Image] Rate limit, stopping.")
                break

    print(f"[Gemini Image] Generated {len(generated)}/{len(prompts)}")
    return generated


# ── MAIN FETCHER ─────────────────────────────────────────────
def fetch_images(topic_or_script, num_images=8, use_gemini_fallback=True):
    """
    Functia principala.
    1. Gemini genereaza query-uri optime
    2. DuckDuckGo cauta imagini reale HD
    3. Daca lipsesc, Gemini Image genereaza restul
    """
    queries = generate_search_queries(topic_or_script, num_images)

    # DuckDuckGo primary
    downloaded = search_duckduckgo(queries)

    # Gemini Image fallback
    if len(downloaded) < num_images and use_gemini_fallback:
        missing = num_images - len(downloaded)
        print(f"\n[ImageFetcher] DDG got {len(downloaded)}/{num_images}. Generating {missing} with Gemini Image...")
        missing_queries = queries[len(downloaded):]
        if not missing_queries:
            missing_queries = [f"cinematic {topic_or_script.split('.')[0]} scene {j}" for j in range(missing)]
        gemini_imgs = generate_with_gemini_image(
            missing_queries[:missing],
            start_idx=len(downloaded)
        )
        downloaded.extend(gemini_imgs)

    print(f"\n[ImageFetcher] TOTAL: {len(downloaded)} images in {OUTPUT_DIR}")
    return downloaded


def _clean_old_scenes(output_dir):
    if os.path.exists(output_dir):
        for f in os.listdir(output_dir):
            if f.startswith('scene_') and f.endswith(('.jpg', '.png', '.jpeg')):
                os.remove(os.path.join(output_dir, f))


# ── CLI ──────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download relevant images for video content")
    parser.add_argument("topic", nargs="?", default=None, help="Topic or text")
    parser.add_argument("count", nargs="?", type=int, default=8, help="Number of images")
    parser.add_argument("--script", type=str, help="Read from text file")
    parser.add_argument("--no-gemini", action="store_true", help="Skip Gemini Image fallback")
    args = parser.parse_args()

    if args.script:
        with open(args.script, "r", encoding="utf-8") as f:
            text = f.read()
    elif args.topic:
        text = args.topic
    else:
        print("Usage: python image_fetcher.py 'Ancient Rome' 8")
        print("       python image_fetcher.py --script script.txt 10")
        sys.exit(1)

    fetch_images(text, args.count, use_gemini_fallback=not args.no_gemini)
