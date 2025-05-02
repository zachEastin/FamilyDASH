from flask import Blueprint, jsonify
from datetime import datetime

time_bp = Blueprint("time", __name__, url_prefix="/api/time")


@time_bp.route("/data")
def get_time():
    now = datetime.now().strftime("%H:%M:%S")
    return jsonify({"status": "ok", "data": {"time": now}})
