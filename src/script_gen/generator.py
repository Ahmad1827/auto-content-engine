import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

def get_script(topic, subtopics, minutes, method="Gemini"):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "Error: GEMINI_API_KEY not found in .env file"
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    prompt = f"""
    Write a detailed YouTube script in English about {topic}. 
    Focus on these subtopics: {subtopics}. 
    Target duration: {minutes} minutes.
    
    Format the output as follows:
    [SCENE 1]
    IMAGE_PROMPT: (Description of a high-quality historical image or atmosphere for this part)
    TEXT: (The spoken narration)
    
    [SCENE 2]
    ...
    """

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"AI Error: {e}"