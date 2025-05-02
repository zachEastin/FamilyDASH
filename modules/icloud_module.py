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
            # Determine signed-in user and calendar names
            user = getattr(_ICLOUD_API, "username", None)
            calendars = []
            try:
                for cal in _ICLOUD_API.calendar.calendars():
                    logging.info(f"iCloud calendar object: {cal}")
                    name = cal.get("Title") or cal.get("title") or cal.get("name")
                    if not name:
                        name = str(cal)
                    calendars.append(name)
            except Exception as e:
                logging.exception("Error extracting calendar names")
            # Update cache with new fields
            _ICLOUD_CACHE.update(
                {
                    "timestamp": now,
                    "data": {
                        "user": user,
                        "calendars": calendars,
                        "events": events,
                        "reminders": reminders,
                        "photo": photo_url,
                    },
                }
            )
        data = _ICLOUD_CACHE["data"]
    except Exception:
        logging.exception("Error fetching iCloud data")
        data = {"events": [], "reminders": [], "photo": None}
    return jsonify({"status": "ok", "data": data})
