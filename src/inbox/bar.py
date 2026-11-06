"""The Quick Idea bar: a single line at the top of the screen. Type an idea, press Enter, and it's made in the background."""
import customtkinter as ctk

from gui import theme as T
from inbox.jobs import add_idea, load_settings, pending

WIDTH, HEIGHT = 680, 138


def open_bar():
    settings = load_settings()
    ctk.set_appearance_mode(settings.get("appearance", "dark"))
    T.load_fonts()
    win = ctk.CTk(fg_color=T.SURFACE)
    win.title("ACE · Quick idea")
    win.overrideredirect(True)
    win.attributes("-topmost", True)
    scale = ctk.ScalingTracker.get_window_scaling(win)
    width = min(WIDTH, int(win.winfo_screenwidth() / scale - 40))
    x = int((win.winfo_screenwidth() / scale - width) / 2)
    y = int(win.winfo_screenheight() / scale * 0.22)
    win.geometry(f"{width}x{HEIGHT}+{x}+{y}")

    box = ctk.CTkFrame(win, fg_color=T.SURFACE, border_width=2, border_color=T.ACCENT, corner_radius=0)
    box.pack(fill="both", expand=True)
    ctk.CTkLabel(box, text="ACE  ·  WHAT SHOULD THE NEXT VIDEO BE ABOUT?", font=T.font(T.MONO, 10, "bold"), text_color=T.ACCENT,
                 anchor="w").pack(fill="x", padx=18, pady=(10, 0))
    field = ctk.CTkEntry(box, height=52, font=T.font(T.SANS, 19), fg_color=T.FIELD, text_color=T.INK, border_width=0,
                         placeholder_text="A video about...  e.g. the Great Emu War of 1932", placeholder_text_color=T.MUTED)
    field.pack(fill="x", padx=14, pady=(4, 6))

    style = settings.get("motion_style", "auto")
    seconds = settings.get("motion_seconds", 55)
    hint = f"ENTER  make it in the background   ·   ESC  close   ·   {style.upper()}, {seconds}s, {settings.get('motion_language', 'English')}"
    note = ctk.CTkLabel(box, text=hint, font=T.font(T.MONO, 10, "bold"), text_color=T.MUTED, anchor="w")
    note.pack(fill="x", padx=18)

    def submit(_=None):
        topic = " ".join(field.get().split())
        if not topic:
            return
        ahead = len(pending())
        try:
            add_idea(topic)
        except OSError as e:
            note.configure(text=f"Couldn't queue it: {e}", text_color=T.BAD)
            return
        field.configure(state="disabled")
        note.configure(text=f"QUEUED{f'  ·  {ahead} AHEAD OF IT' if ahead else ''}  ·  A NOTICE POPS UP WHEN IT'S READY",
                       text_color=T.GOOD)
        win.after(1400, win.destroy)

    field.bind("<Return>", submit)
    field.bind("<KP_Enter>", submit)
    win.bind("<Escape>", lambda e: win.destroy())

    def grab_focus():
        win.lift()
        win.focus_force()
        field.focus_force()
    # A window with no frame isn't given the keyboard by itself, and the hotkey's window can still hold it for a moment.
    win.after(50, grab_focus)
    win.after(300, grab_focus)
    win.mainloop()
