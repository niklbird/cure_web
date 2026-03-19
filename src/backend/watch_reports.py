#!/usr/bin/env python3
"""
watch_reports.py — Watches DATA_FOLDER for new/modified files and runs
`python manage.py update` whenever a change is detected.

Uses polling (no inotify dependency) so it works reliably on Docker
bind-mounts across all host OSes (Linux, macOS, Windows/WSL).
"""

import os
import sys
import time
import subprocess
import signal

# ─── Configuration ───────────────────────────────────────────────────────────

WATCH_DIR = os.environ.get("DATA_FOLDER", "/app/data/reports")
POLL_INTERVAL = int(os.environ.get("WATCH_POLL_INTERVAL", "5"))  # seconds
MANAGE_PY = os.environ.get("MANAGE_PY_PATH", "/app/manage.py")

# ─── State ───────────────────────────────────────────────────────────────────

# Track files we've already seen: {filepath: mtime}
known_files: dict[str, float] = {}
running = True


def handle_signal(signum, frame):
    global running
    print(f"[watcher] Received signal {signum}, shutting down...")
    running = False


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


def scan_directory(directory: str) -> dict[str, float]:
    """Return a dict of {filepath: mtime} for all files in directory."""
    result = {}
    if not os.path.isdir(directory):
        return result
    for entry in os.scandir(directory):
        if entry.is_file():
            try:
                result[entry.path] = entry.stat().st_mtime
            except OSError:
                pass
    return result


def run_update():
    """Execute the Django update management command."""
    print("[watcher] Change detected — running 'manage.py update'...")
    try:
        result = subprocess.run(
            [sys.executable, MANAGE_PY, "update"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.stdout:
            print(f"[watcher] {result.stdout.strip()}")
        if result.stderr:
            print(f"[watcher] STDERR: {result.stderr.strip()}")
        if result.returncode != 0:
            print(f"[watcher] Command exited with code {result.returncode}")
        else:
            print("[watcher] Update completed successfully.")
    except subprocess.TimeoutExpired:
        print("[watcher] ERROR: Update command timed out after 120s")
    except Exception as e:
        print(f"[watcher] ERROR: {e}")


def main():
    global known_files

    print(f"[watcher] Watching directory: {WATCH_DIR}")
    print(f"[watcher] Poll interval: {POLL_INTERVAL}s")

    # Wait for the directory to exist
    while running and not os.path.isdir(WATCH_DIR):
        print(f"[watcher] Waiting for {WATCH_DIR} to appear...")
        time.sleep(POLL_INTERVAL)

    # Initial scan — don't trigger on files that already exist at startup
    known_files = scan_directory(WATCH_DIR)
    if known_files:
        print(f"[watcher] Found {len(known_files)} existing file(s), skipping initial trigger.")
    else:
        print("[watcher] Directory is empty, waiting for files...")

    # Poll loop
    while running:
        time.sleep(POLL_INTERVAL)

        current_files = scan_directory(WATCH_DIR)

        # Detect new or modified files
        changed = False
        for filepath, mtime in current_files.items():
            if filepath not in known_files:
                print(f"[watcher] New file: {os.path.basename(filepath)}")
                changed = True
            elif mtime > known_files[filepath]:
                print(f"[watcher] Modified file: {os.path.basename(filepath)}")
                changed = True

        if changed:
            run_update()

        known_files = current_files

    print("[watcher] Stopped.")


if __name__ == "__main__":
    main()