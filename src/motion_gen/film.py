"""Topic -> a video built just for that topic, in any style: Claude Code writes the story, then writes and checks its own animation code."""
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import uuid

from llm.provider import LLMError, _claude_env, active_provider, detect_claude_code, generate
from motion_gen.narration import voice_language, voice_scenes, words_per_second
from motion_gen.render import MOTION_DIR, ROOT, RUNNING, _npm_bin, _stream, ensure_installed, kill_group, own_group
from voice_gen.edge_narration import LANGUAGES

FILMS_DIR = os.path.join(MOTION_DIR, "films")
LIBRARY_DIR = os.path.join(MOTION_DIR, "library")
PUBLIC_DIR = os.path.join(MOTION_DIR, "public", "films")
KIT_DIR = os.path.join(MOTION_DIR, "src", "film")
BUILD_TIMEOUT = int(os.getenv("ACE_FILM_TIMEOUT", "5400"))
MAX_FIXES = 2
# Films are meant to be followed: the voice is never rushed, leaves the picture room to breathe, and pauses between plot turns.
MAX_SPEED = 1.0
WORD_ROOM = 0.72
BEAT_PAUSE = 0.9
VOICE_PEAK = 0.89

FORMATS = {
    "relatable": "A relatable everyday situation told to 'you': one familiar place, one or two plain characters, one small problem that gets steadily, believably worse. Almost nothing but changing poses and expressions, in a warm, cosy, low-poly set.",
    "escalation": "An escalating comedy of engineering: every fix to a small everyday annoyance creates a bigger problem and a more absurd machine, until the ending circles back to the start. Each fix gets its moment: we see it built, see it work, then see what it breaks. One place that visibly grows.",
    "pov": "A first-person or over-the-shoulder 'you are there' true story that unfolds in near real time, with a running clock and dialogue-style lines. Ends on a cliffhanger or a gut punch.",
    "documentary": "A narrated 3D documentary: cold open on the most gripping image, flash back to explain, huge cutaway views of the place, on-screen gauges and labels, ending on a reveal or cliffhanger.",
    "process": "How something is made or how something works, in one world that visibly changes: it starts empty and every step adds, removes or breaks a real part, on the words that name it, until the finished thing stands where nothing was. Close-ups explain each detail, then we return to the same wide shot to see it grown.",
    "cutaway": "A true story or an explanation seen in cross-section: the solid world is sliced open so we watch what's hidden (a tunnel, a body, a machine, the deep sea), with one long camera following the subject and rarely cutting, and one gauge counting down what's running out.",
    "explainer": "A question about how the world works, answered by showing it. Open on the surprising result or the question itself, then build one simple setup the viewer can follow (a ball, a rope, a planet, a falling person) and change one thing at a time. Each step is a cause the picture proves on screen, with the numbers worked out as we watch, until the answer is plain to see. End on the twist or the number that sticks.",
    "route": "A map film: one unbroken camera following a journey or campaign across a real relief map, with the route drawing behind a moving marker and a caption card per stop. No characters needed.",
}

# How each style looks and moves. Every video in a style is still written from scratch: these describe a direction, not a template.
STYLE_DIRECTION = {
    "film": "3D, in whatever look suits this story best: warm clay for a cosy everyday comedy, real materials (`Surface`, `Slab`, `Scenery`) for how-things-work and true stories.",
    "diorama": "A 3D miniature: a block of ground with its cut edges showing (`Slab`), one small world seen from above like a model on a table, soft golden light and a slow orbit. Elegant serif titles (THEMES.diorama).",
    "pixel": "Pixel art with real movement. Either the full 3D kit through `<Stage pixels={6} colors={7}>`, which turns people, cameras and lighting into chunky pixels, or a 2D side-scroller with `World2D snap`, `Layer` parallax and `Sprite` animation, whichever tells this story better. Deep violet night and glowing type from THEMES.pixel. Never mix pixel sizes, and don't use smooth gradients or soft shadows on top.",
    "atlas": "A map documentary on a dark background: `GeoMap` with a continuous camera that never cuts, countries changing colour as power shifts, `Route` lines that advance with the narration, flags and arrows, huge condensed headlines with red accents from THEMES.atlas. Use `ReliefMap` when the terrain matters.",
    "parchment": "An old map come alive on aged paper: `GeoMap` or a hand-built diagram in sepia ink, `Route`, `Draw` and `Boil` so that lines look hand-inked, `Grain` for the paper, oxblood accents and classic serif from THEMES.parchment.",
    "ink": "Marker drawings on paper or near black: `Draw` strokes that draw themselves on the words, `Boil` so that every drawing feels alive, figures that actually act and change between poses, one orange accent, handwritten type from THEMES.ink. Draw the idea as a little world the camera (`World2D`) travels through, not as separate cards.",
    "neon": "Synthwave glow on deep indigo: 3D (`Stage` with `night` lights, `Glow`, emissive materials) or glowing `Draw` lines, a slow relentless camera, cyan lines and magenta accents, futuristic type from THEMES.neon.",
    "physics": "A physics explainer, like a textbook diagram come alive: `GraphPaper` or a dark slate, the objects drawn simply and cleanly (`Draw` strokes in 2D, or a softly lit 3D model with `Arrow3D`), moving by the real physics through `simulate`, never by eye. Forces are amber `Vector` arrows that grow, shrink and turn with the motion, and velocity is cyan. A `Trail` or `Strobe` shows the path, a `Plot` draws itself as it happens, an `Equation` builds term by term on the words that name each part, and a `Readout` shows the live number. Real values in real units, and one setup the camera keeps returning to while one thing changes. Clean geometric type and textbook maths from THEMES.physics.",
    "newspaper": "A living old front page: black ink on newsprint, halftone pictures that move, type and columns that build themselves, red stamps landing on the words, `Grain` for the paper, typewriter labels from THEMES.newspaper. The camera moves across one huge page as if it were a world.",
}

PLAN_SYSTEM = """You write short vertical films for a TikTok channel whose videos get millions of views. Facts must be accurate: never invent numbers, dates or quotes; if a detail is disputed, say "around" or "reportedly"."""

PLAN_PROMPT = """Topic: {topic}
{format_block}
{style_block}{language_block}

Write the script for a {seconds}-second film of about {words} spoken words in total, divided into {min_beats}-{max_beats} beats.
It will be animated afterward, by a director who can build any set, machine or creature, but only from what you write here, so think visually.

Story rules:
- The first line hooks in under 3 seconds with a mystery, a contradiction or a promise. Never start with the topic's name or "did you know".
- Keep it simple enough to follow with the sound off and at first viewing. One main character, one main place if the story allows it, and one clear goal. A stranger should be able to retell the story in one sentence.
- Every step follows from the last in a way anyone would instantly get, and it can be shown with a simple picture. No random objects, no cause that needs explaining, no jokes that only work if you read the caption closely.
- Each beat is one plot turn and takes 8-12 seconds, because the viewer needs time to see it happen and see the result. Fewer turns told clearly beat many turns told fast. There's a chain of "but" and "so", never "and then". Plant something early and pay it off at the end.
- Narration is for a voice actor: plain text, no stage directions, numbers written the way they're read aloud. Each beat is 1-3 short sentences saying only what the picture can show at that moment.
- For each beat give 1-3 `shots`, concrete and filmable: where the camera is, who does what, what changes. "Low angle by the kerb: the backpack unfolds four legs and stands up" and not "shows the backpack". Each shot shows one thing.

Also return `title` (short, for the file name), `caption` (TikTok description: 1 line and 3-5 hashtags), `format`, `style`, `concept` (1-2 sentences on what makes this film work), `world` (the places and how they look), and `cast` (everyone who appears and how they look, or empty)."""

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "caption": {"type": "string"},
        "format": {"type": "string", "enum": list(FORMATS)},
        "style": {"type": "string", "enum": list(STYLE_DIRECTION)},
        "concept": {"type": "string"},
        "world": {"type": "string"},
        "cast": {"type": "string"},
        "beats": {"type": "array", "items": {
            "type": "object",
            "properties": {"narration": {"type": "string"}, "shots": {"type": "array", "items": {"type": "string"}}},
            "required": ["narration", "shots"],
        }},
    },
    "required": ["title", "caption", "format", "style", "concept", "world", "cast", "beats"],
}

BUILD_PROMPT = """Make this film. It's already written and voiced; `film.json` has the exact narration timings, and the audio is fixed.

Title: {title}
Format: {format} - {format_note}
Style: {style} - {style_note}
Concept: {concept}
World: {world}
Cast: {cast}

Shot ideas per beat (improve on them freely, the narration can't change):
{beats}

Read KIT.md first, then replace Film.tsx with the real film. The finished film has to pass `node ../../scripts/film.mjs check`.
{library}"""

LIBRARY_NOTE = """
Past films left reusable pieces in the library: see {index}. Look through it and use a piece only if it really is the best thing for this film: copy its file into this folder and change it freely. Building something new is just as good, and this film must never look like the one a piece came from."""

HARVEST_PROMPT = """The film is finished. Is there anything in it that a very different future film could use as it stands: a material, a rig, a machine part, a transition, a way of moving, a graphic? Skip whatever is specific to this story, and don't save anything just to save something; saving nothing is fine.

For each piece, write it as a self-contained file in `./library/`, with no story text and with its details as props. Then write `./library/manifest.json`: a list of {{"file": "name.tsx", "what": "one line on what it is and when it's useful", "style": "the look it suits, or any"}}. Imports stay as `../../src/film`, because future films copy a piece next to their own Film.tsx. Run `film.mjs check` only if you changed Film.tsx. Finish with one line."""


TSCONFIG = {"extends": "../../tsconfig.json", "include": [".", "../../src/film"]}

ENTRY = """import {registerRoot} from 'remotion';
import {filmRoot} from '../../src/film';
import {Film} from './Film';
import data from './film.json';

registerRoot(filmRoot(Film, data as Parameters<typeof filmRoot>[1]));
"""

STARTER = """export const Film: React.FC = () => null;
"""

# The agent writes only inside its film folder, and its shell runs only the two film tools.
AGENT_TOOLS = ["--tools", "Read,Write,Edit,Glob,Grep,Bash",
               "--allowedTools", "Read", "Glob", "Grep", "Write(./**)", "Edit(./**)", "Bash(node ../../scripts/film.mjs:*)",
               "--permission-mode", "dontAsk", "--strict-mcp-config", "--setting-sources", "project"]


def can_build_films():
    return active_provider() == "claude" and bool(detect_claude_code())


def _raise_voice(wav):
    """Brings the narration up to a full, consistent level: TTS voices come out quiet."""
    import soundfile as sf

    audio, rate = sf.read(wav, dtype="float32")
    peak = float(abs(audio).max())
    if peak > 0:
        sf.write(wav, audio * (VOICE_PEAK / peak), rate)


def plan_film(topic, seconds, wps, language, film_format="auto", style="film"):
    if film_format in FORMATS:
        format_block = f"Format: {film_format} - {FORMATS[film_format]}"
    else:
        options = "\n".join(f"- {name}: {note}" for name, note in FORMATS.items())
        format_block = f"Choose the format that makes the best film of this topic:\n{options}"
    if style in STYLE_DIRECTION:
        style_block = f"Visual style: {style} - {STYLE_DIRECTION[style]}"
    else:
        options = "\n".join(f"- {name}: {note}" for name, note in STYLE_DIRECTION.items())
        style_block = f"Choose the visual style that makes the best film of this topic:\n{options}"
    language_block = ""
    if language != "en":
        name = LANGUAGES[language]["name"]
        language_block = (f"\n\nLanguage: write the narration, `title` and `caption` in {name}, the way a native storyteller would, in its own alphabet. "
                          f"Write `shots`, `concept`, `world` and `cast` in English.")
    words = int(seconds * wps * WORD_ROOM)
    plan = generate(PLAN_PROMPT.format(topic=topic, format_block=format_block, style_block=style_block, language_block=language_block, seconds=seconds, words=words,
                                       min_beats=max(3, seconds // 12), max_beats=max(4, seconds // 8)), schema=PLAN_SCHEMA, system=PLAN_SYSTEM)
    plan["beats"] = [b for b in plan.get("beats", []) if b.get("narration", "").strip()]
    if not plan["beats"]:
        raise RuntimeError("The AI returned an empty film plan.")
    if film_format in FORMATS:
        plan["format"] = film_format
    if style in STYLE_DIRECTION:
        plan["style"] = style
    elif plan.get("style") not in STYLE_DIRECTION:
        plan["style"] = "film"
    return plan


def _workspace(film_id, film):
    folder = os.path.join(FILMS_DIR, film_id)
    os.makedirs(folder, exist_ok=True)
    files = {"film.json": json.dumps(film, ensure_ascii=False, indent=2), "index.ts": ENTRY, "Film.tsx": STARTER, "tsconfig.json": json.dumps(TSCONFIG, indent=2)}
    for name, text in files.items():
        with open(os.path.join(folder, name), "w", encoding="utf-8") as f:
            f.write(text)
    shutil.copy(os.path.join(KIT_DIR, "KIT.md"), folder)
    return folder


def _library_note():
    index = os.path.join(LIBRARY_DIR, "INDEX.md")
    return LIBRARY_NOTE.format(index=os.path.relpath(index, os.path.join(FILMS_DIR, "x"))) if os.path.exists(index) else ""


def _rebuild_library_index():
    entries = []
    for folder in sorted(os.listdir(LIBRARY_DIR)):
        manifest = os.path.join(LIBRARY_DIR, folder, "manifest.json")
        if not os.path.isfile(manifest):
            continue
        with open(manifest, encoding="utf-8") as f:
            for item in json.load(f):
                entries.append(f"- `{folder}/{item['file']}` ({item.get('style', 'any')}): {item.get('what', '')}")
    with open(os.path.join(LIBRARY_DIR, "INDEX.md"), "w", encoding="utf-8") as f:
        f.write("# Pieces saved from past films\n\nPaths are relative to this folder. Copy one next to your Film.tsx if it fits, and change it freely.\n\n" + "\n".join(entries) + "\n")


def _save_to_library(folder, film_id):
    """Keeps only entries whose file really exists, so a future film can trust the index."""
    source = os.path.join(folder, "library")
    manifest = os.path.join(source, "manifest.json")
    if not os.path.isfile(manifest):
        return 0
    with open(manifest, encoding="utf-8") as f:
        items = json.load(f)
    if not isinstance(items, list):
        return 0
    kept = [i for i in items if isinstance(i, dict) and isinstance(i.get("file"), str) and os.path.basename(i["file"]) == i["file"] and os.path.isfile(os.path.join(source, i["file"]))]
    if not kept:
        return 0
    target = os.path.join(LIBRARY_DIR, film_id)
    os.makedirs(target, exist_ok=True)
    for item in kept:
        shutil.copy(os.path.join(source, item["file"]), target)
    with open(os.path.join(target, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(kept, f, ensure_ascii=False, indent=2)
    _rebuild_library_index()
    return len(kept)


def _harvest(folder, film_id, session, stats, log):
    """The video is already finished, so nothing here may fail it."""
    try:
        log("[Film] Saving reusable pieces for future films...")
        _add_stats(stats, _run_agent(folder, HARVEST_PROMPT, session, True, log))
        saved = _save_to_library(folder, film_id)
        log(f"[Film] Saved {saved} reusable piece(s).")
    except (LLMError, OSError, ValueError, KeyError) as e:
        log(f"[Film] Couldn't save reusable pieces: {e}")


def _describe_tool(block):
    name = block.get("name")
    args = block.get("input", {})
    if name == "Bash":
        return "Rendering test frames" if " check" in args.get("command", "") else "Fetching map data"
    if name in ("Write", "Edit"):
        return f"Writing {os.path.basename(args.get('file_path', ''))}"
    if name == "Read" and args.get("file_path", "").endswith(".jpg"):
        return "Looking at the frames"
    return None


def _run_agent(folder, prompt, session, resume, log):
    """One Claude Code session in the film folder. Returns its final result message."""
    info = detect_claude_code()
    cmd = [info["path"], "-p", "--output-format", "stream-json", "--verbose", *AGENT_TOOLS]
    cmd += ["--resume", session] if resume else ["--session-id", session]
    with open(os.path.join(KIT_DIR, "BRIEF.md"), encoding="utf-8") as f:
        cmd += ["--append-system-prompt", f.read()]
    model = os.getenv("ACE_CLAUDE_MODEL")
    if model:
        cmd += ["--model", model]
    env = dict(_claude_env(), ACE_PYTHON=sys.executable)
    proc = subprocess.Popen(cmd, cwd=folder, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, **own_group())
    RUNNING.add(proc)
    # The whole process group goes on timeout, including any render the agent started.
    watchdog = threading.Timer(BUILD_TIMEOUT, lambda: kill_group(proc))
    watchdog.start()
    result = None
    tail = []
    try:
        proc.stdin.write(prompt)
        proc.stdin.close()
        for line in proc.stdout:
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                tail = (tail + [line.strip()])[-8:]
                continue
            if event.get("type") == "assistant":
                for block in event.get("message", {}).get("content", []):
                    if block.get("type") == "tool_use":
                        note = _describe_tool(block)
                        if note:
                            log(f"[Film] {note}")
            elif event.get("type") == "result":
                result = event
        proc.wait()
    finally:
        expired = not watchdog.is_alive()
        watchdog.cancel()
        RUNNING.discard(proc)
    if expired:
        raise LLMError(f"The film build passed its {BUILD_TIMEOUT // 60} minute limit.")
    if result is None:
        raise LLMError("Claude Code stopped without finishing: " + " ".join(tail)[-400:])
    if result.get("is_error"):
        raise LLMError(f"Claude Code error: {result.get('result') or result.get('subtype')}")
    return result


def _check(folder):
    """The app's own check, independent of what the agent reported. Returns error text, or None when the film renders."""
    env = dict(os.environ, ACE_PYTHON=sys.executable)
    proc = subprocess.run([_npm_bin("node"), os.path.join(MOTION_DIR, "scripts", "film.mjs"), "check"], cwd=folder, env=env, capture_output=True, text=True, timeout=1800)
    return None if proc.returncode == 0 else (proc.stderr or proc.stdout)[-3000:]


def _add_stats(stats, result):
    usage = result.get("usage", {})
    stats["agent_minutes"] = round(stats.get("agent_minutes", 0) + result.get("duration_ms", 0) / 60000, 1)
    stats["turns"] = stats.get("turns", 0) + result.get("num_turns", 0)
    stats["cost_equivalent_usd"] = round(stats.get("cost_equivalent_usd", 0) + result.get("total_cost_usd", 0), 2)
    for key in ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"):
        stats[key] = stats.get(key, 0) + usage.get(key, 0)


def render_film(film_id, output_path, log=print):
    log("[Render] Rendering video (3D films take a while on CPU)...")
    entry = os.path.join("films", film_id, "index.ts")
    _stream([_npm_bin("npx"), "remotion", "render", entry, "Film", os.path.abspath(output_path), "--log=info"], log)
    return output_path


def build_film(plan, film, folder, base, log):
    """Has the agent build the film and fixes whatever fails afterward. Saves usage numbers next to the video."""
    beats = "\n".join(f"{i + 1}. [{b['start']:.1f}s] \"{b['narration']}\" - " + " / ".join(b.get("shots", [])) for i, b in enumerate(film["beats"]))
    prompt = BUILD_PROMPT.format(title=plan["title"], format=plan["format"], format_note=FORMATS[plan["format"]], style=plan["style"], style_note=STYLE_DIRECTION[plan["style"]],
                                 concept=plan["concept"], world=plan["world"], cast=plan["cast"] or "none", beats=beats, library=_library_note())
    session = str(uuid.uuid4())
    stats = {"session": session, "format": plan["format"], "style": plan["style"], "fixes": 0}
    log("[Film] Claude is building the film...")
    started = time.time()
    _add_stats(stats, _run_agent(folder, prompt, session, False, log))
    for attempt in range(MAX_FIXES + 1):
        log("[Film] Verifying the build...")
        error = _check(folder)
        if not error:
            break
        if attempt == MAX_FIXES:
            raise RuntimeError(f"The film still fails after {MAX_FIXES} fixes. Its code is in {folder}.\n{error}")
        stats["fixes"] += 1
        log(f"[Film] The build failed its check; asking Claude to fix it ({attempt + 1}/{MAX_FIXES})...")
        _add_stats(stats, _run_agent(folder, f"`film.mjs check` fails:\n\n{error}\n\nFix it and check again.", session, True, log))
    stats["build_minutes"] = round((time.time() - started) / 60, 1)

    started = time.time()
    video = None
    for attempt in range(2):
        try:
            video = render_film(film["id"], base + ".mp4", log)
            break
        except RuntimeError as e:
            if attempt:
                raise
            stats["fixes"] += 1
            log("[Film] The final render failed; asking Claude to fix it...")
            _add_stats(stats, _run_agent(folder, f"The final render fails:\n\n{str(e)[-3000:]}\n\nFix it and check again.", session, True, log))
    stats["render_minutes"] = round((time.time() - started) / 60, 1)
    _harvest(folder, film["id"], session, stats, log)
    with open(base + ".film.json", "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)
    log(f"[Film] Build {stats['build_minutes']} min, render {stats['render_minutes']} min, {stats['turns']} agent turns.")
    return video


def make_film(topic, slug, voice, speed=1.1, captions=True, handle="", seconds=55, music_path=None, output_dir=None, film_format="auto", style="film", log=print):
    if not can_build_films():
        raise LLMError("Custom films need Claude Code: it writes and checks each film's code, which the Gemini mode can't do. Pick another style or install Claude Code.")
    ensure_installed(log)
    language = voice_language(voice)
    log(f"[Film] Writing the film for: {topic}")
    plan = plan_film(topic, seconds, words_per_second(voice), language, film_format, style)
    log(f"[Film] '{plan['title']}' - {plan['format']}, {plan['style']} style, {len(plan['beats'])} beats")

    film_id = f"{slug(plan['title'])[:40]}_{int(time.time())}"
    assets = os.path.join(PUBLIC_DIR, film_id)
    os.makedirs(assets, exist_ok=True)
    wav = os.path.join(assets, "narration.wav")
    words = voice_scenes(plan["beats"], wav, preset=voice, speed=min(speed, MAX_SPEED), log=log, scene_gap=BEAT_PAUSE)
    _raise_voice(wav)
    film = {"id": film_id, "title": plan["title"], "language": language, "fps": 30, "width": 1080, "height": 1920, "captions": captions, "handle": handle,
            "audio": f"films/{film_id}/narration.wav", "beats": plan["beats"], "words": words}
    if music_path and os.path.exists(music_path):
        ext = os.path.splitext(music_path)[1]
        shutil.copy(music_path, os.path.join(assets, f"music{ext}"))
        film["music"] = f"films/{film_id}/music{ext}"
    folder = _workspace(film_id, film)

    os.makedirs(output_dir, exist_ok=True)
    base = os.path.join(output_dir, slug(plan["title"]))
    with open(base + ".caption.txt", "w", encoding="utf-8") as f:
        f.write(plan["caption"] + "\n")
    # The library reads the title and style from here; `film` lets --from-storyboard re-render it.
    with open(base + ".storyboard.json", "w", encoding="utf-8") as f:
        json.dump({"title": plan["title"], "style": plan["style"], "film": film_id, "plan": plan}, f, ensure_ascii=False, indent=2)
    video = build_film(plan, film, folder, base, log)
    log(f"[Film] Done: {video}")
    return {"video": video, "title": plan["title"], "caption": plan["caption"]}
