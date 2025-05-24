import os
import time
import random
import logging
from flask import Blueprint, jsonify, request
from pyicloud import PyiCloudService
# Fallback to pyicloud-ipd fork if needed
try:
    from pyicloud_ipd import PyiCloudService as IPDService
except ImportError:
    IPDService = None
from pathlib import Path

icloud_bp = Blueprint("icloud", __name__, url_prefix="/api/icloud")

# Cache structure
_ICLOUD_CACHE = {}
_TTL = 300  # seconds

# Add global api instance and 2FA flag
_ICLOUD_API = None
_TRUSTED_DEVICES = []

# Development stub mode (bypass real iCloud)
DEV_MODE = os.getenv("ICLOUD_DEV_MODE", "false").lower() == "true"
if DEV_MODE:
    print("iCloud dev mode: stub enabled")

# Global stub override
DEV_STUB = False

# 2FA init endpoint
@icloud_bp.route("/init")
def init_icloud():
    global _ICLOUD_API, _TRUSTED_DEVICES, DEV_STUB
    if DEV_MODE:
        logging.info("iCloud dev mode: init stub")
        return jsonify({"status": "ok", "info": "dev_mode"})
    username = os.getenv("ICLOUD_USERNAME")
    password = os.getenv("ICLOUD_PASSWORD")
    # Ensure cookie directory for session persistence
    cookie_dir = Path(__file__).parent.parent / os.getenv("ICLOUD_COOKIE_DIR", "cookies")
    cookie_dir.mkdir(exist_ok=True)
    # Convert existing JSON cookie file to pickle CookieJar for pyicloud
    json_cookie = cookie_dir / "session-icloud.json"
    pickle_cookie = cookie_dir / "session-icloud.pkl"
    if json_cookie.exists() and not pickle_cookie.exists():
        try:
            import json, pickle
            from requests.utils import cookiejar_from_dict

            data = json.loads(json_cookie.read_text())
            jar = cookiejar_from_dict(data)
            with pickle_cookie.open("wb") as pf:
                pickle.dump(jar, pf)
            logging.info(f"Converted JSON cookie to pickle at {pickle_cookie}")
        except Exception:
            logging.exception("Error converting JSON cookie to pickle")
    # Try original library first
    try:
        _ICLOUD_API = PyiCloudService(username, password, cookie_directory=str(cookie_dir))
    except Exception as e:
        logging.error(f"Original pyicloud init failed: {e}")
        # If fork library available, try that
        if IPDService:
            try:
                logging.info("Trying pyicloud-ipd fallback for iCloud authentication")
                _ICLOUD_API = IPDService(username, password, cookie_directory=str(cookie_dir))
            except Exception:
                logging.exception("pyicloud-ipd fallback initialization failed")
                DEV_STUB = True
                return jsonify({"status": "dev_mode", "info": "stub_on_error"}), 200
        else:
            logging.exception("Error initializing PyiCloudService and no fallback available")
            DEV_STUB = True
            return jsonify({"status": "dev_mode", "info": "stub_on_error"}), 200
    logging.info(f"iCloud login: requires_2fa={getattr(_ICLOUD_API, 'requires_2fa', False)}, cookie_dir={cookie_dir}")

    # Optionally bypass 2FA if env flag set
    skip_2fa = os.getenv("ICLOUD_SKIP_2FA", "false").lower() == "true"
    if skip_2fa:
        logging.info("Bypassing iCloud 2FA due to ICLOUD_SKIP_2FA flag")
        return jsonify({"status": "ok", "info": "2fa_skipped"})

    if getattr(_ICLOUD_API, "requires_2fa", False):
        _TRUSTED_DEVICES = _ICLOUD_API.trusted_devices
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
    global _ICLOUD_API, DEV_STUB
    if DEV_MODE or DEV_STUB:
        # Generate stub events for the entire current month (6x7 grid)
        from datetime import datetime, timedelta

        today = datetime.now()
        # First day of the month
        first_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Find the Sunday before or on the 1st
        first_weekday = first_of_month.weekday()  # Monday=0, Sunday=6
        days_to_sunday = (first_of_month.weekday() + 1) % 7
        grid_start = first_of_month - timedelta(days=days_to_sunday)
        # 42 days for 6x7 grid
        days_in_grid = [grid_start + timedelta(days=i) for i in range(42)]

        # Use a nice palette of distinct hues
        calendar_names = ["Work", "Family", "Birthdays", "Personal", "School", "Sports"]
        palette = [
            "#1976d2",  # blue
            "#43a047",  # green
            "#fbc02d",  # yellow
            "#e64a19",  # orange
            "#8e24aa",  # purple
            "#00838f",  # teal
            "#c2185b",  # pink
            "#6d4c41",  # brown
        ]
        random.shuffle(palette)
        calendar_colors = {name: palette[i % len(palette)] for i, name in enumerate(calendar_names)}
        stub_events = []
        for day in days_in_grid:
            num_events = random.randint(2, 5)
            event_slots = []  # Track (start, end) for overlap
            for e in range(num_events):
                cal_idx = random.randint(0, len(calendar_names) - 1)
                cal_name = calendar_names[cal_idx]
                color = calendar_colors[cal_name]
                # 30% chance all-day event
                if random.random() < 0.3:
                    start_dt = day.replace(hour=0, minute=0, second=0, microsecond=0)
                    end_dt = start_dt + timedelta(days=1)
                else:
                    start_hour = random.randint(7, 17)
                    start_minute = random.choice([0, 15, 30, 45])
                    duration = random.choice([30, 45, 60, 90])
                    start_dt = day.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(hours=start_hour, minutes=start_minute)
                    end_dt = start_dt + timedelta(minutes=duration)
                    # Overlap: 1 in 2 events will overlap with a previous slot
                    if event_slots and random.random() < 0.5:
                        overlap_with = random.choice(event_slots)
                        overlap_start = overlap_with[0] + timedelta(minutes=random.choice([10, 20, 30]))
                        overlap_end = overlap_start + timedelta(minutes=random.choice([30, 45, 60]))
                        start_dt, end_dt = overlap_start, overlap_end
                event_slots.append((start_dt, end_dt))
                attendees_list = []
                if random.random() < 0.7:
                    num_attendees = random.randint(1, 4)
                    possible_attendees = [
                        {"name": "Alice Wonderland", "email": "alice@example.com"},
                        {"name": "Bob The Builder", "email": "bob@example.com"},
                        {"name": "Charlie Brown", "email": "charlie@example.com"},
                        {"name": "Diana Prince", "email": "diana@example.com"},
                        {"name": "Edward Scissorhands", "email": "edward@example.com"},
                    ]
                    statuses = ["accepted", "declined", "tentative", "no-reply"]
                    selected_attendees = random.sample(possible_attendees, min(num_attendees, len(possible_attendees)))
                    for att in selected_attendees:
                        attendees_list.append(
                            {"name": att["name"], "email": att["email"], "status": random.choice(statuses)}
                        )
                stub_events.append(
                    {
                        "uid": f"stub-event-{day.strftime('%Y%m%d')}-{e}-{random.randint(1000, 9999)}",
                        "title": f"{cal_name} Event {day.day}-{e + 1}",
                        "start": start_dt.isoformat(),
                        "end": end_dt.isoformat(),
                        "calendar": cal_name,
                        "color": color,
                        "creator": random.choice(["John Doe", "Jane Smith", "System Generated"]),
                        "notes": random.choice([
                            "Remember to bring the presentation.",
                            "Discuss Q3 budget.",
                            "Pick up dry cleaning on the way.",
                            "",
                            "This is a longer note that might contain multiple sentences. It's important to test how multi-line notes are displayed in the UI. Ensure that the layout handles this gracefully without breaking.",
                        ]),
                        "location": random.choice([
                            "Conference Room A",
                            "Online Meeting",
                            "Client's Office",
                            "",
                            "123 Main St, Anytown"
                        ]),
                        "attendees": attendees_list,
                    }
                )
        stub_data = {
            "user": os.getenv("ICLOUD_USERNAME", "dev_user"),
            "calendars": [{"name": name, "color": calendar_colors[name]} for name in calendar_names],
            "events": stub_events,
            "today": [
                {
                    "title": "Book flight to Bali",
                    "dueDate": (today + timedelta(days=1)).date().isoformat(),
                    "priority": "high",
                    "done": False,
                },
                {
                    "title": "Call Mom for her birthday",
                    "dueDate": (today + timedelta(days=2)).date().isoformat(),
                    "priority": "medium",
                    "done": False,
                },
                {
                    "title": "Buy groceries for the week",
                    "dueDate": (today).date().isoformat(),
                    "priority": "high",
                    "done": False,
                },
                {
                    "title": "Finish project proposal",
                    "dueDate": (today + timedelta(days=3)).date().isoformat(),
                    "priority": "high",
                    "done": False,
                },
                {
                    "title": "Schedule dentist appointment",
                    "dueDate": (today + timedelta(days=5)).date().isoformat(),
                    "priority": "low",
                    "done": True,
                },
                {
                    "title": "Pay credit card bill",
                    "dueDate": (today - timedelta(days=1)).date().isoformat(),
                    "priority": "medium",
                    "done": True,
                },
            ],
            "tasks": [
                {"title": "Paint garage", "note": "Buy primer", "done": False},
                {"title": "Organize attic", "note": "", "done": False},
                {"title": "Fix bike tire", "note": "", "done": True},
            ],
            "shopping": [
                {"item": "Milk", "quantity": "2 gallons", "done": False},
                {"item": "Eggs", "quantity": "1 dozen", "done": False},
                {"item": "Coffee", "quantity": "1 bag", "done": True},
            ],
            "chores": [
                {"title": "Unload dishwasher", "done": False},
                {"title": "Feed the cat", "done": False},
                {"title": "Make beds", "done": False},
                {"title": "Sweep kitchen", "done": False},
                {"title": "Laundry", "done": True},
            ],
            "photo": None,
        }
        return jsonify({"status": "ok", "data": stub_data})
    # If not initialized or 2FA pending
    if _ICLOUD_API is None or getattr(_ICLOUD_API, "requires_2fa", False):
        return jsonify({"status": "2fa_required"})
    # Stub when credentials not provided
    if not os.getenv("ICLOUD_USERNAME") or not os.getenv("ICLOUD_PASSWORD"):
        return jsonify({
            "status": "ok",
            "data": {
                "events": [],
                "today": [],
                "tasks": [],
                "shopping": [],
                "chores": [],
                "photo": None,
            },
        })

    now = time.time()
    try:
        if "timestamp" not in _ICLOUD_CACHE or now - _ICLOUD_CACHE["timestamp"] > _TTL:
            # Fetch events
            events = []
            for event in _ICLOUD_API.calendar.events():
                events.append(
                    {"title": event.get("title"), "start": event.get("startDate"), "end": event.get("endDate")}
                )
            # Fetch reminders for "Today" list
            reminders = []
            for reminder in _ICLOUD_API.reminders.get():
                reminders.append({
                    "title": reminder.get("title"),
                    "dueDate": reminder.get("dueDate"),
                    "priority": reminder.get("priority"),
                    "done": reminder.get("completed", False),
                })
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
                        "today": reminders,
                        "tasks": [],
                        "shopping": [],
                        "chores": [],
                        "photo": photo_url,
                    },
                }
            )
        data = _ICLOUD_CACHE["data"]
    except Exception:
        logging.exception("Error fetching iCloud data")
        data = {
            "events": [],
            "today": [],
            "tasks": [],
            "shopping": [],
            "chores": [],
            "photo": None,
        }
    return jsonify({"status": "ok", "data": data})
