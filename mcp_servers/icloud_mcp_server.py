import sys
import json
from pathlib import Path
from typing import Any


def fetch_calendars() -> dict:
    # Simulated response
    return {"calendars": ["Family", "Work"]}


def fetch_reminders() -> dict:
    # Simulated response
    return {"reminders": ["Buy milk", "Call mom"]}


def fetch_photos() -> dict:
    # Simulated response
    return {"photo_url": "https://example.com/random_photo.jpg"}


def handle_request(request: dict) -> dict:
    try:
        tool = request.get("tool")
        if tool == "fetchCalendars":
            return {"result": fetch_calendars()}
        elif tool == "fetchReminders":
            return {"result": fetch_reminders()}
        elif tool == "fetchPhotos":
            return {"result": fetch_photos()}
        else:
            return {"error": f"Unknown tool: {tool}"}
    except Exception as e:
        return {"error": str(e)}


def main() -> None:
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            request = json.loads(line)
            response = handle_request(request)
        except Exception as e:
            response = {"error": str(e)}
        print(json.dumps(response), flush=True)


if __name__ == "__main__":
    main()
