from flask import Blueprint, jsonify
from datetime import datetime

time_bp = Blueprint("time", __name__, url_prefix="/api/time")


@time_bp.route("/data")
def get_time():
    now_dt = datetime.now()
    hour_24 = now_dt.hour
    minute = now_dt.minute
    second = now_dt.second
    hour_12 = hour_24 % 12 or 12
    ampm = "AM" if hour_24 < 12 else "PM"
    time_12 = f"{hour_12:02}:{minute:02}"
    date_str = now_dt.strftime("%Y-%m-%d")
    return jsonify(
        {
            "status": "ok",
            "data": {
                "date": date_str,
                "time": time_12,
                "hour": hour_12,
                "minute": minute,
                "second": second,
                "ampm": ampm,
            },
        }
    )
