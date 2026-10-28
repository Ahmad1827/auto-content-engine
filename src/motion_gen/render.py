"""Renders a storyboard with the Remotion project in motion/."""
import json
import os
import shutil
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MOTION_DIR = os.path.join(ROOT, "motion")


def _npm_bin(name):
    found = shutil.which(name)
    if not found:
        raise RuntimeError(f"`{name}` not found. Install Node.js 20+ (https://nodejs.org) to render motion videos.")
    return found


def ensure_installed(log=print):
    """First run on a new machine: install the Remotion project's packages."""
    if os.path.isdir(os.path.join(MOTION_DIR, "node_modules", "remotion")):
        return
    log("[Render] First run: installing motion engine packages (one time, ~1 min)...")
    subprocess.run([_npm_bin("npm"), "install", "--no-audit", "--no-fund"], cwd=MOTION_DIR, check=True)


def _stream(cmd, log):
    proc = subprocess.Popen(cmd, cwd=MOTION_DIR, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    last_pct = -10
    tail = []
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        tail = (tail + [line])[-15:]
        # Remotion prints progress constantly; only forward every ~10%.
        if "Rendered" in line or "Encoded" in line:
            try:
                done, total = line.split()[1].strip(",").split("/")
                pct = int(int(done) * 100 / int(total))
            except (IndexError, ValueError):
                continue
            if pct - last_pct >= 10:
                log(f"[Render] {line}")
                last_pct = pct
        elif "error" in line.lower():
            log(f"[Render] {line}")
    if proc.wait() != 0:
        raise RuntimeError("Remotion render failed:\n" + "\n".join(tail))


def render(storyboard, wav_path, output_path, music_path=None, log=print):
    ensure_installed(log)
    job = f"job_{os.getpid()}_{abs(hash(output_path)) % 10**8}"
    job_dir = os.path.join(MOTION_DIR, "public", "jobs", job)
    os.makedirs(job_dir, exist_ok=True)
    try:
        shutil.copy(wav_path, os.path.join(job_dir, "narration.wav"))
        props = dict(storyboard, audio=f"jobs/{job}/narration.wav")
        if music_path and os.path.exists(music_path):
            ext = os.path.splitext(music_path)[1]
            shutil.copy(music_path, os.path.join(job_dir, f"music{ext}"))
            props["music"] = f"jobs/{job}/music{ext}"
        props_path = os.path.join(job_dir, "props.json")
        with open(props_path, "w", encoding="utf-8") as f:
            json.dump(props, f, ensure_ascii=False)

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        log("[Render] Rendering video (this takes a few minutes on CPU)...")
        _stream([_npm_bin("npx"), "remotion", "render", "src/index.ts", "Story", os.path.abspath(output_path),
                 f"--props={props_path}", "--log=info"], log)
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)
    return output_path
