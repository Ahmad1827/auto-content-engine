import os
import glob
import subprocess
from PIL import Image, ImageDraw, ImageFont
from google import genai
from dotenv import load_dotenv
from voice_gen.edge_narration import LANGUAGES

load_dotenv()

LATIN_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def _load_font(language, size):
    """DejaVu covers Latin, Cyrillic and Arabic; other alphabets take whatever system font fontconfig has for them."""
    path = LATIN_FONT
    if language in ("hi", "ja", "ko", "zh"):
        path = subprocess.run(["fc-match", "-f", "%{file}", f":lang={language}:bold"], capture_output=True, text=True).stdout or LATIN_FONT
    try:
        return ImageFont.truetype(path, size)
    except IOError:
        return ImageFont.load_default()

def create_thumbnail(topic_hint, output_path="thumbnail.jpg", language="en"):
    print("[Thumbnail] Generating clickbait title...")
    api_key = os.getenv("GEMINI_API_KEY")
    
    
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"Write a 3 or 4 word viral, clickbait YouTube thumbnail title in {LANGUAGES[language]['name']} for a video about '{topic_hint}'. Only output the title in ALL CAPS. No quotes, no punctuation."
        response = client.models.generate_content(model="gemini-3-flash", contents=prompt)
        title_text = response.text.strip().upper()
    except Exception as e:
        print(f"[Thumbnail] Gemini error: {e}")
        title_text = "SHOCKING TRUTH" if language == "en" else topic_hint.upper()

    
    pool_dir = "assets/curated_pool"
    bg_images = glob.glob(f"{pool_dir}/*.jpg") + glob.glob(f"{pool_dir}/*.png")
    
    if bg_images:
        img = Image.open(bg_images[0]).convert("RGBA")
    else:
        
        img = Image.new("RGBA", (1920, 1080), (30, 30, 30, 255))

    
    target_size = (1920, 1080)
    img_ratio = img.width / img.height
    target_ratio = target_size[0] / target_size[1]

    if img_ratio > target_ratio:
        new_w = int(img.height * target_ratio)
        left = (img.width - new_w) / 2
        img = img.crop((left, 0, left + new_w, img.height))
    else:
        new_h = int(img.width / target_ratio)
        top = (img.height - new_h) / 2
        img = img.crop((0, top, img.width, top + new_h))
        
    img = img.resize(target_size, Image.Resampling.LANCZOS)

    
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 100))
    img = Image.alpha_composite(img, overlay)

    
    draw = ImageDraw.Draw(img)
    size = 160
    font = _load_font(language, size)
    # Other languages can run longer than the 3-4 English words this was sized for.
    while size > 40 and draw.textlength(title_text, font=font) > 1800:
        size -= 10
        font = _load_font(language, size)

    
    bbox = draw.textbbox((0, 0), title_text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    text_x = (1920 - text_w) / 2
    text_y = (1080 - text_h) / 2

    
    draw.text((text_x, text_y), title_text, font=font, fill="#FFFF00", stroke_width=10, stroke_fill="black")

    
    img.convert("RGB").save(output_path, quality=95)
    print(f"[Thumbnail] Saved successfully to {output_path}")
    return output_path