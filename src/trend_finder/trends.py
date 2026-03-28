"""
trends.py — Gaseste topicuri trending din DOUA surse:
  1. Google Trends RSS feed (FREE, no API key)
  2. pytrends related_queries (FREE, functional)
Ambele filtrate de Gemini pentru YouTube long-form.
"""
import os
import re
import time
import requests
import xml.etree.ElementTree as ET
from dotenv import load_dotenv

load_dotenv()


def get_trending(duration_min=10):
    """
    Trending global (empty topic).
    Returns: {"rss": [3 topics], "pytrends": [3 topics]}
    """
    raw = _fetch_trends_rss()
    curated = _gemini_curate(raw, mode="trending", top_n=6, duration_min=duration_min)
    topics = curated if curated else raw[:6]

    return {
        "rss": topics[:3],
        "pytrends": topics[3:6] if len(topics) > 3 else []
    }


def get_related(topic, duration_min=10):
    """
    Related to a topic — 3 din fiecare sursa.
    Returns: {"rss": [3 topics], "pytrends": [3 topics]}
    """
    # Sursa 1: RSS trending, filtrate pt relevanta la topic
    rss_raw = _fetch_trends_rss()
    rss_results = _gemini_pick_relevant(rss_raw, topic, top_n=3, duration_min=duration_min)

    # Sursa 2: pytrends related queries
    pytrends_raw = _pytrends_related(topic)
    pytrends_results = _gemini_curate(
        pytrends_raw, mode="related", topic=topic,
        top_n=3, duration_min=duration_min
    ) if pytrends_raw else []

    # Fallback: daca una din surse e goala, Gemini sugereaza
    if not rss_results:
        rss_results = _gemini_suggest_related(topic, 3, duration_min)
    if not pytrends_results:
        pytrends_results = _gemini_suggest_related(topic, 3, duration_min)

    return {
        "rss": rss_results[:3],
        "pytrends": pytrends_results[:3]
    }


# ── GOOGLE TRENDS RSS (FREE) ────────────────────────────────
def _fetch_trends_rss(geo="US"):
    url = f"https://trends.google.com/trending/rss?geo={geo}"
    try:
        resp = requests.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        if resp.status_code != 200:
            print(f"[RSS] HTTP {resp.status_code}")
            return []

        root = ET.fromstring(resp.content)
        items = root.findall('.//item/title')
        topics = []
        seen = set()
        for item in items:
            if item.text:
                t = item.text.strip()
                if t.lower() not in seen:
                    seen.add(t.lower())
                    topics.append(t)

        print(f"[RSS] {len(topics)} trending topics")
        return topics
    except Exception as e:
        print(f"[RSS] Error: {e}")
        return []


# ── PYTRENDS RELATED ─────────────────────────────────────────
def _pytrends_related(topic):
    try:
        from pytrends.request import TrendReq
        pytrends = TrendReq(hl='en-US', tz=360, timeout=(10, 25))
        pytrends.build_payload([topic], timeframe='now 7-d')
        time.sleep(1)

        results = []
        try:
            related = pytrends.related_queries()
            if related and topic in related:
                for key in ['rising', 'top']:
                    df = related[topic].get(key)
                    if df is not None and not df.empty:
                        results.extend(df['query'].tolist())
        except Exception:
            pass

        if len(results) < 3:
            try:
                time.sleep(1)
                topics_data = pytrends.related_topics()
                if topics_data and topic in topics_data:
                    rising = topics_data[topic].get('rising')
                    if rising is not None and not rising.empty:
                        results.extend(rising['topic_title'].tolist())
            except Exception:
                pass

        seen = set()
        clean = []
        for r in results:
            low = r.lower().strip()
            if low not in seen and low != topic.lower():
                seen.add(low)
                clean.append(r)

        print(f"[pytrends] Related to '{topic}': {len(clean)} results")
        return clean[:20]
    except Exception as e:
        print(f"[pytrends] Failed: {e}")
        return []


# ── GEMINI ───────────────────────────────────────────────────
def _get_gemini_model():
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return None
        genai.configure(api_key=api_key)
        return genai.GenerativeModel('gemini-2.5-flash')
    except Exception:
        return None


def _format_context(duration_min):
    if duration_min <= 3:
        return "short-form YouTube video (1-3 minutes)"
    elif duration_min <= 7:
        return f"medium-form YouTube narration video (~{duration_min} min)"
    else:
        return f"long-form YouTube narration video (~{duration_min} min, documentary style)"


def _parse_list(text, top_n):
    results = []
    for line in text.strip().split('\n'):
        line = re.sub(r'^\d+[\.\)\-]\s*', '', line.strip())
        line = line.strip('-').strip('•').strip('*').strip('"').strip("'").strip()
        if line and len(line) > 2:
            results.append(line)
    return results[:top_n]


def _gemini_curate(raw, mode="trending", topic="", top_n=3, duration_min=10):
    model = _get_gemini_model()
    if not model or not raw:
        return None

    video_format = _format_context(duration_min)
    topics_str = "\n".join(f"- {t}" for t in raw[:20])

    if mode == "related":
        prompt = f"""From these queries related to "{topic}", pick {top_n} best for a {video_format}.

Rules: enough depth for {duration_min} min narration, broad appeal, avoid trivia/stats.
Rephrase into compelling titles (3-7 words). ONLY titles, one per line, no numbering.

{topics_str}"""
    else:
        prompt = f"""From these trending topics, pick {top_n} best for a {video_format}.

Rules: enough depth for {duration_min} min narration, broad appeal, avoid gossip/sports scores.
Rephrase into compelling titles (3-7 words). ONLY titles, one per line, no numbering.

{topics_str}"""

    try:
        response = model.generate_content(prompt)
        results = _parse_list(response.text, top_n)
        print(f"[Gemini] Curated: {results}")
        return results if results else None
    except Exception as e:
        print(f"[Gemini] Curate failed: {e}")
        return None


def _gemini_pick_relevant(rss_topics, topic, top_n=3, duration_min=10):
    """Din trending RSS, alege cele relevante pt un topic specific."""
    model = _get_gemini_model()
    if not model or not rss_topics:
        return []

    video_format = _format_context(duration_min)
    topics_str = "\n".join(f"- {t}" for t in rss_topics[:20])

    prompt = f"""From these currently trending topics, pick {top_n} most related to "{topic}" that would make a great {video_format}.

If none are related to "{topic}", pick the {top_n} most interesting for a {video_format} about "{topic}" and rephrase them to connect.
Titles 3-7 words. ONLY titles, one per line, no numbering.

Trending now:
{topics_str}"""

    try:
        response = model.generate_content(prompt)
        results = _parse_list(response.text, top_n)
        print(f"[Gemini] RSS filtered for '{topic}': {results}")
        return results
    except Exception as e:
        print(f"[Gemini] Pick relevant failed: {e}")
        return []


def _gemini_suggest_related(topic, top_n=3, duration_min=10):
    model = _get_gemini_model()
    video_format = _format_context(duration_min)
    defaults = [f"{topic} untold story", f"dark side of {topic}", f"{topic} mysteries"][:top_n]
    if not model:
        return defaults

    prompt = f"""Suggest {top_n} subtopics about "{topic}" perfect for a {video_format}.
Must sustain {duration_min} min narration. Dramatic or surprising angles.
Titles 3-7 words. ONLY titles, one per line, no numbering."""

    try:
        response = model.generate_content(prompt)
        results = _parse_list(response.text, top_n)
        return results if results else defaults
    except Exception:
        return defaults
