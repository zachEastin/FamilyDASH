from flask import Blueprint, jsonify
from datetime import datetime

time_bp = Blueprint("time", __name__, url_prefix="/api/time")


@time_bp.route("/data")
def get_time():
    now_dt = datetime.now()
    time_str = now_dt.strftime("%H:%M:%S")
    date_str = now_dt.strftime("%Y-%m-%d")
    return jsonify({"status": "ok", "data": {"date": date_str, "time": time_str}})
