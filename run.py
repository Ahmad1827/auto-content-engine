"""
run.py — Lanseaza versiunea git (publica) a GUI-ului.
"""
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from gui.main import root

if __name__ == "__main__":
    root.mainloop()
