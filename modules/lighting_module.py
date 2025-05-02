from flask import Blueprint, jsonify
import logging
import sys

_IS_LINUX = sys.platform.startswith("linux")
# Attempt Pi sensor imports when on Linux
if _IS_LINUX:
    try:
        import board, busio, adafruit_tsl2561
    except ImportError:
        _IS_LINUX = False

lighting_bp = Blueprint("lighting", __name__, url_prefix="/api/lighting")


@lighting_bp.route("/data")
def get_lighting():
    if not _IS_LINUX:
        # Stub ambient light on non-Linux for cross-platform development
        return jsonify({"status": "ok", "data": {"ambient_light": None}})
    try:
        # Initialize I2C and sensor
        i2c = busio.I2C(board.SCL, board.SDA)
        sensor = adafruit_tsl2561.TSL2561(i2c)
        light = sensor.lux
        # Compute brightness and write backlight if on Linux
        if light is not None:
            brightness = int(max(0, min(light / 1000, 1)) * 255)
            from pathlib import Path

            backlight_path = Path("/sys/class/backlight/rpi_backlight/brightness")
            backlight_path.write_text(str(brightness))
    except Exception:
        logging.exception("Error reading ambient light sensor")
        light = None
    return jsonify({"status": "ok", "data": {"ambient_light": light}})
