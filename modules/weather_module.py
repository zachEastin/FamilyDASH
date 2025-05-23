from flask import Blueprint, jsonify, current_app
import requests
import time
import os

weather_bp = Blueprint("weather", __name__, url_prefix="/api/weather")

# Cache structure
_WEATHER_CACHE = {}
_TTL = 600  # seconds


def fetch_and_cache_weather():
    """
    Fetches weather, air quality, and pollen data, and caches them.
    """
    api_key = os.getenv("OPENWEATHER_API_KEY")
    lat = os.getenv("LATITUDE")
    lon = os.getenv("LONGITUDE")
    # One Call 3.0: get current, hourly, daily in one call
    resp = requests.get(
        f"https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&appid={api_key}&units=metric"
    )
    data = resp.json()
    now = time.time()
    _WEATHER_CACHE["onecall"] = data
    _WEATHER_CACHE["onecall_timestamp"] = now
    # Air quality (if available)
    try:
        aq_resp = requests.get(
            f"https://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={api_key}"
        )
        aq_data = aq_resp.json()
        _WEATHER_CACHE["air_quality"] = (
            aq_data.get("list", [{}])[0].get("main", {}).get("aqi")
        )
    except Exception:
        _WEATHER_CACHE["air_quality"] = None
    # Allergen index (OpenWeather pollen API, if available)
    try:
        pollen_resp = requests.get(
            f"https://api.openweathermap.org/data/2.5/air_pollution/pollen?lat={lat}&lon={lon}&appid={api_key}"
        )
        pollen_data = pollen_resp.json()
        _WEATHER_CACHE["allergen_index"] = (
            pollen_data.get("list", [{}])[0].get("main", {}).get("aqi")
        )
    except Exception:
        _WEATHER_CACHE["allergen_index"] = None
    # Precipitation (if available)
    try:
        precip_resp = requests.get(
            f"https://api.openweathermap.org/data/2.5/onecall?lat={lat}&lon={lon}&appid={api_key}&exclude=hourly,daily"
        )
        precip_data = precip_resp.json()
        _WEATHER_CACHE["precipitation"] = precip_data.get("current", {}).get(
            "precipitation", 0
        )
    except Exception:
        _WEATHER_CACHE["precipitation"] = None


def c_to_f(c):
    return c * 9.0 / 5.0 + 32 if c is not None else None


@weather_bp.route("/data")
def get_weather():
    now = time.time()
    if (
        "onecall" not in _WEATHER_CACHE
        or now - _WEATHER_CACHE.get("onecall_timestamp", 0) > _TTL
    ):
        fetch_and_cache_weather()
    data = _WEATHER_CACHE["onecall"]
    current = data.get("current", {})
    weather = current.get("weather", [{}])[0]
    moon_phase = (
        data.get("daily", [{}])[0].get("moon_phase") if data.get("daily") else None
    )
    _WEATHER_CACHE["data"] = {
        "temp": c_to_f(current.get("temp")),
        "icon": weather.get("icon"),
        "description": weather.get("description"),
        "low": c_to_f(data.get("daily", [{}])[0].get("temp", {}).get("min"))
        if data.get("daily")
        else None,
        "high": c_to_f(data.get("daily", [{}])[0].get("temp", {}).get("max"))
        if data.get("daily")
        else None,
        "humidity": current.get("humidity"),
        "wind_speed": current.get("wind_speed"),
        "wind_deg": current.get("wind_deg"),
        "uvi": current.get("uvi"),
        "sunrise": current.get("sunrise"),
        "sunset": current.get("sunset"),
        "air_quality": _WEATHER_CACHE.get("air_quality"),
        "allergen_index": _WEATHER_CACHE.get("allergen_index"),
        "moon_phase": moon_phase,
        "pressure": current.get("pressure"),
        "clouds": current.get("clouds"),
        "feels_like": c_to_f(current.get("feels_like")),
        "dew_point": c_to_f(current.get("dew_point")),
    }
    return jsonify({"status": "ok", "data": _WEATHER_CACHE["data"]})


@weather_bp.route("/forecast")
def get_forecast():
    """
    Returns hourly (next 24h) and daily (next 5d) forecast for modal overlay.
    """
    now = time.time()
    if (
        "onecall" not in _WEATHER_CACHE
        or now - _WEATHER_CACHE.get("onecall_timestamp", 0) > _TTL
    ):
        fetch_and_cache_weather()
    data = _WEATHER_CACHE["onecall"]
    # Hourly: next 24h
    hourly = []
    for h in data.get("hourly", [])[:24]:
        hourly.append(
            {
                "dt": h["dt"],
                "temp": c_to_f(h["temp"]),
                "icon": h["weather"][0]["icon"],
                "description": h["weather"][0]["description"],
                "pop": h.get("pop"),
            }
        )
    # Daily
    daily = []
    for d in data.get("daily", []):
        d["temp"]["day"] = c_to_f(d["temp"]["day"])
        d["temp"]["night"] = c_to_f(d["temp"]["night"])
        d["temp"]["eve"] = c_to_f(d["temp"]["eve"])
        d["temp"]["morn"] = c_to_f(d["temp"]["morn"])
        d["temp"]["min"] = c_to_f(d["temp"]["min"])
        d["temp"]["max"] = c_to_f(d["temp"]["max"])

        d["feels_like"]["day"] = c_to_f(d["feels_like"]["day"])
        d["feels_like"]["night"] = c_to_f(d["feels_like"]["night"])
        d["feels_like"]["eve"] = c_to_f(d["feels_like"]["eve"])
        d["feels_like"]["morn"] = c_to_f(d["feels_like"]["morn"])
        d["dew_point"] = c_to_f(d["dew_point"])
        daily.append(
            {
                "dt": d["dt"],
                "temp_high": d["temp"]["max"],
                "temp_low": d["temp"]["min"],
                "icon": d["weather"][0]["icon"],
                "description": d["weather"][0]["description"],
                "full_data": d,
            }
        )
    forecast = {
        "hourly": hourly,
        "daily": daily,
        "location": data.get("timezone", "Unknown"),
    }
    _WEATHER_CACHE["forecast"] = forecast
    _WEATHER_CACHE["forecast_timestamp"] = now
    return jsonify({"status": "ok", "data": forecast})
