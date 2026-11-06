"""The small notice in the corner of the screen when a background video is done, or couldn't be made."""
import os
import platform
import subprocess
import sys

import customtkinter as ctk

from gui import theme as T
from inbox.jobs import LOG_PATH, load_settings

WIDTH, HEIGHT = 380, 132
SHOWN_FOR_MS = 45_000


def open_path(path):
    if sys.platform == "win32":
        os.startfile(path)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path])
    elif "microsoft" in platform.release().lower():
        win_path = subprocess.run(["wslpath", "-w", path], capture_output=True, text=True).stdout.strip()
        subprocess.Popen(["explorer.exe", win_path])
    else:
        subprocess.Popen(["xdg-open", path])


def show(result=None, failed=None, reason="", left=0):
    """Shows the notice and returns when it's closed. result is make_motion_video's; failed is the topic that failed."""
    ctk.set_appearance_mode(load_settings().get("appearance", "dark"))
    T.load_fonts()
    win = ctk.CTk(fg_color=T.SURFACE)
    win.overrideredirect(True)
    win.attributes("-topmost", True)
    scale = ctk.ScalingTracker.get_window_scaling(win)
    x = int(win.winfo_screenwidth() / scale - WIDTH - 24)
    y = int(win.winfo_screenheight() / scale - HEIGHT - 72)
    height = HEIGHT if result else HEIGHT + 34
    win.geometry(f"{WIDTH}x{height}+{x}+{int(y - height + HEIGHT)}")

    box = ctk.CTkFrame(win, fg_color=T.SURFACE, border_width=2, border_color=T.RULE if result else T.BAD, corner_radius=0)
    box.pack(fill="both", expand=True)
    head = ctk.CTkFrame(box, fg_color="transparent")
    head.pack(fill="x", padx=16, pady=(12, 0))
    kicker = "VIDEO READY" if result else "COULDN'T MAKE IT"
    if left:
        kicker += f"  ·  {left} MORE COMING"
    ctk.CTkLabel(head, text=kicker, font=T.font(T.MONO, 10, "bold"), text_color=T.GOOD if result else T.BAD).pack(side="left")
    ctk.CTkButton(head, text="×", width=22, height=22, fg_color="transparent", hover_color=T.FIELD_HOVER, text_color=T.MUTED,
                  font=T.font(T.SANS, 16), command=win.destroy).pack(side="right")

    title = result["title"] if result else failed
    ctk.CTkLabel(box, text=title, font=T.font(T.SERIF, 19), text_color=T.INK, anchor="w", justify="left",
                 wraplength=WIDTH - 36).pack(fill="x", padx=16, pady=(2, 0))
    if not result:
        ctk.CTkLabel(box, text=reason, font=T.font(T.MONO, 10), text_color=T.MUTED, anchor="w", justify="left",
                     wraplength=WIDTH - 36).pack(fill="x", padx=16, pady=(2, 0))

    row = ctk.CTkFrame(box, fg_color="transparent")
    row.pack(side="bottom", fill="x", padx=16, pady=(0, 12))

    def button(text, command, solid=False):
        ctk.CTkButton(row, text=text, command=command, height=30, width=0, corner_radius=6, font=T.font(T.SANS, 12, "bold"),
                      fg_color=T.ACCENT if solid else T.FIELD, hover_color=T.ACCENT_HOVER if solid else T.FIELD_HOVER,
                      text_color=T.ON_ACCENT if solid else T.INK, border_width=0 if solid else 1, border_color=T.RULE).pack(side="left", padx=(0, 8))

    def then_close(fn):
        def run():
            fn()
            win.after(300, win.destroy)
        return run

    if result:
        button("Play", then_close(lambda: open_path(result["video"])), solid=True)
        button("Show in folder", then_close(lambda: open_path(os.path.dirname(result["video"]))))

        def copy():
            win.clipboard_clear()
            win.clipboard_append(result.get("caption", ""))
            win.update()
        if result.get("caption"):
            button("Copy caption", then_close(copy))
    else:
        button("Open the log", then_close(lambda: open_path(LOG_PATH)), solid=True)

    win.after(SHOWN_FOR_MS, win.destroy)
    win.mainloop()
