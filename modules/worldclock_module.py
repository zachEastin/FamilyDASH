from flask import Blueprint, jsonify, request
import os
import json
from pathlib import Path

worldclock_bp = Blueprint("worldclock", __name__, url_prefix="/api/worldclock")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
LOC_FILE = DATA_DIR / "clock_locations.json"

if not LOC_FILE.exists():
    LOC_FILE.write_text("[]")

def load_locations():
    with open(LOC_FILE, "r") as f:
        return json.load(f)

def save_locations(locs):
    with open(LOC_FILE, "w") as f:
        json.dump(locs, f, indent=2)

@worldclock_bp.route("/locations", methods=["GET"])
def get_locations():
    home = {
        "lat": float(os.getenv("LATITUDE", 0)),
        "lon": float(os.getenv("LONGITUDE", 0)),
    }
    locs = load_locations()
    return jsonify({"status": "ok", "data": {"home": home, "places": locs}})

@worldclock_bp.route("/add", methods=["POST"])
def add_location():
    data = request.get_json() or {}
    lat = data.get("lat")
    lon = data.get("lon")
    if lat is None or lon is None:
        return jsonify({"status": "error", "error": "Missing lat/lon"}), 400
    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return jsonify({"status": "error", "error": "Invalid lat/lon"}), 400
    locs = load_locations()
    locs.append({"lat": lat, "lon": lon})
    save_locations(locs)
    return jsonify({"status": "ok"})
