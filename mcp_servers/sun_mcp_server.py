import sys
import json
from pathlib import Path
from typing import Any


def get_sunrise_sunset(latitude: float, longitude: float) -> dict:
    # Simulated response
    return {"sunrise": "06:00", "sunset": "20:00"}


def handle_request(request: dict) -> dict:
    try:
        tool = request.get("tool")
        if tool == "getSunriseSunset":
            latitude = float(request.get("latitude", 0))
            longitude = float(request.get("longitude", 0))
            return {"result": get_sunrise_sunset(latitude, longitude)}
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
