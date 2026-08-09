"""
Platform-wide configuration management.

All platform settings (branding, scraping/email batch sizes and delays,
automation toggles) are persisted in MongoDB in the `app_settings` collection
instead of being hard-coded in the source code. This lets operators tune the
entire platform from the UI without modifying code.
"""

from datetime import datetime

from ..core.database import get_mongo_db

_SETTINGS_ID = "platform"

DEFAULT_SETTINGS = {
    # --- Organization / Branding used by email templates ---
    "org_name": "Incubein Foundation",
    "org_full_name": "Incubein Foundation – RTMNU Business Incubation Centre",
    "org_email": "teamincubein@gmail.com",
    "org_website": "www.incubein.com",
    "org_address": "Nagpur, Maharashtra",
    "signature_text": "",
    # --- Scraping / enrichment batching ---
    "scrape_batch_size": 8,
    "scrape_batch_delay_seconds": 15,
    # --- Email dispatch batching ---
    "email_batch_size": 8,
    "email_batch_delay_seconds": 20,
    # --- Automation toggles & intervals ---
    "sync_interval": 30,
    "followup_delay": 120,
    "scanning_paused": True,
    "followups_paused": True,
    # --- Default templates used when no explicit template is chosen ---
    "default_template_startup": "startup_meeting",
    "default_template_incubator": "incubator_meeting",
    "default_template_startup_followup": "startup_followup_confirm",
    "default_template_incubator_followup": "incubator_followup_confirm",
}


def _collection():
    return get_mongo_db()["app_settings"]


def get_settings() -> dict:
    doc = _collection().find_one({"_id": _SETTINGS_ID})
    if not doc:
        return dict(DEFAULT_SETTINGS)
    merged = dict(DEFAULT_SETTINGS)
    merged.update({k: v for k, v in doc.items() if k != "_id"})
    return merged


def get_setting(key: str, default=None):
    return get_settings().get(key, default)


def update_settings(patch: dict) -> dict:
    settings = get_settings()
    cleaned = {}
    for key, value in patch.items():
        if value is None:
            continue
        if key in DEFAULT_SETTINGS:
            cleaned[key] = value
    if not cleaned:
        return settings

    cleaned["updated_at"] = datetime.now().isoformat()
    _collection().update_one(
        {"_id": _SETTINGS_ID},
        {"$set": cleaned, "$setOnInsert": {"created_at": datetime.now().isoformat()}},
        upsert=True,
    )
    return get_settings()


def reset_settings() -> dict:
    _collection().delete_one({"_id": _SETTINGS_ID})
    return get_settings()
