import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Resolve base directory — works both in dev and when bundled as .exe (PyInstaller)
if getattr(sys, 'frozen', False):
    # Running as compiled exe — static files are bundled at _MEIPASS/app/static
    BASE_DIR = Path(sys._MEIPASS) / "app"
    APP_DATA_DIR = Path(sys.executable).parent
else:
    # Dev mode — this file lives at backend/app/core/config.py
    BASE_DIR = Path(__file__).resolve().parent.parent
    APP_DATA_DIR = BASE_DIR.parent

print(f"[InCubein] BASE_DIR={BASE_DIR}", flush=True)
print(f"[InCubein] APP_DATA_DIR={APP_DATA_DIR}", flush=True)

# Load .env from app data dir (next to .exe) or from backend folder in dev
env_path = APP_DATA_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

# Shared runtime paths
SCRATCH_DIR = APP_DATA_DIR / "scratch"
ATTACHMENTS_DIR = APP_DATA_DIR / "attachments"
TOKEN_PATH = Path(os.environ.get("TOKEN_PATH", BASE_DIR / "token.json"))
STATIC_DIR = BASE_DIR / "static"

# Redis / cache
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Outreach automation shared runtime state
IMAP_SYNC_INTERVAL = 30  # background IMAP check interval in seconds. 0 or negative means manual only.
FOLLOWUP_DELAY = 120
SCANNING_PAUSED = True  # background IMAP/reply scanning paused by default
FOLLOWUPS_PAUSED = True  # follow-up dispatch paused by default

oauth_states = {}
