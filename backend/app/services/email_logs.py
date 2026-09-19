"""
Email send logging.

Every dispatched outreach email (single, mass, campaign, follow-up) is logged
in the `email_logs` collection so operators can audit who was emailed, with
which subject/template, and whether delivery succeeded or failed.
"""

from datetime import datetime

from ..core.database import get_mongo_db


def _collection():
    return get_mongo_db()["email_logs"]


def log_email_send(
    recipient_email: str,
    recipient_name: str,
    subject: str,
    template_key: str = "",
    campaign_id: str = "",
    kind: str = "outreach",
    status: str = "sent",
    details: str = "",
):
    _collection().insert_one({
        "timestamp": datetime.now().isoformat(),
        "recipient_email": recipient_email,
        "recipient_name": recipient_name,
        "subject": subject,
        "template_key": template_key,
        "campaign_id": campaign_id,
        "kind": kind,
        "status": status,
        "details": details,
    })


def get_email_logs(lead_id: str = "", campaign_id: str = "", limit: int = 200):
    query = {}
    if lead_id:
        query["lead_id"] = lead_id
    if campaign_id:
        query["campaign_id"] = campaign_id
    docs = []
    for doc in _collection().find(query).sort("timestamp", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    return docs


def clear_email_logs():
    _collection().delete_many({})
