import os
import time
import random
import logging
from flask import Blueprint, jsonify, request
from pyicloud import PyiCloudService

icloud_bp = Blueprint("icloud", __name__, url_prefix="/api/icloud")

# Cache structure
_ICLOUD_CACHE = {}
_TTL = 300  # seconds

# Add global api instance and 2FA flag
_ICLOUD_API = None
_TRUSTED_DEVICES = []


# 2FA init endpoint
@icloud_bp.route("/init")
def init_icloud():
    global _ICLOUD_API, _TRUSTED_DEVICES
    username = os.getenv("ICLOUD_USERNAME")
    password = os.getenv("ICLOUD_PASSWORD")
    _ICLOUD_API = PyiCloudService(username, password)
    if getattr(_ICLOUD_API, "requires_2fa", False):
        _TRUSTED_DEVICES = _ICLOUD_API.trusted_devices
        # send code to first device
        _ICLOUD_API.send_verification_code(_TRUSTED_DEVICES[0]["id"])
        return jsonify({"status": "2fa_required", "devices": _TRUSTED_DEVICES})
    return jsonify({"status": "ok"})


# 2FA verify endpoint
@icloud_bp.route("/verify", methods=["POST"])
def verify_icloud():
    global _ICLOUD_API
    code = request.json.get("code")
    try:
        _ICLOUD_API.validate_verification_code(code)
        return jsonify({"status": "ok"})
    except Exception:
        return jsonify({"status": "invalid_code"}), 401


@icloud_bp.route("/data")
def get_icloud_data():
    global _ICLOUD_API
    # If not initialized or 2FA pending
    if _ICLOUD_API is None or getattr(_ICLOUD_API, "requires_2fa", False):
        return jsonify({"status": "2fa_required"})
    # Stub when credentials not provided
    if not os.getenv("ICLOUD_USERNAME") or not os.getenv("ICLOUD_PASSWORD"):
        return jsonify({"status": "ok", "data": {"events": [], "reminders": [], "photo": None}})

    now = time.time()
    try:
        if "timestamp" not in _ICLOUD_CACHE or now - _ICLOUD_CACHE["timestamp"] > _TTL:
            # Fetch events
            events = []
            for event in _ICLOUD_API.calendar.events():
                events.append(
                    {"title": event.get("title"), "start": event.get("startDate"), "end": event.get("endDate")}
                )
            # Fetch reminders
            reminders = []
            for reminder in _ICLOUD_API.reminders.get():
                reminders.append({"title": reminder.get("title"), "due": reminder.get("dueDate")})
            # Fetch photos from shared album
            photo_url = None
            album_name = os.getenv("ICLOUD_SHARED_ALBUM")
            if album_name:
                # find album
                albums = _ICLOUD_API.photos.albums
                album = next((a for a in albums if a.get("title") == album_name), None)
                if album:
                    photos = _ICLOUD_API.photos.get_shared_album(album.get("dsid"))
                    urls = [p.get("downloadUrl") for p in photos]
                    if urls:
                        photo_url = random.choice(urls)
            _ICLOUD_CACHE.update(
                {"timestamp": now, "data": {"events": events, "reminders": reminders, "photo": photo_url}}
            )
        data = _ICLOUD_CACHE["data"]
    except Exception:
        logging.exception("Error fetching iCloud data")
        data = {"events": [], "reminders": [], "photo": None}
    return jsonify({"status": "ok", "data": data})
