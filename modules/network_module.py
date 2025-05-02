from flask import Blueprint, jsonify
import requests

network_bp = Blueprint("network", __name__, url_prefix="/api/network")


@network_bp.route("/data")
def get_network():
    try:
        requests.get("https://www.google.com", timeout=3)
        status = "online"
    except requests.RequestException:
        status = "offline"
    return jsonify({"status": "ok", "data": {"network": status}})
