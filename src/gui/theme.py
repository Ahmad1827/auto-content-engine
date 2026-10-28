"""Look of the app: an editing-room / archive feel. Every colour is a (light, dark) pair for CustomTkinter."""
import glob
import os

import customtkinter as ctk

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Paper and ink by day, a darkroom with an amber safelight by night.
BG = ("#EEE7DA", "#141210")
SURFACE = ("#F7F2E9", "#1C1A17")
FIELD = ("#FFFDF8", "#25221E")
FIELD_HOVER = ("#F3ECDF", "#2D2924")
INK = ("#1D1A16", "#EFE7D8")
MUTED = ("#7B7062", "#93897A")
RULE = ("#D8CDBA", "#34302A")
ACCENT = ("#C4401C", "#F07B3F")
ACCENT_HOVER = ("#A63414", "#FF945C")
ON_ACCENT = ("#FFF8EE", "#1A0F08")
GOOD = ("#3F7D4E", "#7BC48C")
BAD = ("#B3261E", "#FF8A80")

# The sidebar stays dark in both modes, like the slate on a film set.
SLATE = ("#1D1A16", "#0D0C0B")
SLATE_INK = ("#EFE7D8", "#EFE7D8")
SLATE_MUTED = ("#8F8577", "#7A7164")
SLATE_ACTIVE = ("#2B2722", "#1C1A17")
SLATE_GOOD = ("#7BC48C", "#7BC48C")
SLATE_BAD = ("#FF8A80", "#FF8A80")

SERIF = "DM Serif Display"
SANS = "IBM Plex Sans"
MONO = "IBM Plex Mono"


def load_fonts():
    """Registers the bundled fonts; must run before the Tk root exists."""
    for path in glob.glob(os.path.join(ROOT, "assets", "fonts", "*.ttf")):
        ctk.FontManager.load_font(path)


def font(family, size, weight="normal", slant="roman"):
    return ctk.CTkFont(family=family, size=size, weight=weight, slant=slant)
