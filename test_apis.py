import os
import requests
from dotenv import load_dotenv
from google import genai

load_dotenv()

def check_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: return "❌ GEMINI_API_KEY lipsește din .env"
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model="gemini-2.0-flash", contents="Hi")
        return "✅ Gemini: Funcțional!"
    except Exception as e:
        return f"❌ Gemini Error: {e}"

def check_bing():
    u = os.getenv("BING_COOKIE")
    s = os.getenv("BING_SRCH_COOKIE")
    if not u or not s: return "❌ BING_COOKIES lipsesc din .env"
    # Verificăm simplu dacă putem accesa Bing cu aceste cookie-uri
    try:
        res = requests.get("https://www.bing.com/images/create", cookies={"_U": u}, timeout=10)
        if res.status_code == 200:
            return "✅ Bing Cookies: Par a fi valide!"
        return f"❌ Bing: Status {res.status_code} (posibil expirate)"
    except Exception as e:
        return f"❌ Bing Error: {e}"

def check_pexels():
    api_key = os.getenv("PEXELS_API_KEY")
    if not api_key: return "⚠️ Pexels API: Lipsește (opțional)"
    try:
        res = requests.get("https://api.pexels.com/v1/search?query=test", headers={"Authorization": api_key})
        if res.status_code == 200:
            return "✅ Pexels: Funcțional!"
        return f"❌ Pexels: Status {res.status_code}"
    except Exception as e:
        return f"❌ Pexels Error: {e}"

if __name__ == "__main__":
    print("\n--- DIAGNOZĂ API-URI ---")
    print(check_gemini())
    print(check_bing())
    print(check_pexels())
    print("------------------------\n")