# FamilyVista Dashboard

FamilyVista (aka FamilyDASH) is a passive, glance-only smart family dashboard optimized for Raspberry Pi with an LCD panel. It aggregates calendars, reminders, weather, ambient light and more in real-time.

## Features
- Family calendar view and reminders (iCloud)
- Weather widget (OpenWeatherMap)
- Digital clock
- Network status indicator
- Day/night theme (Astral sunrise/sunset)
- Automatic brightness control via ambient light sensor
- Real-time updates via SocketIO
- Manual `/reload` endpoint for forced refresh

## Prerequisites
- Raspberry Pi running Linux (tested on Raspbian)
- Python 3.8+
- Pip and virtualenv
- LCD panel with backlight support
- Ambient light sensor (e.g. TSL2561)

## Setup
1. Clone repo and enter directory:
   ```bash
   git clone <repo-url> FamilyDASH
   cd FamilyDASH
   ```
2. Create and activate virtual environment:
   ```bash
   # On Linux/macOS
   python3 -m venv venv
   source venv/bin/activate
   # On Windows
   python -m venv venv
   venv\Scripts\activate
   ```
3. Install Python dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the project root with the following variables:
   ```dotenv
   ICLOUD_USERNAME=your_icloud_username
   ICLOUD_PASSWORD=your_icloud_password
   ICLOUD_SHARED_ALBUM=YourSharedAlbumName
   OPENWEATHER_API_KEY=your_openweather_key
   LATITUDE=xx.xxxxxx
   LONGITUDE=yy.yyyyyy
   ICLOUD_SKIP_2FA=false
   ICLOUD_DEV_MODE=false
   ```

## Cross-platform Note
- Ambient light sensor and backlight control are stubbed on non-Linux platforms; `ambient_light` will return null on Windows.

## Running Locally
```bash
source venv/bin/activate
python app.py
``` 
Visit `http://<pi-ip>:8080` to view the dashboard.

## Running Locally on Windows
```powershell
# 1. Activate your venv
venv\Scripts\activate

# 2. Install or upgrade dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 3. Ensure you have a .env file at project root

# 4. Launch the app
python app.py
```
Visit `http://localhost:8080` to view the dashboard.

## Apple 2FA
If you have 2FA enabled on your iCloud account, you will need to generate an app-specific password. Follow these steps:
1. Go to your Apple ID account page.
2. Sign in and select "Generate Password" under the Security section.
3. Enter a label for the password (e.g., "FamilyDASH") and click "Create".
4. Copy the generated password and use it as your `ICLOUD_PASSWORD` in the `.env` file.

## iCloud Development Stub Mode
To bypass authentication and return dummy iCloud data for local debugging, set the following in your `.env`:
```dotenv
ICLOUD_DEV_MODE=true
```
This will return stubbed user, calendars, events, and reminders without requiring Apple credentials or 2FA.

## Systemd Service
A `familydash.service` file is provided; copy it to `/etc/systemd/system/`, then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable familydash
sudo systemctl start familydash
``` 

## Future Extensions
- Touch input handlers (stubbed in `main.js`)
- Additional widget modules under `modules/`
- Supervisor config alternate to systemd

---
This README will be updated as new features are added.