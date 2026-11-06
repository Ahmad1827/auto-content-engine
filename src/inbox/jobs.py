"""The inbox of ideas, the locks that keep one video rendering at a time, and turning saved settings into a video.

Kept free of heavy imports, so that the Quick Idea bar opens at once.
"""
import glob
import json
import os
import re
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUTPUT_DIR = os.path.join(ROOT, "output")
INBOX = os.path.join(OUTPUT_DIR, ".inbox")
FAILED = os.path.join(INBOX, "failed")
LOG_PATH = os.path.join(INBOX, "background.log")
SETTINGS_PATH = os.path.join(ROOT, ".ace_settings.json")

STORY_KINDS = {"AI picks": "auto", "Everyday and relatable": "relatable", "Escalating comedy": "escalation", "First person": "pov", "Documentary": "documentary",
               "How it's made": "process", "Cross-section": "cutaway", "Journey on a map": "route"}


def voice_label(key):
    """Tk can't draw emoji, so flags become country codes: '🇺🇸 AM - Michael' -> 'US · AM - Michael'."""
    flag = "".join(chr(ord(c) - 0x1F1E6 + 65) for c in key if 0x1F1E6 <= ord(c) <= 0x1F1FF)
    text = re.sub(r"[^\u0000-￿]|️", "", key).strip()
    return f"{flag} · {text}" if flag else text


def load_settings():
    try:
        with open(SETTINGS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


class FileLock:
    """A lock the operating system lets go of when its process ends, so a crash never leaves it stuck."""

    def __init__(self, name):
        self.path = os.path.join(INBOX, name)
        self.file = None

    def acquire(self):
        """Takes the lock if it's free. Returns whether it was taken."""
        if self.file:
            return True
        os.makedirs(INBOX, exist_ok=True)
        f = open(self.path, "a+")
        try:
            if sys.platform == "win32":
                import msvcrt
                f.seek(0)
                msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            f.close()
            return False
        self.file = f
        return True

    def release(self):
        if not self.file:
            return
        try:
            if sys.platform == "win32":
                import msvcrt
                self.file.seek(0)
                msvcrt.locking(self.file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file.fileno(), fcntl.LOCK_UN)
        finally:
            self.file.close()
            self.file = None


# Held by whoever is making a video, the app or the background maker: two at once would bring the machine to a halt.
RENDER_LOCK = FileLock("render.lock")
# Held by the one background maker that is running.
WORKER_LOCK = FileLock("worker.lock")


def add_idea(topic):
    """Puts an idea in the inbox with the app's settings as they are now, and makes sure the background maker is running."""
    os.makedirs(INBOX, exist_ok=True)
    path = os.path.join(INBOX, f"{time.time_ns()}.json")
    with open(path + ".tmp", "w", encoding="utf-8") as f:
        json.dump({"topic": topic, "settings": load_settings()}, f, ensure_ascii=False, indent=2)
    os.replace(path + ".tmp", path)
    start_worker()
    return path


def pending():
    return sorted(glob.glob(os.path.join(INBOX, "*.json")))


def start_worker():
    """Starts the background maker with no window. If one is already running, the new one sees that and quits."""
    os.makedirs(INBOX, exist_ok=True)
    log = open(LOG_PATH, "a", encoding="utf-8")
    options = {"creationflags": subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP} if sys.platform == "win32" else {"start_new_session": True}
    subprocess.Popen([sys.executable, os.path.join(ROOT, "quick_idea.py"), "--work"], cwd=ROOT, stdin=subprocess.DEVNULL,
                     stdout=log, stderr=subprocess.STDOUT, close_fds=True, **options)
    log.close()


def video_options(settings):
    """The Motion panel's choices, read from the saved settings, as make_motion_video arguments."""
    from motion_gen.narration import CHATTERBOX_VOICES, chatterbox_available
    from voice_gen.edge_narration import EDGE_VOICES, LANGUAGES, voice_language
    from voice_gen.kokoro_narration import VOICE_PRESETS

    code = next((c for c, lang in LANGUAGES.items() if lang["name"] == settings.get("motion_language", "English")), "en")
    if code == "en":
        voices = [*(CHATTERBOX_VOICES if chatterbox_available() else []), *VOICE_PRESETS]
        saved = settings.get("motion_voice")
    else:
        voices = [v for v in EDGE_VOICES if voice_language(v) == code]
        saved = settings.get(f"motion_voice_{code}")
    voice = next((v for v in voices if voice_label(v) == saved), voices[0])

    handle = settings.get("handle", "").strip()
    if handle and not handle.startswith("@"):
        handle = "@" + handle
    return {"style": settings.get("motion_style", "auto"), "voice": voice, "seconds": settings.get("motion_seconds", 55),
            "captions": settings.get("motion_captions", True), "handle": handle,
            "film_format": STORY_KINDS.get(settings.get("motion_story", "AI picks"), "auto")}
