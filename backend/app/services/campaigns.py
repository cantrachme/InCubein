"""
Email campaign management.

Campaigns let operators group outreach emails: choose the audience (all
startups / incubators, a specific company, or a custom recipient), pick an
email template (or type a custom subject/body), and control batching and
delays. Emails are dispatched through the existing Gmail integration and
logged in the `email_logs` collection.
"""

import uuid
from datetime import datetime

from ..core.database import get_mongo_db

CAMPAIGN_STATUSES = ["draft", "sending", "completed", "paused"]


def _collection():
    return get_mongo_db()["campaigns"]


def get_campaigns():
    docs = []
    for doc in _collection().find({}):
        doc["_id"] = str(doc["_id"])
        doc["id"] = str(doc.get("campaign_id") or doc.get("_id") or "")
        docs.append(doc)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


def get_campaign(campaign_id: str):
    doc = _collection().find_one({"campaign_id": campaign_id})
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    doc["id"] = campaign_id
    return doc


def create_campaign(data: dict) -> dict:
    campaign_id = data.get("campaign_id") or uuid.uuid4().hex
    doc = {
        "campaign_id": campaign_id,
        "name": data.get("name") or "Untitled Campaign",
        "target_type": data.get("target_type") or "all_startups",
        "template_id": data.get("template_id") or "",
        "subject": data.get("subject") or "",
        "body": data.get("body") or "",
        "cc": data.get("cc") or "",
        "batch_size": int(data.get("batch_size") or 8),
        "delay_seconds": int(data.get("delay_seconds") or 20),
        "status": data.get("status") or "draft",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    _collection().insert_one(doc)
    doc["_id"] = str(doc["_id"])
    doc["id"] = campaign_id
    return doc


def update_campaign(campaign_id: str, data: dict) -> dict:
    existing = _collection().find_one({"campaign_id": campaign_id})
    if not existing:
        raise ValueError(f"Campaign '{campaign_id}' not found.")

    update = {}
    for field in [
        "name", "target_type", "template_id", "subject", "body", "cc", "status",
    ]:
        if field in data and data[field] is not None:
            update[field] = str(data[field])
    for field in ["batch_size", "delay_seconds"]:
        if field in data and data[field] is not None:
            update[field] = int(data[field])

    if not update:
        return {**existing, "_id": str(existing["_id"]), "id": campaign_id}

    update["updated_at"] = datetime.now().isoformat()
    _collection().update_one({"campaign_id": campaign_id}, {"$set": update})

    doc = _collection().find_one({"campaign_id": campaign_id})
    doc["_id"] = str(doc["_id"])
    doc["id"] = campaign_id
    return doc


def delete_campaign(campaign_id: str) -> bool:
    result = _collection().delete_one({"campaign_id": campaign_id})
    return result.deleted_count > 0
