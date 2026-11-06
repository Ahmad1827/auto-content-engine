"""Quick Idea: make a video without opening the app.

    python quick_idea.py                      # opens the bar: type an idea, press Enter
    python quick_idea.py "The Great Emu War"  # queues it straight away, no bar

Videos are made one at a time in the background with the Motion settings last used in the app,
and saved to output/. A notice pops up as each one is done. The log is output/.inbox/background.log.
"""
import os
import sys

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))


def main():
    args = sys.argv[1:]
    if args == ["--work"]:
        from inbox.worker import work
        return work()
    if args:
        from inbox.jobs import add_idea
        add_idea(" ".join(args))
        print("Queued. It's being made in the background; a notice pops up when it's ready.")
        return
    from inbox.bar import open_bar
    open_bar()


if __name__ == "__main__":
    sys.exit(main())
