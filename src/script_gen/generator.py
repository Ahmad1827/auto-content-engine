import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

def get_script(topic, subtopics, minutes, method="Gemini"):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Error: GEMINI_API_KEY not found in .env file"
        
    client = genai.Client(api_key=api_key)
    
    prompt = f"""Write a detailed YouTube documentary script in English about {topic}. 
Focus on these strategic subtopics: {subtopics}. 
Target duration: {minutes} minutes.

The tone should be serious, authoritative, and cinematic.
Format the output strictly as spoken text paragraphs.
Do not include scene markers, image prompts, or visual directions.
Write only the exact words the narrator will speak."""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return response.text
    except Exception as e:
        return f"AI Error: {e}"