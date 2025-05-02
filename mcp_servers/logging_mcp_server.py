import sys
import json
from pathlib import Path
from typing import Any


def log_error(module: str, message: str, timestamp: str) -> dict:
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / "error.log"
    entry = {"module": module, "message": message, "timestamp": timestamp}
    with log_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    return {"status": "logged"}


def handle_request(request: dict) -> dict:
    try:
        tool = request.get("tool")
        if tool == "logError":
            module = str(request.get("module", ""))
            message = str(request.get("message", ""))
            timestamp = str(request.get("timestamp", ""))
            return {"result": log_error(module, message, timestamp)}
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
