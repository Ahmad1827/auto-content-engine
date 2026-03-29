import os
import requests
import urllib.parse
from duckduckgo_search import DDGS
from google import genai
from dotenv import load_dotenv

load_dotenv()

def analyze_script_for_images(script_text):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return ["military map"], ["dark cinematic war room 16:9"]
        
    client = genai.Client(api_key=api_key)
    prompt = f"""Read this script.
    Generate 8 web search queries for real-world photos. Prefix each with WEB:
    Generate 4 detailed AI image prompts for cinematic scenes. Prefix each with AI:
    Script: {script_text[:1500]}"""
    
    web_queries = []
    ai_prompts = []
    
    try:
        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        for line in response.text.split('\n'):
            line = line.strip()
            if line.startswith("WEB:"):
                web_queries.append(line.replace("WEB:", "").strip())
            elif line.startswith("AI:"):
                ai_prompts.append(line.replace("AI:", "").strip())
    except Exception:
        pass
        
    if not web_queries:
        web_queries = ["military conflict", "fighter jet", "geopolitics map", "government building"]
    if not ai_prompts:
        ai_prompts = ["cinematic war room, dark lighting, glowing map, 8k resolution, highly detailed"]
        
    return web_queries, ai_prompts

def prepare_assets(script_text, output_dir="../assets/curated_pool", use_web=True, use_ai=True):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    for file in os.listdir(output_dir):
        file_path = os.path.join(output_dir, file)
        if os.path.isfile(file_path):
            os.remove(file_path)
            
    web_queries, ai_prompts = analyze_script_for_images(script_text)
    count = 0
    
    if use_web:
        ddgs = DDGS()
        for query in web_queries:
            try:
                results = ddgs.images(keywords=query, max_results=1)
                for res in results:
                    img_url = res.get("image")
                    if img_url:
                        img_data = requests.get(img_url, timeout=5).content
                        with open(os.path.join(output_dir, f"scene_{count}.jpg"), "wb") as f:
                            f.write(img_data)
                        count += 1
            except Exception:
                continue
                
    if use_ai:
        for prompt in ai_prompts:
            try:
                encoded_prompt = urllib.parse.quote(prompt)
                url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1920&height=1080&nologo=true"
                img_data = requests.get(url, timeout=15).content
                with open(os.path.join(output_dir, f"scene_{count}.jpg"), "wb") as f:
                    f.write(img_data)
                count += 1
            except Exception:
                continue
                
    return count