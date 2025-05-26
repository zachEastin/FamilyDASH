from pathlib import Path
import logging
from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from dotenv import load_dotenv

# Local blueprints and fetch functions
from modules.icloud_module import icloud_bp, get_icloud_data
from modules.weather_module import weather_bp, get_weather
from modules.time_module import time_bp, get_time
from modules.network_module import network_bp, get_network
from modules.lighting_module import lighting_bp, get_lighting
from modules.sun_module import sun_bp, get_sun
from modules.meals_module import meals_bp, recipes_bp, mealslot_bp
from modules.worldclock_module import worldclock_bp

import os

# Load environment variables
load_dotenv()

print("iCloud username:", os.getenv("ICLOUD_USERNAME"))
print("iCloud password:", os.getenv("ICLOUD_PASSWORD"))

# Setup logging directory
LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)
ERROR_LOG = LOGS_DIR / "error.log"

logging.basicConfig(filename=str(ERROR_LOG), level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

# Initialize Flask and SocketIO
app = Flask(__name__, static_folder="static")
# Disable caching of static files
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
app.config["TEMPLATES_AUTO_RELOAD"] = True
socketio = SocketIO(app)

# Register data source blueprints
app.register_blueprint(icloud_bp)
app.register_blueprint(weather_bp)
app.register_blueprint(time_bp)
app.register_blueprint(network_bp)
app.register_blueprint(lighting_bp)
app.register_blueprint(sun_bp)
app.register_blueprint(meals_bp)
app.register_blueprint(recipes_bp)
app.register_blueprint(mealslot_bp)
app.register_blueprint(worldclock_bp)


# Background task to poll data sources and emit updates
def start_background_tasks():
    def fetch_event(event_name, func, interval):
        prev = None
        while True:
            # Execute within Flask application context for jsonify
            with app.app_context():
                resp = func()
            try:
                data = resp.get_json()["data"]
            except Exception:
                data = None
            if data != prev:
                socketio.emit(event_name, data)
                prev = data
            socketio.sleep(interval)

    # start tasks
    socketio.start_background_task(fetch_event, "weather_update", get_weather, 600)
    socketio.start_background_task(fetch_event, "time_update", get_time, 1)
    socketio.start_background_task(fetch_event, "network_update", get_network, 10)
    socketio.start_background_task(fetch_event, "lighting_update", get_lighting, 1)
    socketio.start_background_task(fetch_event, "sun_update", get_sun, 60)
    socketio.start_background_task(fetch_event, "icloud_update", get_icloud_data, 300)


# Serve dashboard
@app.route("/")
def index():
    return app.send_static_file("index.html")


# Manual reload endpoint
@app.route("/reload")
def reload_data():
    # restrict to local network
    if request.remote_addr not in ("127.0.0.1", "::1"):
        return "", 403
    from modules.weather_module import _WEATHER_CACHE
    from modules.icloud_module import _ICLOUD_CACHE

    _WEATHER_CACHE.clear()
    _ICLOUD_CACHE.clear()
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    # start polling background tasks before running
    start_background_tasks()
    print(f"Server running on http://localhost:8080/")
    socketio.run(app, host="0.0.0.0", port=8080)
