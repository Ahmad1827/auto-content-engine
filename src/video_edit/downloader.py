import os
import requests
from duckduckgo_search import DDGS
from google import genai
from dotenv import load_dotenv
from BingImageCreator import ImageGen

load_dotenv()

def analyze_script_for_images(script_text):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return ["technology"], ["cinematic digital art 16:9"]
    client = genai.Client(api_key=api_key)
    prompt = f"Read this script. Generate 8 search queries for real photos (prefix WEB:) and 8 AI image prompts (prefix AI:). Script: {script_text[:1500]}"
    web_queries, ai_prompts = [], []
    try:
        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        for line in response.text.split('\n'):
            line = line.strip()
            if line.startswith("WEB:"):
                web_queries.append(line.replace("WEB:", "").strip())
            elif line.startswith("AI:"):
                ai_prompts.append(line.replace("AI:", "").strip() + ", 16:9")
    except:
        pass
    return web_queries or ["tech"], ai_prompts or ["cinematic 16:9"]

def download_pexels(query, count, output_dir):
    api_key = os.getenv("PEXELS_API_KEY")
    if not api_key: return False
    url = f"https://api.pexels.com/v1/search?query={query}&per_page=1"
    try:
        res = requests.get(url, headers={"Authorization": api_key}, timeout=10).json()
        if res.get("photos"):
            img_url = res["photos"][0]["src"]["large2x"]
            data = requests.get(img_url, timeout=10).content
            if len(data) > 10000:
                with open(os.path.join(output_dir, f"scene_{count}.jpg"), "wb") as f:
                    f.write(data)
                return True
    except: pass
    return False

def prepare_assets(script_text, output_dir="assets/curated_pool", use_web=True, use_ai=True, custom_keywords=""):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    for f in os.listdir(output_dir):
        path = os.path.join(output_dir, f)
        if os.path.isfile(path):
            os.remove(path)
    web_queries, ai_prompts = analyze_script_for_images(script_text)
    if custom_keywords:
        web_queries = ai_prompts = [k.strip() for k in custom_keywords.split(",") if k.strip()]
    count = 0
    if use_ai:
        u, s = os.getenv("BING_COOKIE"), os.getenv("BING_SRCH_COOKIE")
        if u and s:
            try:
                ig = ImageGen(auth_cookie=u, auth_cookie_SRCHHPGUSR=s)
                for prompt in ai_prompts:
                    try:
                        images = ig.get_images(prompt)
                        ig.save_images(images, output_dir)
                        count = len(os.listdir(output_dir))
                    except: continue
            except: pass
    if count == 0 and (use_ai or use_web):
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        for query in web_queries:
            if download_pexels(query, count, output_dir):
                print(f"[Fallback] Pexels provided image for: {query}")
                count += 1
            else:
                try:
                    with DDGS() as ddgs:
                        results = list(ddgs.images(keywords=query, max_results=1))
                        if results:
                            data = requests.get(results[0]["image"], headers=headers, timeout=10).content
                            if len(data) > 10000:
                                with open(os.path.join(output_dir, f"scene_{count}.jpg"), "wb") as f:
                                    f.write(data)
                                count += 1
                except: continue
    return count