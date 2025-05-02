from pyicloud import PyiCloudService
from dotenv import load_dotenv
import os

load_dotenv()
api = PyiCloudService(os.getenv("ICLOUD_USERNAME"), os.getenv("ICLOUD_PASSWORD"))
print(f"iCloud username: {os.getenv('ICLOUD_USERNAME')}")
print(f"iCloud password: {os.getenv('ICLOUD_PASSWORD')}")
print("iCloud API initialized:", api)
print("Requires 2FA?", getattr(api, "requires_2fa", False))
