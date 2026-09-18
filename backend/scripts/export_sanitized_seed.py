"""Export a privacy-safe MongoDB snapshot for the local Docker demo.

The exporter preserves collection/document counts, MongoDB identifiers,
cross-collection references, dates, statuses, classifications, geography,
scores, and numeric values. It replaces personal/contact content and removes
credentials, raw application fields, message bodies, and free-form logs.
"""

import argparse
import copy
import gzip
import hashlib
import os
import re
from pathlib import Path

from bson.json_util import dumps
from dotenv import load_dotenv
from pymongo import MongoClient


COLLECTIONS = (
    "app_settings",
    "crm_action_plans",
    "crm_actions",
    "crm_activity",
    "crm_audits",
    "crm_colleges",
    "crm_counters",
    "crm_customers",
    "crm_deals",
    "crm_financials",
    "crm_founders",
    "crm_funding",
    "crm_milestones",
    "crm_risks",
    "crm_startups",
    "crm_students",
    "email_logs",
    "email_templates",
    "incubators",
    "incubein_applications",
    "investors",
    "mentors",
    "outreach_activity",
    "outreach_config",
    "outreach_leads",
    "pipeline_logs",
    "relationships",
    "roles",
    "scheduled_meetings",
    "startups",
    "users",
)

SECRET_PARTS = (
    "password",
    "secret",
    "token",
    "credential",
    "api_key",
    "apikey",
    "smtp_pass",
    "imap_pass",
)
PHONE_KEYS = {
    "phone",
    "mobile",
    "alternate_mobile",
    "alternet_mobile",
    "principal_contact",
    "coordinator_contact",
}
PRIVATE_TEXT_KEYS = {
    "address",
    "notes",
    "reply_text",
    "meeting_link",
    "linkedin",
    "twitter",
}
EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)


def _alias(kind: str, index: int) -> str:
    return f"{kind.replace('_', ' ').title()} {index:04d}"


def _safe_email(kind: str, index: int) -> str:
    return f"{kind}-{index:04d}@example.invalid"


def _scrub_nested(value, key: str, kind: str, index: int):
    lower = key.lower()
    if any(part in lower for part in SECRET_PARTS):
        return None
    if "email" in lower:
        return [] if isinstance(value, list) else _safe_email(kind, index)
    if lower in PHONE_KEYS or "mobile" in lower:
        return ""
    if lower in PRIVATE_TEXT_KEYS:
        return ""
    if isinstance(value, dict):
        return {
            child_key: _scrub_nested(child_value, child_key, kind, index)
            for child_key, child_value in value.items()
            if not any(part in child_key.lower() for part in SECRET_PARTS)
        }
    if isinstance(value, list):
        return [_scrub_nested(item, key, kind, index) for item in value]
    if isinstance(value, str):
        return EMAIL_PATTERN.sub(_safe_email(kind, index), value)
    return value


def _sanitize_founders(founders, index: int):
    if isinstance(founders, str):
        return _alias("founder", index) if founders.strip() else ""
    if isinstance(founders, list):
        result = []
        for offset, founder in enumerate(founders, start=1):
            alias = _alias("founder", index * 10 + offset)
            if isinstance(founder, dict):
                safe = dict(founder)
                for key in ("name", "founder_name", "full_name"):
                    if key in safe:
                        safe[key] = alias
                safe = _scrub_nested(safe, "founder", "founder", index * 10 + offset)
                result.append(safe)
            else:
                result.append(alias)
        return result
    return founders


def sanitize_document(collection: str, document: dict, index: int) -> dict:
    doc = copy.deepcopy(document)

    if collection == "incubators":
        doc["founder_or_head"] = _alias("incubator contact", index)
    elif collection == "startups":
        doc["founders"] = _sanitize_founders(doc.get("founders"), index)
    elif collection == "mentors":
        doc["name"] = _alias("mentor", index)
    elif collection == "crm_founders":
        doc["name"] = _alias("founder", index)
        doc["remarks"] = ""
    elif collection == "crm_students":
        doc["student_name"] = _alias("student", index)
        doc["mentor"] = "Assigned Mentor" if doc.get("mentor") else ""
        doc["remarks"] = ""
    elif collection == "crm_colleges":
        doc["principal"] = _alias("principal", index) if doc.get("principal") else ""
        doc["coordinator"] = _alias("coordinator", index) if doc.get("coordinator") else ""
        doc["remarks"] = ""
    elif collection == "crm_startups":
        doc["remarks"] = ""
    elif collection == "incubein_applications":
        applicant = _alias("applicant", index)
        doc["name"] = applicant
        doc["comments"] = ""
        doc["raw_data"] = {}
        doc["encrypted_fields"] = {
            "name": applicant,
            "email": _safe_email("applicant", index),
            "mobile": "",
            "alternet_mobile": "",
            "dob": "",
            "address": "",
        }
    elif collection == "outreach_leads":
        doc["reply_text"] = ""
        doc["notes"] = ""
        doc["meeting_link"] = ""
    elif collection == "email_logs":
        doc["recipient_name"] = _alias("recipient", index)
        doc["recipient_email"] = _safe_email("recipient", index)
        doc["subject"] = "Sanitized email event"
        doc["details"] = {}
    elif collection == "email_templates":
        doc["cc"] = [] if isinstance(doc.get("cc"), list) else ""
        doc["bcc"] = [] if isinstance(doc.get("bcc"), list) else ""
    elif collection == "pipeline_logs":
        doc["message"] = "Sanitized pipeline event"
    elif collection == "crm_activity":
        doc["summary"] = "Sanitized activity"
    elif collection == "users":
        doc["name"] = _alias("user", index)
        doc["username"] = f"demo-user-{index:02d}"
        doc.pop("password_hash", None)

    return _scrub_nested(doc, "__root__", collection.rstrip("s"), index)


def export_snapshot(output: Path) -> None:
    load_dotenv()
    mongo_uri = os.environ.get("MONGO_URI")
    if not mongo_uri:
        raise RuntimeError("MONGO_URI is required to export the seed snapshot.")

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000, connectTimeoutMS=10000)
    db = client.get_database("ecosystem")
    collections = {}
    for collection in COLLECTIONS:
        documents = list(db[collection].find({}).sort("_id", 1))
        collections[collection] = [
            sanitize_document(collection, document, index)
            for index, document in enumerate(documents, start=1)
        ]

    payload = dumps({
        "version": 1,
        "sanitized": True,
        "collections": collections,
    }, sort_keys=True, separators=(",", ":")).encode("utf-8")

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as raw_file:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw_file, mtime=0) as archive:
            archive.write(payload)

    print(f"snapshot={output}")
    print(f"compressed_bytes={output.stat().st_size}")
    print(f"sha256={hashlib.sha256(output.read_bytes()).hexdigest()}")
    for collection in COLLECTIONS:
        print(f"{collection}|{len(collections[collection])}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    export_snapshot(args.output)
