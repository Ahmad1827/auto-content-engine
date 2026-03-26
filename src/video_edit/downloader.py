import os
import requests
import re
from dotenv import load_dotenv

load_dotenv()

def extract_keywords_from_script(script_text):
    keywords = []
    for line in script_text.split('\n'):
        if "IMAGE_PROMPT:" in line:
            keyword = line.replace("IMAGE_PROMPT:", "").strip()

            keyword = re.sub(r'[\(\)]', '', keyword)
            if keyword:
                keywords.append(keyword)
    
    if not keywords:
        keywords = ["history", "mystery", "documentary", "ancient"]
        
    return keywords

def download_images_from_pexels(script_text):
    api_key = os.getenv("PEXELS_API_KEY")
    if not api_key:
        raise ValueError("PEXELS_API_KEY is missing from .env file!")
        
    output_dir = "assets/images"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    keywords = extract_keywords_from_script(script_text)
    headers = {"Authorization": api_key}
    downloaded_files = []

    print(f"\n--- Starting Pexels Download for {len(keywords)} scenes ---")

    for i, query in enumerate(keywords):
        short_query = " ".join(query.split()[:4])
        print(f"Searching Pexels for: '{short_query}'")
        
        url = f"https://api.pexels.com/v1/search?query={short_query}&per_page=1&orientation=landscape"
        
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data.get('photos'):
                img_url = data['photos'][0]['src']['large2x']
                img_data = requests.get(img_url).content
                
                file_path = os.path.join(output_dir, f"scene_{i+1}.jpg")
                with open(file_path, "wb") as f:
                    f.write(img_data)
                downloaded_files.append(file_path)
                print(f" -> Saved: {file_path}")
            else:
                print(f" -> No images found for: '{short_query}'")
        else:
            print(f" -> Pexels API Error: {response.status_code}")
            
    print("--- Download Complete ---\n")
    return downloaded_files
