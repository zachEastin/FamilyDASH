from flask import Blueprint, jsonify
from astral import LocationInfo
from astral.sun import sun
from datetime import date
import os

sun_bp = Blueprint("sun", __name__, url_prefix="/api/sun")


@sun_bp.route("/data")
def get_sun():
    lat = float(os.getenv("LATITUDE", 0))
    lon = float(os.getenv("LONGITUDE", 0))
    loc = LocationInfo(latitude=lat, longitude=lon)
    s = sun(loc.observer, date=date.today())
    return jsonify({"status": "ok", "data": {"sunrise": s["sunrise"].isoformat(), "sunset": s["sunset"].isoformat()}})
