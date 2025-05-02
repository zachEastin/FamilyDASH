# export_cookies.py
from http.cookiejar import MozillaCookieJar
from requests.utils import cookiejar_from_dict
import pickle
from pathlib import Path
import sys

# Path to cookies directory and expected Netscape-format file
cookie_dir = Path(__file__).parent / "cookies"
cookie_file = cookie_dir / "cookies.txt"

if not cookie_file.exists():
    print("Error: please export your iCloud.com cookies in Netscape format to", cookie_file)
    print("Use a browser plugin (e.g. EditThisCookie) to export and save as cookies.txt")
    sys.exit(1)

# Load Netscape-format cookies
jar = MozillaCookieJar(cookie_file)
jar.load(ignore_discard=True, ignore_expires=True)

# Convert to dict and back to a picklable CookieJar
cookie_dict = {c.name: c.value for c in jar}
picklable_jar = cookiejar_from_dict(cookie_dict)

# Pickle the CookieJar for pyicloud
pickle_file = cookie_dir / "session-icloud.pkl"
with pickle_file.open("wb") as f:
    pickle.dump(picklable_jar, f)

print(f"🎉 Pickled cookies saved to {pickle_file}")
