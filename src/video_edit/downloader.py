import os
import requests
import time
from duckduckgo_search import DDGS
from google import genai
from dotenv import load_dotenv
from BingImageCreator import ImageGen

load_dotenv()

def analyze_script_for_images(script_text, image_count, is_short):
    api_key = os.getenv("GEMINI_API_KEY")
    ratio_instruction = "vertical (portrait, 9:16)" if is_short else "horizontal (landscape, 16:9)"
    
    if not api_key:
        print("[Downloader] WARNING: No Gemini API Key found. Using default queries.")
        return ["technology"] * image_count, ["cinematic digital art"] * image_count
    
    print("[Downloader] Asking Gemini to generate image prompts...")
    client = genai.Client(api_key=api_key)
    prompt = (f"Read this script. Generate exactly {image_count} distinct search queries for real photos (prefix WEB:) "
              f"and {image_count} distinct AI image prompts (prefix AI:). "
              f"CRITICAL: All images must be suitable for a {ratio_instruction} video. "
              f"Script: {script_text[:1500]}")
    
    web_queries, ai_prompts = [], []
    try:
        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        for line in response.text.split('\n'):
            line = line.strip()
            if line.startswith("WEB:"):
                web_queries.append(line.replace("WEB:", "").strip())
            elif line.startswith("AI:"):
                ai_prompts.append(line.replace("AI:", "").strip() + f", cinematic, {ratio_instruction}")
    except Exception as e:
        print(f"[Downloader] Gemini API Error: {e}")
    
    if not web_queries:
        web_queries = ["high tech background"] * image_count
    if not ai_prompts:
        ai_prompts = ["cinematic beautiful background"] * image_count
    
    return web_queries, ai_prompts

def prepare_assets(script_text, output_dir="assets/curated_pool", use_web=True, use_ai=True, custom_keywords="", image_count=10, is_short=False):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    for f in os.listdir(output_dir):
        path = os.path.join(output_dir, f)
        if os.path.isfile(path):
            os.remove(path)
            
    web_ratio_suffix = " vertical portrait photography" if is_short else " horizontal landscape photography"
    ai_ratio_suffix = ", vertical 9:16 aspect ratio" if is_short else ", horizontal 16:9 aspect ratio"
    orientation = "portrait" if is_short else "landscape"

    if custom_keywords:
        base_queries = [k.strip() for k in custom_keywords.split(",") if k.strip()]
        web_queries = base_queries
        ai_prompts = [q + ai_ratio_suffix for q in base_queries]
    else:
        web_queries, ai_prompts = analyze_script_for_images(script_text, image_count, is_short)

    count = 0
    
    if use_ai:
        print(f"[Downloader] Starting AI Image Generation (Bing)... Target: {image_count}")
        u, s = os.getenv("BING_COOKIE"), os.getenv("BING_SRCH_COOKIE")
        if u and s:
            try:
                ig = ImageGen(auth_cookie=u, auth_cookie_SRCHHPGUSR=s)
                for prompt in ai_prompts:
                    if count >= image_count:
                        break
                    try:
                        images = ig.get_images(prompt)
                        ig.save_images(images, output_dir)
                        for file in os.listdir(output_dir):
                            if not file.startswith("scene_"):
                                old_path = os.path.join(output_dir, file)
                                new_path = os.path.join(output_dir, f"scene_{count}.jpg")
                                os.rename(old_path, new_path)
                                count += 1
                                print(f"[Downloader] Generated AI Image {count}/{image_count}")
                    except Exception as e: 
                        print(f"  [!] Bing AI Failed on prompt '{prompt[:20]}...': {e}")
                        continue
            except Exception as e: 
                print(f"[!] Bing AI Setup Failed: {e}")
        else:
            print("[!] Skipping Bing AI: BING_COOKIE or BING_SRCH_COOKIE missing from .env")

    if count < image_count and (use_web or (use_ai and count == 0)):
        print(f"[Downloader] Starting Web Scraping. Need {image_count - count} more images...")
        pexels_key = os.getenv("PEXELS_API_KEY")
        needed = image_count - count
        per_query = max(1, (needed // len(web_queries)) + 1)
        
        for query in web_queries:
            if count >= image_count:
                break
            
            images_for_this_query = 0
            
            print(f"[Downloader] Searching DDG for: '{query}'...")
            try:
                time.sleep(2) 
                with DDGS() as ddgs:
                    results = list(ddgs.images(keywords=query + web_ratio_suffix, max_results=per_query + 3))
                    if results:
                        for res in results:
                            if count >= image_count or images_for_this_query >= per_query:
                                break
                            try:
                                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                                data = requests.get(res["image"], headers=headers, timeout=5).content
                                if len(data) > 15000: 
                                    with open(os.path.join(output_dir, f"scene_{count}.jpg"), "wb") as f:
                                        f.write(data)
                                    count += 1
                                    images_for_this_query += 1
                                    print(f"  -> Downloaded DDG Image {count}/{image_count}")
                            except Exception:
                                continue
            except Exception as e: 
                print(f"  [!] DDG Search failed: {e}")

            if count < image_count and images_for_this_query < per_query and pexels_key:
                clean_query = query.replace(" horizontal landscape photography", "").replace(" vertical portrait photography", "").strip()
                print(f"[Downloader] Searching Pexels fallback for: '{clean_query}'...")
                url = f"https://api.pexels.com/v1/search?query={clean_query}&per_page={per_query - images_for_this_query + 3}&orientation={orientation}"
                try:
                    res = requests.get(url, headers={"Authorization": pexels_key}, timeout=10).json()
                    for photo in res.get("photos", []):
                        if count >= image_count or images_for_this_query >= per_query:
                            break
                        img_url = photo["src"]["large2x"]
                        data = requests.get(img_url, timeout=10).content
                        if len(data) > 15000:
                            with open(os.path.join(output_dir, f"scene_{count}.jpg"), "wb") as f:
                                f.write(data)
                            count += 1
                            images_for_this_query += 1
                            print(f"  -> Downloaded Pexels Image {count}/{image_count}")
                except Exception as e:
                    print(f"  [!] Pexels Error: {e}")

    print(f"[Downloader] Finalizat. Am obtinut {count} imagini.")
    return count