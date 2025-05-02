import sys
import json
from pathlib import Path
from typing import Any


def set_brightness(level: int) -> dict:
    # Simulated write to /sys/class/backlight/*/brightness
    # In real use, would write to the file. Here, just simulate.
    if not (0 <= level <= 255):
        raise ValueError("level must be 0-255")
    return {"status": "ok", "set_level": level}


def handle_request(request: dict) -> dict:
    try:
        tool = request.get("tool")
        if tool == "setBrightness":
            level = int(request.get("level", 0))
            return {"result": set_brightness(level)}
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
