"""
test_voice.py — Test rapid Kokoro TTS
Ruleaza: python test_voice.py (din src/voice_gen/)
"""
from kokoro_narration import generate_voice
import os

text = """
Take a deep breath. Let the tension leave your body.
Feel the warmth of the light surrounding you.
You are safe. You are calm. You are exactly where you need to be.
"""

os.makedirs("test_output", exist_ok=True)
result = generate_voice(text, output_path="test_output/test_FULL.wav", preset="calm")

if result:
    print(f"\nDeschide {result} si asculta!")
else:
    print("\nEroare la generare!")
