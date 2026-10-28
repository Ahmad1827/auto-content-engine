from llm.provider import generate


def get_script(topic, subtopics, minutes, method="auto"):
    """Narration-only documentary script from whichever AI is available (Claude Code first)."""
    prompt = f"""Write a detailed YouTube documentary script in English about {topic}.
Focus on these strategic subtopics: {subtopics}.
Target duration: {minutes} minutes.

The tone should be serious, authoritative, and cinematic.
Format the output strictly as spoken text paragraphs.
Do not include scene markers, image prompts, or visual directions.
Write only the exact words the narrator will speak."""

    try:
        return generate(prompt)
    except Exception as e:
        return f"AI Error: {e}"
