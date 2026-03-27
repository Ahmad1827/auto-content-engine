import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

def get_script(topic, subtopics, minutes, method="Gemini"):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Error: GEMINI_API_KEY not found in .env file"
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    Write a detailed YouTube script in English about {topic}. 
    Focus on these subtopics: {subtopics}. 
    Target duration: {minutes} minutes.
    
    Format the output strictly as spoken text paragraphs.
    Do not include scene markers, image prompts, visual directions, or any other formatting.
    Write only the exact words that the narrator will speak.
    """

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"AI Error: {e}"