"""
downloader.py — Genereaza imagini pentru video.
Surse (in ordinea preferintei):
  1. Gemini Flash Image (FREE — 500 img/zi, aceeasi cheie API)
  2. Imagen 3 (platit — $0.04/img, din credite Google)
  3. Pexels (FREE — stock photos, fallback)

Prompturi cinematice detaliate generate de Gemini per scena.
"""
import os
import re
import base64
import requests
from io import BytesIO
from dotenv import load_dotenv

load_dotenv()

MAX_IMAGES = 20

# ── PROMPT ENGINEERING ───────────────────────────────────────
def generate_scene_prompts(script_text, num_scenes, source="gemini_image"):
    """Genereaza prompturi vizuale cinematice per scena."""
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')

    if source == "pexels":
        style = "Each prompt: 3-6 word stock photo search query. Example: 'crimson roses golden hour field'"
    else:
        style = """Each prompt: detailed image generation prompt (40-60 words).
        Include: specific subject, composition, lighting, mood, color palette, camera angle.
        Style: cinematic, photorealistic, 16:9 landscape.
        Example: "A vast field of crimson roses at golden hour, soft warm light casting long shadows, 
        shallow depth of field with bokeh, cinematic color grading, low angle shot, peaceful atmosphere"
        """

    prompt = f"""
    You are a cinematic visual director. Given this narration, create exactly {num_scenes} 
    visual scene descriptions matching the content in order.

    RULES:
    - Each scene illustrates what is being SAID in that segment
    - Vary: wide shots, close-ups, aerial views, macro details
    - NO text, NO faces, NO watermarks, NO logos
    - Maintain visual continuity and consistent mood
    
    {style}

    Return ONLY the prompts, one per line, no numbering, no quotes, no extra text.

    NARRATION:
    {script_text[:4000]}
    """

    try:
        response = model.generate_content(prompt)
        prompts = [line.strip() for line in response.text.strip().split('\n') if line.strip()]
        cleaned = []
        for p in prompts:
            p = re.sub(r'^\d+[\.\)\-]\s*', '', p).strip().strip('"').strip("'")
            if p:
                cleaned.append(p)
        while len(cleaned) < num_scenes:
            cleaned.append("cinematic landscape, golden hour, peaceful atmosphere, wide shot")
        print(f"[Prompts] {len(cleaned[:num_scenes])} scene prompts generated")
        return cleaned[:num_scenes]
    except Exception as e:
        print(f"[Prompts] Error: {e}")
        return None

def fallback_prompts(num_scenes):
    """Generic prompts daca Gemini nu merge."""
    defaults = [
        "cinematic mountain landscape at sunrise, volumetric light rays",
        "aerial view of vast ocean with dramatic clouds",
        "close-up of dewdrops on green leaves, macro photography",
        "ancient stone architecture with warm golden light",
        "starry night sky with milky way over a calm lake",
        "misty forest path with sunbeams through trees",
        "dramatic desert sand dunes with long shadows",
        "peaceful countryside with rolling green hills",
        "underwater coral reef with colorful tropical fish",
        "snow-capped mountains reflected in crystal clear lake",
        "autumn forest canopy with golden and red leaves",
        "volcanic landscape with dramatic sky at twilight",
        "tropical waterfall in lush green jungle",
        "northern lights aurora borealis over frozen tundra",
        "cherry blossom trees along a quiet river",
        "dramatic cliff coastline with crashing waves",
        "hot air balloons over cappadocia landscape",
        "zen garden with raked sand and smooth stones",
        "lightning storm over an open prairie",
        "bamboo forest path with soft diffused light",
    ]
    return (defaults * 2)[:num_scenes]


# ── GEMINI FLASH IMAGE (FREE — 500/zi) ──────────────────────
def generate_with_gemini_image(prompts, output_dir="assets/curated_pool"):
    """
    Genereaza imagini cu Gemini 2.5 Flash Image (Nano Banana).
    FREE: 500 imagini/zi, aceeasi cheie GEMINI_API_KEY.
    """
    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[Gemini Image] EROARE: GEMINI_API_KEY lipsa!")
        return []

    client = genai.Client(api_key=api_key)
    os.makedirs(output_dir, exist_ok=True)
    _clean_old_scenes(output_dir)

    downloaded = []
    print(f"\n[Gemini Image] Generez {len(prompts)} imagini (FREE tier)...")

    for i, prompt in enumerate(prompts):
        print(f"  [{i+1}/{len(prompts)}] \"{prompt[:70]}...\"")
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash-image',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=['IMAGE'],
                    image_config=types.ImageConfig(
                        aspect_ratio='16:9'
                    )
                )
            )

            # Extrage imaginea din response
            image_bytes = None
            if response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        image_bytes = part.inline_data.data
                        break

            if image_bytes:
                file_path = os.path.join(output_dir, f"scene_{i+1:03d}.png")
                with open(file_path, "wb") as f:
                    f.write(image_bytes)
                downloaded.append(file_path)
                print(f"           -> Salvat: {file_path}")
            else:
                print(f"           -> Nu a returnat imagine, skip")
        except Exception as e:
            error_msg = str(e)
            print(f"           -> Eroare: {error_msg[:100]}")
            if "429" in error_msg or "quota" in error_msg.lower():
                print("[Gemini Image] Rate limit! Opresc generarea.")
                break

    print(f"[Gemini Image] Generat {len(downloaded)}/{len(prompts)} imagini")
    return downloaded


# ── IMAGEN 3 (PLATIT) ───────────────────────────────────────
def generate_with_imagen(prompts, output_dir="assets/curated_pool"):
    """Genereaza imagini cu Imagen 3 (costa credite)."""
    from google import genai
    from google.genai import types

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return []

    client = genai.Client(api_key=api_key)
    os.makedirs(output_dir, exist_ok=True)
    _clean_old_scenes(output_dir)

    downloaded = []
    print(f"\n[Imagen] Generez {len(prompts)} imagini (PLATIT)...")

    for i, prompt in enumerate(prompts):
        print(f"  [{i+1}/{len(prompts)}] \"{prompt[:70]}...\"")
        try:
            response = client.models.generate_images(
                model='imagen-3.0-generate-002',
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio='16:9',
                    output_mime_type='image/jpeg',
                )
            )
            if response.generated_images:
                file_path = os.path.join(output_dir, f"scene_{i+1:03d}.jpg")
                response.generated_images[0].image.save(file_path)
                downloaded.append(file_path)
                print(f"           -> Salvat: {file_path}")
        except Exception as e:
            print(f"           -> Eroare: {str(e)[:100]}")

    print(f"[Imagen] Generat {len(downloaded)}/{len(prompts)} imagini")
    return downloaded


# ── PEXELS (FREE STOCK) ─────────────────────────────────────
def download_from_pexels(prompts, output_dir="assets/curated_pool"):
    """Descarca stock photos de pe Pexels."""
    api_key = os.getenv("PEXELS_API_KEY")
    if not api_key:
        print("[Pexels] PEXELS_API_KEY lipsa!")
        return []

    os.makedirs(output_dir, exist_ok=True)
    _clean_old_scenes(output_dir)
    headers = {"Authorization": api_key}
    downloaded = []

    print(f"\n[Pexels] Descarc {len(prompts)} imagini...")
    for i, query in enumerate(prompts):
        short_query = " ".join(query.split()[:5])
        try:
            resp = requests.get(
                f"https://api.pexels.com/v1/search?query={short_query}&per_page=1&orientation=landscape",
                headers=headers, timeout=10
            )
            if resp.status_code == 200 and resp.json().get('photos'):
                img_url = resp.json()['photos'][0]['src']['large2x']
                img_data = requests.get(img_url, timeout=15).content
                file_path = os.path.join(output_dir, f"scene_{i+1:03d}.jpg")
                with open(file_path, "wb") as f:
                    f.write(img_data)
                downloaded.append(file_path)
        except Exception as e:
            print(f"  [{i+1}] Eroare: {e}")

    print(f"[Pexels] Descarcat {len(downloaded)}/{len(prompts)} imagini")
    return downloaded


def _clean_old_scenes(output_dir):
    if os.path.exists(output_dir):
        for f in os.listdir(output_dir):
            if f.startswith('scene_') and f.endswith(('.jpg', '.png', '.jpeg')):
                os.remove(os.path.join(output_dir, f))


# ── FUNCTIA PRINCIPALA ───────────────────────────────────────
def download_scene_images(script_text, audio_duration, scene_interval=8,
                          image_source="gemini_image"):
    """
    Args:
        image_source: "gemini_image" (FREE), "imagen" (platit), "pexels" (stock)
    """
    num_images = int(audio_duration / scene_interval) + 1
    num_images = max(num_images, 2)
    num_images = min(num_images, MAX_IMAGES)

    print(f"[Downloader] {audio_duration:.0f}s / {scene_interval}s = {num_images} imagini | Sursa: {image_source}")

    # Genereaza prompturi
    prompt_type = "pexels" if image_source == "pexels" else "gemini_image"
    prompts = generate_scene_prompts(script_text, num_images, source=prompt_type)
    if not prompts:
        prompts = fallback_prompts(num_images)

    # Genereaza/descarca
    if image_source == "gemini_image":
        result = generate_with_gemini_image(prompts)
    elif image_source == "imagen":
        result = generate_with_imagen(prompts)
    else:
        result = download_from_pexels(prompts)

    # Fallback pe Pexels daca n-am destule
    if len(result) < num_images and image_source != "pexels":
        missing = num_images - len(result)
        print(f"[Downloader] Lipsesc {missing} imagini, completez cu Pexels...")
        pexels_prompts = fallback_prompts(missing)
        pexels_short = [" ".join(p.split()[:4]) for p in pexels_prompts]
        extra = download_from_pexels(pexels_short)
        result.extend(extra)

    return result
