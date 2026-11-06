"""The background maker: works through the inbox one idea at a time with no window, and shows a notice as each video is done."""
import json
import os
import shutil
import sys
import time
import traceback

from inbox.jobs import FAILED, LOG_PATH, RENDER_LOCK, ROOT, WORKER_LOCK, pending, video_options

LOG_LIMIT = 5_000_000


def say(text):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {text}", flush=True)


def work():
    os.chdir(ROOT)
    while True:
        if not WORKER_LOCK.acquire():
            return
        try:
            _trim_log()
            _drain()
        finally:
            WORKER_LOCK.release()
        # An idea that arrived just as this maker was finishing found the lock still taken, so look once more.
        if not pending():
            return


def _drain():
    from motion_gen.pipeline import make_motion_video

    while True:
        jobs = pending()
        if not jobs:
            return
        path = jobs[0]
        try:
            with open(path, encoding="utf-8") as f:
                job = json.load(f)
            topic = job["topic"]
        except (OSError, ValueError, KeyError) as e:
            say(f"Skipping {os.path.basename(path)}, which can't be read: {e}")
            _fail(path)
            continue

        waiting = False
        while not RENDER_LOCK.acquire():
            if not waiting:
                say("The app is making a video. Waiting for it to finish.")
                waiting = True
            time.sleep(10)
        try:
            options = video_options(job.get("settings", {}))
            say(f"Making: {topic} ({options['style']}, {options['seconds']}s, {options['voice']})")
            result = make_motion_video(topic, log=lambda msg: say(msg), **options)
        except Exception as e:
            traceback.print_exc()
            say(f"Failed: {topic}")
            _fail(path)
            _notify(failed=topic, reason=" ".join(str(e).split())[:160])
        else:
            os.remove(path)
            say(f"Done: {result['video']}")
            _notify(result=result)
        finally:
            RENDER_LOCK.release()


def _fail(path):
    os.makedirs(FAILED, exist_ok=True)
    shutil.move(path, os.path.join(FAILED, os.path.basename(path)))


def _notify(**kwargs):
    try:
        from inbox.toast import show
        show(left=len(pending()), **kwargs)
    except Exception as e:
        # No screen to show it on (a server, say): the log still has it.
        say(f"Couldn't show the notice: {e}")


def _trim_log():
    try:
        if os.path.getsize(LOG_PATH) > LOG_LIMIT:
            with open(LOG_PATH, "rb") as f:
                f.seek(-LOG_LIMIT // 5, os.SEEK_END)
                tail = f.read()
            with open(LOG_PATH, "wb") as f:
                f.write(tail)
    except OSError:
        pass


if __name__ == "__main__":
    sys.exit(work())
