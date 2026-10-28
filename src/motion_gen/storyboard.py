"""Topic -> storyboard: narration plus a visual for every scene, written by the active LLM."""
from llm.provider import generate

STYLES = {
    "atlas": "dark cartographic history: glowing country outlines on a dark map, flags, campaign arrows, "
             "huge condensed headlines with red accents. Best for history, wars, empires, geography.",
    "ink": "minimal warm line-art on near black: stick figures, rooms, objects drawn stroke by stroke, "
           "'with vs without' comparisons, orange highlights. Best for religion, habits, psychology, life lessons.",
    "parchment": "an old map on aged paper: sepia ink, oxblood red accents, classic serif type. "
                 "Best for ancient and medieval history, empires, kings, legends, the Bible and early Islam.",
    "neon": "synthwave glow on deep indigo: cyan lines, magenta accents, futuristic type. "
            "Best for mysteries, unsolved cases, space, technology, the Cold War, conspiracies.",
    "newspaper": "front page of an old newspaper: black ink on newsprint, halftone dots, red stamp, typewriter labels. "
                 "Best for 1850-1980 events: disasters, crimes, heists, scandals, assassinations, famous headlines.",
}

SYSTEM = """You are the writer and art director of a faceless TikTok channel that makes 45-60 second animated explainers.
Videos are rendered from your storyboard by a motion-graphics engine, so you describe visuals with the scene types below
instead of image prompts. Facts must be accurate: never invent numbers, dates or quotes; if a detail is disputed, say "around" or "reportedly".
Religious topics: respectful and sourced in mainstream scholarship, no mockery."""

PROMPT = """Topic: {topic}
{style_block}

Write a storyboard of {min_scenes}-{max_scenes} scenes, about {min_words}-{max_words} spoken words total (the video must stay under {seconds} seconds).
- Scene 1 is the HOOK: a short punchy narration line plus a big `headline` that makes people stop scrolling
  (a contrast, a number, a question). Example headline lines: "*44* TURKS" (xl) / "VS" (m) / "~1,000 FRENCH" (xl), banner "GUESS WHO SURRENDERED?".
- Each scene's narration is 1-2 short spoken sentences (6-25 words). Plain text for a voice actor: no emojis, no stage directions,
  write numbers and years the way they should be read aloud.
- End with a payoff line or a question that invites comments.
- Use `headline` on at most 3 scenes (hook, the big twist, maybe the ending). Wrap words in *asterisks* to color them in the accent color.
  Keep headline lines under 16 characters each, max 3 lines.
- `kicker` is a tiny uppercase tag at the top like "TURKEY · MAY 1920" or "5:36 AM". Use it on most scenes; keep it under 26 characters.

Scene visual types (field `visual.type`):
- "map": `focus` = ISO alpha-3 codes of the countries to frame and outline (modern borders), `highlight` = codes to tint as the enemy/other side,
  `markers` = [{{lon, lat, label, flag}}] where flag is an ISO alpha-3 code (optional), `arrows` = [{{from_lon, from_lat, to_lon, to_lat, label}}] for troop movements or routes.
  Use real coordinates. Keep labels short (1-2 words).
  `zoom`: "country" (default) or "region" to zoom in tight on the markers/arrows when the action is local (a city, a pass, a battlefield).
  Vary zoom between scenes like a camera: country for context, region for the action.
- "counter": a big number counting up. `value` (number), optional `prefix`/`suffix` ("~", "%", "K"), `label` underneath.
- "title": big text card. `text` (use *asterisks* for accent words), optional `sub`.
- "illustration": one line-art drawing in `svg`, optional `label` tag.
- "compare": two stacked drawings: `top` and `bottom`, each {{svg, tag, label}} — e.g. tag "WITH TAHAJJUD" / "WITHOUT", label "LIVELY · GOOD-HEARTED".
- "timeline": 3-5 `events` [{{date, label}}] shown on a vertical line; `active` = index of the event this scene is about.
  Dates short ("MAY 29", "1453", "DAY 3"), labels under 30 characters. Good for sieges, reigns, countdowns, "how it unfolded".
- "quote": `text` = a real quote (max 30 words) and `source` = who said or wrote it. Only quotes you are confident are authentic;
  add "attributed" to the source if authorship is uncertain. Good for scripture, famous last words, speeches.
- "versus": a stats battle. `left` and `right` = {{name, flag}} (flag = ISO alpha-3, optional), `rows` = 2-4 [{{label, left, right}}]
  with short values like "~80,000", "69", "3 DAYS". Numeric values get proportional bars. Good for army sizes, empires, rivals.

SVG rules for "illustration" and "compare":
- Full <svg> element. viewBox="0 0 1000 1000" for illustration, viewBox="0 0 1000 520" for compare panels.
- Line art only: path/line/polyline/circle/ellipse/rect/polygon. Do NOT set fill, stroke, colors or styles; the engine styles everything.
  Optional classes: class="accent" (glowing accent stroke for the key detail), class="solid" (filled shape), class="warm" (glowing sunrise fill for windows, lamps, the sun).
- Minimal and readable on a phone: stick figures (head circle r 35-45, line body, bent limbs show emotion), a few furniture/scene objects, a floor line.
  15-45 elements. Elements are drawn in document order, so put the floor and room first and the person and accent details last.
- No <text>, <style>, <script>, gradients, images or transforms beyond simple ones.

Mix visual types so the video keeps moving and never use the same type more than twice in a row. {lean}
Also return `title` (short, for the file name) and `caption` (TikTok description, 1 line + 3-5 hashtags)."""

LEAN = {
    "atlas": "Lean on maps (change focus, markers and arrows as the story moves), with a versus, timeline or counter for the big facts.",
    "ink": "Lean on illustrations and compare panels, with a quote, counter or title card where a key phrase or number lands.",
    "parchment": "Lean on maps and timelines, with a quote or versus where it fits; illustrations work as old engravings.",
    "neon": "Lean on counters, timelines, versus and illustrations; maps for where it happened.",
    "newspaper": "Lean on timelines, quotes (real headlines or statements), counters and maps; illustrations as front-page sketches.",
}

_PANEL = {
    "type": "object",
    "properties": {"svg": {"type": "string"}, "tag": {"type": "string"}, "label": {"type": "string"}},
    "required": ["svg"],
}

_SIDE = {
    "type": "object",
    "properties": {"name": {"type": "string"}, "flag": {"type": "string"}},
    "required": ["name"],
}

SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "caption": {"type": "string"},
        "style": {"type": "string", "enum": list(STYLES)},
        "scenes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "narration": {"type": "string"},
                    "kicker": {"type": "string"},
                    "headline": {
                        "type": "object",
                        "properties": {
                            "lines": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "text": {"type": "string"},
                                        "accent": {"type": "boolean"},
                                        "size": {"type": "string", "enum": ["xl", "l", "m"]},
                                    },
                                    "required": ["text"],
                                },
                            },
                            "banner": {"type": "string"},
                        },
                        "required": ["lines"],
                    },
                    "visual": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string", "enum": ["map", "counter", "title", "illustration", "compare",
                                                                "timeline", "quote", "versus"]},
                            "focus": {"type": "array", "items": {"type": "string"}},
                            "zoom": {"type": "string", "enum": ["country", "region"]},
                            "highlight": {"type": "array", "items": {"type": "string"}},
                            "markers": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "lon": {"type": "number"}, "lat": {"type": "number"},
                                        "label": {"type": "string"}, "flag": {"type": "string"},
                                    },
                                    "required": ["lon", "lat"],
                                },
                            },
                            "arrows": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "from_lon": {"type": "number"}, "from_lat": {"type": "number"},
                                        "to_lon": {"type": "number"}, "to_lat": {"type": "number"},
                                        "label": {"type": "string"},
                                    },
                                    "required": ["from_lon", "from_lat", "to_lon", "to_lat"],
                                },
                            },
                            "value": {"type": "number"},
                            "prefix": {"type": "string"},
                            "suffix": {"type": "string"},
                            "label": {"type": "string"},
                            "text": {"type": "string"},
                            "sub": {"type": "string"},
                            "svg": {"type": "string"},
                            "top": _PANEL,
                            "bottom": _PANEL,
                            "events": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {"date": {"type": "string"}, "label": {"type": "string"}},
                                    "required": ["date", "label"],
                                },
                            },
                            "active": {"type": "integer"},
                            "source": {"type": "string"},
                            "left": _SIDE,
                            "right": _SIDE,
                            "rows": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {"label": {"type": "string"}, "left": {"type": "string"}, "right": {"type": "string"}},
                                    "required": ["label", "left", "right"],
                                },
                            },
                        },
                        "required": ["type"],
                    },
                },
                "required": ["narration", "visual"],
            },
        },
    },
    "required": ["title", "caption", "scenes"],
}


def _visual(v):
    kind = v.get("type")
    if kind == "map":
        return {
            "type": "map",
            "focus": v.get("focus") or [],
            "highlight": v.get("highlight") or [],
            "zoom": v.get("zoom") or "country",
            "markers": [{k: m[k] for k in ("lon", "lat", "label", "flag") if m.get(k) not in (None, "")}
                        for m in v.get("markers") or []],
            "arrows": [{"from": [a["from_lon"], a["from_lat"]], "to": [a["to_lon"], a["to_lat"]], "label": a.get("label") or ""}
                       for a in v.get("arrows") or []],
        }
    if kind == "counter" and v.get("value") is not None:
        return {"type": "counter", "value": v["value"], "prefix": v.get("prefix", ""), "suffix": v.get("suffix", ""),
                "label": v.get("label", "")}
    if kind == "illustration" and v.get("svg"):
        return {"type": "illustration", "svg": v["svg"], "label": v.get("label", "")}
    if kind == "compare" and v.get("top") and v.get("bottom"):
        return {"type": "compare", "top": v["top"], "bottom": v["bottom"]}
    if kind == "timeline" and v.get("events"):
        events = v["events"][:5]
        active = v.get("active")
        return {"type": "timeline", "events": events,
                "active": active if isinstance(active, int) and 0 <= active < len(events) else len(events) - 1}
    if kind == "quote" and v.get("text"):
        return {"type": "quote", "text": v["text"], "source": v.get("source", "")}
    if kind == "versus" and v.get("left") and v.get("right") and v.get("rows"):
        return {"type": "versus", "left": v["left"], "right": v["right"], "rows": v["rows"][:4]}
    # Anything incomplete degrades to a text card instead of breaking the render.
    return {"type": "title", "text": v.get("text") or v.get("label") or "", "sub": v.get("sub", "")}


def _style_block(style):
    if style in STYLES:
        return f"Visual style: {style} - {STYLES[style]}", LEAN[style]
    options = "\n".join(f"- {name}: {desc}" for name, desc in STYLES.items())
    leans = " ".join(f"If {name}: {lean}" for name, lean in LEAN.items())
    return f"Choose the visual style that fits this topic best and return its name in `style`:\n{options}", leans


def make_storyboard(topic, style="auto", seconds=55, words_per_second=2.2):
    """style is a key of STYLES, or "auto" to let the AI pick one that fits the topic."""
    style_block, lean = _style_block(style)
    words = int(seconds * words_per_second)
    prompt = PROMPT.format(topic=topic, style_block=style_block, lean=lean, seconds=seconds,
                           min_words=words - 15, max_words=words,
                           min_scenes=max(4, seconds // 6), max_scenes=int(max(6, seconds // 4.5)))
    raw = generate(prompt, schema=SCHEMA, system=SYSTEM)

    scenes = []
    for s in raw.get("scenes", []):
        if not s.get("narration", "").strip():
            continue
        scene = {"narration": s["narration"].strip(), "kicker": s.get("kicker", ""), "visual": _visual(s.get("visual", {}))}
        if s.get("headline", {}).get("lines"):
            scene["headline"] = {"lines": s["headline"]["lines"], "banner": s["headline"].get("banner", "")}
        scenes.append(scene)

    if not scenes:
        raise RuntimeError("The AI returned an empty storyboard.")
    chosen = style if style in STYLES else raw.get("style") if raw.get("style") in STYLES else "atlas"
    return {"style": chosen, "title": raw.get("title") or topic, "caption": raw.get("caption", ""), "scenes": scenes}
