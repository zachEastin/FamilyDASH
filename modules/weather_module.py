from flask import Blueprint, jsonify, current_app
import requests
import time
import os

weather_bp = Blueprint("weather", __name__, url_prefix="/api/weather")

# Cache structure
_WEATHER_CACHE = {}
_TTL = 600  # seconds


@weather_bp.route("/data")
def get_weather():
    now = time.time()
    if "timestamp" not in _WEATHER_CACHE or now - _WEATHER_CACHE["timestamp"] > _TTL:
        api_key = os.getenv("OPENWEATHER_API_KEY")
        lat = os.getenv("LATITUDE")
        lon = os.getenv("LONGITUDE")
        resp = requests.get(
            f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        )
        data = resp.json()
        _WEATHER_CACHE.update(
            {
                "timestamp": now,
                "data": {
                    "temp": data["main"]["temp"],
                    "icon": data["weather"][0]["icon"],
                    "low": data["main"]["temp_min"],
                    "high": data["main"]["temp_max"],
                },
            }
        )
    return jsonify({"status": "ok", "data": _WEATHER_CACHE["data"]})
