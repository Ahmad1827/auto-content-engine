import os
import re
import time
import requests
import json
import random
import xml.etree.ElementTree as ET
from dotenv import load_dotenv

load_dotenv()

def get_trending(duration_min=10):
    all_raw_topics = []
    
    rss_data = _fetch_trends_rss()
    all_raw_topics.extend([f"TRENDING: {t}" for t in rss_data])
    
    news_data = _fetch_news_api()
    all_raw_topics.extend([f"NEWS: {t}" for t in news_data])
    
    exploding_data = _fetch_exploding_topics()
    all_raw_topics.extend([f"EXPLODING: {t}" for t in exploding_data])
    
    if not all_raw_topics:
        return {"rss": [], "pytrends": []}
        
    random.shuffle(all_raw_topics)
    
    curated = _gemini_curate(all_raw_topics, mode="trending", top_n=6, duration_min=duration_min)
    topics = curated if curated else [t.split(": ", 1)[-1] for t in all_raw_topics[:6]]

    return {
        "rss": topics[:3],
        "pytrends": topics[3:6] if len(topics) > 3 else []
    }

def get_related(topic, duration_min=10):
    rss_raw = _fetch_trends_rss()
    rss_results = _gemini_pick_relevant(rss_raw, topic, top_n=3, duration_min=duration_min)

    pytrends_raw = _pytrends_related(topic)
    pytrends_results = _gemini_curate(
        pytrends_raw, mode="related", topic=topic,
        top_n=3, duration_min=duration_min
    ) if pytrends_raw else []

    if not rss_results:
        rss_results = _gemini_suggest_related(topic, 3, duration_min)
    if not pytrends_results:
        pytrends_results = _gemini_suggest_related(topic, 3, duration_min)

    return {
        "rss": rss_results[:3],
        "pytrends": pytrends_results[:3]
    }

def _fetch_trends_rss(geo="US"):
    url = f"https://trends.google.com/trending/rss?geo={geo}"
    try:
        resp = requests.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        if resp.status_code != 200: return []
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
        return topics
    except:
        return []

def _fetch_news_api():
    api_key = os.getenv("NEWS_API_KEY")
    if not api_key: return []
    url = f"https://newsapi.org/v2/top-headlines?language=en&pageSize=15&apiKey={api_key}"
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        if data.get("status") == "ok":
            return [art["title"] for art in data.get("articles", []) if art.get("title")]
        return []
    except:
        return []

def _fetch_exploding_topics():
    api_key = os.getenv("EXPLODING_TOPICS_KEY")
    if not api_key: return []
    url = f"https://api.explodingtopics.com/v1/topics?api_key={api_key}"
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        return [f"{t['name']} - {t.get('description', '')}" for t in data.get("topics", [])]
    except:
        return []

def _pytrends_related(topic):
    try:
        from pytrends.request import TrendReq
        pytrends = TrendReq(hl='en-US', tz=360, timeout=(10, 25))
        pytrends.build_payload([topic], timeframe='now 7-d')
        time.sleep(1)
        results = []
        related = pytrends.related_queries()
        if related and topic in related:
            for key in ['rising', 'top']:
                df = related[topic].get(key)
                if df is not None and not df.empty:
                    results.extend(df['query'].tolist())
        return list(set(results))[:20]
    except:
        return []

def _get_gemini_model():
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key: return None
        genai.configure(api_key=api_key)
        return genai.GenerativeModel('gemini-3-flash')
    except:
        return None

def _format_context(duration_min):
    if duration_min <= 3: return "short-form YouTube video (1-3 minutes)"
    elif duration_min <= 7: return f"medium-form YouTube narration video (~{duration_min} min)"
    else: return f"long-form YouTube narration video (~{duration_min} min, documentary style)"

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
    if not model or not raw: return None
    video_format = _format_context(duration_min)
    topics_str = "\n".join(f"- {t}" for t in raw[:30])
    if mode == "related":
        prompt = f"""From these queries related to "{topic}", pick {top_n} best for a {video_format}.
Rules: enough depth for {duration_min} min narration, broad appeal, avoid trivia.
Rephrase into compelling titles (3-7 words). ONLY titles, one per line, no numbering.
{topics_str}"""
    else:
        prompt = f"""From these trending/news/viral topics, pick {top_n} best for a {video_format}.
Rules: enough depth for {duration_min} min narration, broad appeal, avoid gossip/sports scores.
Rephrase into compelling titles (3-7 words). ONLY titles, one per line, no numbering.
{topics_str}"""
    try:
        response = model.generate_content(prompt)
        return _parse_list(response.text, top_n)
    except:
        return None

def _gemini_pick_relevant(rss_topics, topic, top_n=3, duration_min=10):
    model = _get_gemini_model()
    if not model or not rss_topics: return []
    video_format = _format_context(duration_min)
    topics_str = "\n".join(f"- {t}" for t in rss_topics[:20])
    prompt = f"""From these currently trending topics, pick {top_n} most related to "{topic}" for a {video_format}.
If none are related, pick the {top_n} most interesting and rephrase to connect to "{topic}".
Titles 3-7 words. ONLY titles, one per line, no numbering.
Trending now:
{topics_str}"""
    try:
        response = model.generate_content(prompt)
        return _parse_list(response.text, top_n)
    except:
        return []

def _gemini_suggest_related(topic, top_n=3, duration_min=10):
    model = _get_gemini_model()
    video_format = _format_context(duration_min)
    defaults = [f"{topic} untold story", f"dark side of {topic}", f"{topic} mysteries"][:top_n]
    if not model: return defaults
    prompt = f"""Suggest {top_n} subtopics about "{topic}" for a {video_format}.
Must sustain {duration_min} min narration. Dramatic angles.
Titles 3-7 words. ONLY titles, one per line, no numbering."""
    try:
        response = model.generate_content(prompt)
        results = _parse_list(response.text, top_n)
        return results if results else defaults
    except:
        return defaults