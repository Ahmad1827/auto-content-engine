"""
run_local.py — Versiunea locala cu tot integrat.
La pornire: refresheaza proxy-urile, apoi lanseaza GUI-ul.
NU se pune pe git (e in .gitignore).
"""
import sys
import os
import subprocess
import time

root_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, root_dir)
sys.path.insert(0, os.path.join(root_dir, 'src'))


def refresh_proxies():
    proxy_script = os.path.join(root_dir, "src", "utils", "proxy_api.py")
    if not os.path.exists(proxy_script):
        print("[run_local] proxy_api.py not found, skipping")
        return

    proxies_file = os.path.join(root_dir, "proxies.txt")

    if os.path.exists(proxies_file):
        age = time.time() - os.path.getmtime(proxies_file)
        if age < 600:
            with open(proxies_file) as f:
                count = sum(1 for line in f if line.strip())
            print(f"[run_local] proxies.txt fresh ({age:.0f}s, {count} proxies). Skip.")
            return

    print("[run_local] Refreshing proxies...")
    try:
        subprocess.run([sys.executable, proxy_script], check=True,
                       capture_output=True, text=True, timeout=120, cwd=root_dir)
        if os.path.exists(proxies_file):
            with open(proxies_file) as f:
                count = sum(1 for line in f if line.strip())
            print(f"[run_local] Proxies ready: {count}")
    except subprocess.TimeoutExpired:
        print("[run_local] Proxy refresh timed out, continuing")
    except Exception as e:
        print(f"[run_local] Proxy refresh failed: {e}, continuing")


if __name__ == "__main__":
    refresh_proxies()
    from gui.main_local import run
    run()
