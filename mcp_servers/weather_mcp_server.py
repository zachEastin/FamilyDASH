import sys
import json
from pathlib import Path
from typing import Any


def get_current_weather() -> dict:
    # Simulated response
    return {"temp_c": 21.5, "condition": "Partly Cloudy"}


def get_forecast() -> dict:
    # Simulated response
    return {"forecast": [{"day": "Monday", "temp_c": 22}, {"day": "Tuesday", "temp_c": 20}]}


def handle_request(request: dict) -> dict:
    try:
        tool = request.get("tool")
        if tool == "getCurrentWeather":
            return {"result": get_current_weather()}
        elif tool == "getForecast":
            return {"result": get_forecast()}
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
