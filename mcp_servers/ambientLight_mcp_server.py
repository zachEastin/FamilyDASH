import sys
import json
from pathlib import Path
from typing import Any


def get_light_level() -> dict:
    # Simulated response
    return {"level": 128}  # 0-255


def handle_request(request: dict) -> dict:
    try:
        tool = request.get("tool")
        if tool == "getLightLevel":
            return {"result": get_light_level()}
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
