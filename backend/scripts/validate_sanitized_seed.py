"""Validate the bundled seed's structure, counts, and privacy guarantees."""

import argparse
import gzip
import re
from pathlib import Path

from bson.json_util import loads


EXPECTED_COUNTS = {
    "app_settings": 1,
    "crm_action_plans": 0,
    "crm_actions": 0,
    "crm_activity": 4,
    "crm_audits": 0,
    "crm_colleges": 3,
    "crm_counters": 11,
    "crm_customers": 0,
    "crm_deals": 0,
    "crm_financials": 0,
    "crm_founders": 1207,
    "crm_funding": 0,
    "crm_milestones": 1,
    "crm_risks": 1,
    "crm_startups": 1180,
    "crm_students": 979,
    "email_logs": 106,
    "email_templates": 18,
    "incubators": 102,
    "incubein_applications": 514,
    "investors": 3,
    "mentors": 4,
    "outreach_activity": 0,
    "outreach_config": 1,
    "outreach_leads": 149,
    "pipeline_logs": 1034,
    "relationships": 36,
    "roles": 1,
    "scheduled_meetings": 0,
    "startups": 274,
    "users": 1,
}

SECRET_PARTS = ("password", "secret", "token", "credential", "api_key", "apikey")
EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)


def validate(path: Path) -> None:
    with gzip.open(path, "rt", encoding="utf-8") as seed_file:
        snapshot = loads(seed_file.read())

    errors = []
    if snapshot.get("version") != 1 or snapshot.get("sanitized") is not True:
        errors.append("snapshot metadata is invalid")

    collections = snapshot.get("collections", {})
    actual_counts = {name: len(documents) for name, documents in collections.items()}
    if actual_counts != EXPECTED_COUNTS:
        errors.append("collection counts do not match the approved source inventory")
    for collection, documents in collections.items():
        if any(not isinstance(document, dict) for document in documents):
            errors.append(f"{collection} contains a non-document value")

    def walk(value, path_parts=()):
        if isinstance(value, dict):
            for key, child in value.items():
                lower = key.lower()
                child_path = path_parts + (key,)
                if any(part in lower for part in SECRET_PARTS):
                    errors.append(f"secret-like field remains at {'.'.join(child_path)}")
                if "email" in lower and isinstance(child, str) and child and not child.endswith("@example.invalid"):
                    errors.append(f"non-sanitized email remains at {'.'.join(child_path)}")
                if lower in {"phone", "mobile", "alternate_mobile", "alternet_mobile", "principal_contact", "coordinator_contact"} and child:
                    errors.append(f"contact number remains at {'.'.join(child_path)}")
                walk(child, child_path)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, path_parts + (str(index),))
        elif isinstance(value, str):
            for email in EMAIL_PATTERN.findall(value):
                if not email.endswith("@example.invalid"):
                    errors.append(f"embedded email remains at {'.'.join(path_parts)}")

    walk(collections)

    for doc in collections.get("incubein_applications", []):
        if doc.get("raw_data"):
            errors.append("an application still contains raw_data")
        if not str(doc.get("name", "")).startswith("Applicant "):
            errors.append("an application name was not pseudonymized")
    for doc in collections.get("crm_founders", []):
        if not str(doc.get("name", "")).startswith("Founder "):
            errors.append("a founder name was not pseudonymized")
    for doc in collections.get("crm_students", []):
        if not str(doc.get("student_name", "")).startswith("Student "):
            errors.append("a student name was not pseudonymized")
    for doc in collections.get("users", []):
        if "password_hash" in doc:
            errors.append("a user password hash remains")

    if errors:
        preview = "\n".join(f"- {error}" for error in errors[:20])
        raise SystemExit(f"Sanitized seed validation failed ({len(errors)} issue(s)):\n{preview}")

    print(f"validated_collections={len(collections)}")
    print(f"validated_documents={sum(actual_counts.values())}")
    print("privacy_audit=passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    validate(args.path)
