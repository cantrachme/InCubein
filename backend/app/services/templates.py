"""
Email template management.

All email templates (invites, follow-ups, confirmations, rejections) are stored
in MongoDB in the `email_templates` collection and can be created, edited,
deleted and selected directly from the UI. Adding a template never requires a
code change. A set of sensible defaults is seeded on first run so existing
behavior is preserved while remaining fully configurable.

Placeholders supported in subjects/bodies:
  {StartupName}, {IncubatorName}, {EntityName}, {OrgName}, {OrgFullName},
  {OrgEmail}, {OrgWebsite}, {OrgAddress}, {Date}, {Time}, {MeetingLink}
"""

import os
import uuid
from datetime import datetime

from ..core import config
from ..core.database import get_mongo_db
from .settings import get_settings

DEFAULT_TEMPLATES = [
    {
        "key": "startup_meeting",
        "name": "Startup Invite Mail",
        "category": "startups",
        "subject": "Introduction to Incubein Foundation",
        "body": """Hello {StartupName},

Greetings from {OrgFullName}.

We came across your startup and were impressed by the work you're building. At **{OrgName}**, we work closely with early-stage and growth-stage startups by providing the right ecosystem, mentorship, and resources to help them scale.

We support startups through:

* Incubation and acceleration programs
* One-on-one mentoring from industry experts
* Investor and funding readiness support
* Business strategy and market access guidance
* Technical and product development support
* Networking opportunities with founders, corporates, and ecosystem partners
* Access to startup credits, infrastructure, and other ecosystem benefits

We would love to learn more about {StartupName}, understand your current challenges and growth plans, and explore how {OrgName} can support your journey.

If you're available, we'd be happy to schedule a **30-minute Google Meet** at your convenience. Alternatively, you're most welcome to visit our office for an in-person discussion.

Please let us know a suitable date and time that works for you, and we'll be happy to coordinate.

We look forward to connecting with you and exploring opportunities to work together.

Warm regards,

**Team {OrgName}**
{OrgFullName}
{OrgAddress}
Email: {OrgEmail}
Website: {OrgWebsite}""",
        "variables": ["StartupName", "OrgName", "OrgFullName", "OrgAddress", "OrgEmail", "OrgWebsite"],
        "is_default": True,
    },
    {
        "key": "startup_followup_confirm",
        "name": "Startup Meet Confirm (positive response)",
        "category": "startups",
        "subject": "Google Meet Confirmation – {OrgName}",
        "body": """Dear {StartupName},

Thank you for your response. We appreciate your interest in connecting with **{OrgFullName}**.

We're pleased to confirm our **30-minute Google Meet** as per the following schedule:

**Date:** {Date}
**Time:** {Time} (IST)
**Google Meet Link:** {MeetingLink}

During the meeting, we'd love to learn more about {StartupName}, understand your current goals and challenges, and discuss how {OrgName} can support your journey through incubation, mentorship, funding readiness, strategic guidance, and our startup ecosystem.

If you have any documents, a pitch deck, or specific discussion points you'd like to share, please feel free to keep them handy for the meeting.

If you need to reschedule, kindly let us know in advance, and we'll be happy to coordinate another suitable time.

We look forward to speaking with you.

Warm regards,

**Team {OrgName}**
{OrgFullName}
{OrgAddress}
Email: {OrgEmail}
Website: {OrgWebsite}""",
        "variables": ["StartupName", "Date", "Time", "MeetingLink", "OrgName", "OrgFullName", "OrgAddress", "OrgEmail", "OrgWebsite"],
        "is_default": False,
    },
    {
        "key": "startup_followup_decline",
        "name": "Startup Thank You (declined)",
        "category": "startups",
        "subject": "Thank You for Your Response",
        "body": """Dear {StartupName},

Thank you for your response and for considering our invitation.

We completely understand and appreciate you taking the time to get back to us. While we're unable to connect at this time, we'd be happy to stay in touch and explore opportunities to collaborate in the future as your startup grows.

If your requirements change or if you'd like to learn more about our incubation programs, mentorship, funding support, or other ecosystem offerings, please feel free to reach out. We'd be delighted to connect whenever the timing is right.

We wish you and your team continued success and all the very best for your startup journey.

Warm regards,

**Team {OrgName}**
{OrgFullName}
{OrgAddress}
Email: {OrgEmail}
Website: {OrgWebsite}""",
        "variables": ["StartupName", "OrgName", "OrgFullName", "OrgAddress", "OrgEmail", "OrgWebsite"],
        "is_default": False,
    },
    {
        "key": "startup_seed_rejection",
        "name": "Startup Seed Support Cohort – Rejection + Pre-Incubation Invite",
        "category": "startups",
        "subject": "Regarding Your Application to the Incubein Startup Seed Support Cohort",
        "cc": "{OrgEmail}",
        "body": """Dear {StartupName},

Greetings from {OrgFullName}.

Thank you for applying to our Startup Seed Support Cohort and for sharing your entrepreneurial journey with us. We truly appreciate the time and effort you invested in your application.

We received an overwhelming response from startups across the country, and after a comprehensive evaluation process, this is to inform you that your application has not been shortlisted for the Second Round of the Seed Support Screening.

However, we strongly believe that your startup has promising potential and would benefit from structured support to further strengthen its foundation before pursuing funding opportunities. With this in mind, we are pleased to invite you to join the Incubein Foundation Pre-Incubation Program.

Through our Pre-Incubation Program, you will receive:
1. Dedicated mentorship and one-on-one guidance
2. Startup Toolkit with practical resources and templates
3. Business model refinement and validation support
4. Go-to-market and growth strategy guidance
5. Pitch deck and investor readiness support
6. Access to our startup ecosystem, expert network, and learning sessions
7. Guidance on government schemes, grants, and funding opportunities

Our objective is to work closely with you, strengthen your startup, and help you become investment and incubation ready. Once your venture reaches the required milestones, it will be eligible for consideration under our Incubation Program and various funding opportunities facilitated through the Incubein ecosystem.

If you are interested in joining the Pre-Incubation Program, kindly acknowledge this mail, and our team will forward you further process.

We sincerely appreciate your interest in Incubein Foundation and look forward to supporting your entrepreneurial journey towards building a scalable and impactful venture.

Warm regards,
Team {OrgName}
{OrgFullName}""",
        "variables": ["StartupName", "OrgName", "OrgFullName", "OrgEmail"],
        "is_default": False,
    },
    {
        "key": "incubator_meeting",
        "name": "Incubator Invite Mail",
        "category": "incubators",
        "subject": "Introduction to Incubein Foundation",
        "body": """Hello {IncubatorName},

Greetings from {OrgFullName}.

We came across your incubation centre and were impressed by the impactful work you're doing for the startup ecosystem. At **{OrgName}**, we actively collaborate with incubation centres, academic institutions, and innovation hubs to build a stronger and more connected ecosystem.

We would love to explore a potential **Strategic Cooperation and Academic Collaboration** between {OrgName} and {IncubatorName}. Together, we can:

* Co-host startup programs and events
* Exchange knowledge, mentors, and resources
* Collaborate on funding and policy advocacy
* Expand our collective reach across regions and sectors
* Sign a formal MoU to institutionalise our partnership

We would love to learn more about {IncubatorName}, understand your ongoing programs, and explore how we can create mutual value.

If you're available, we'd be happy to schedule a **30-minute Google Meet** at your convenience. Alternatively, you're most welcome to visit our office for an in-person discussion.

Please let us know a suitable date and time that works for you, and we'll be happy to coordinate.

We look forward to connecting with you and exploring opportunities to work together.

Warm regards,

**Team {OrgName}**
{OrgFullName}
{OrgAddress}
Email: {OrgEmail}
Website: {OrgWebsite}""",
        "variables": ["IncubatorName", "OrgName", "OrgFullName", "OrgAddress", "OrgEmail", "OrgWebsite"],
        "is_default": True,
    },
    {
        "key": "incubator_followup_confirm",
        "name": "Incubator Meet Confirm (positive response)",
        "category": "incubators",
        "subject": "Google Meet Confirmation – {OrgName}",
        "body": """Dear {IncubatorName},

Thank you for your response. We appreciate your interest in connecting with **{OrgFullName}**.

We're pleased to confirm our **30-minute Google Meet** as per the following schedule:

**Date:** {Date}
**Time:** {Time} (IST)
**Google Meet Link:** {MeetingLink}

During the meeting, we'd love to learn more about {IncubatorName}, understand your current programs and goals, and discuss how {OrgName} can collaborate with you through academic partnerships, co-incubation, MoU agreements, and shared ecosystem initiatives.

If you have any documents, a brochure, or specific discussion points you'd like to share, please feel free to keep them handy for the meeting.

If you need to reschedule, kindly let us know in advance, and we'll be happy to coordinate another suitable time.

We look forward to speaking with you.

Warm regards,

**Team {OrgName}**
{OrgFullName}
{OrgAddress}
Email: {OrgEmail}
Website: {OrgWebsite}""",
        "variables": ["IncubatorName", "Date", "Time", "MeetingLink", "OrgName", "OrgFullName", "OrgAddress", "OrgEmail", "OrgWebsite"],
        "is_default": False,
    },
    {
        "key": "incubator_followup_decline",
        "name": "Incubator Thank You (declined)",
        "category": "incubators",
        "subject": "Thank You for Your Response",
        "body": """Dear {IncubatorName},

Thank you for your response and for considering our invitation.

We completely understand and appreciate you taking the time to get back to us. While we're unable to connect at this time, we'd be happy to stay in touch and explore opportunities to collaborate in the future.

If your requirements change or if you'd like to learn more about our partnership programs, MoU frameworks, or joint incubation initiatives, please feel free to reach out. We'd be delighted to connect whenever the timing is right.

We wish you and your team continued success in your mission to support the startup ecosystem.

Warm regards,

**Team {OrgName}**
{OrgFullName}
{OrgAddress}
Email: {OrgEmail}
Website: {OrgWebsite}""",
        "variables": ["IncubatorName", "OrgName", "OrgFullName", "OrgAddress", "OrgEmail", "OrgWebsite"],
        "is_default": False,
    },
    {
        "key": "startup_followup_general",
        "name": "Startup General Follow-up",
        "category": "followup",
        "subject": "Following up: Introduction to Incubein Foundation – {StartupName} (Follow-up #{FollowupNumber})",
        "body": """Dear {StartupName},

Greetings from {OrgFullName}.

We are following up on our previous email regarding our invitation to explore how {OrgName} can support your startup journey.

We remain very interested in connecting with {StartupName} and would love to schedule a 30-minute Google Meet at your convenience.

Please let us know a suitable date and time that works for you, and we'll be happy to coordinate.

Warm regards,

Team {OrgName}
{OrgFullName}
{OrgAddress}
Email: {OrgEmail}
Website: {OrgWebsite}
(Follow-up Reference #{FollowupNumber})""",
        "variables": ["StartupName", "FollowupNumber", "OrgName", "OrgFullName", "OrgAddress", "OrgEmail", "OrgWebsite"],
        "is_default": False,
    },
    {
        "key": "incubator_followup_general",
        "name": "Incubator General Follow-up",
        "category": "followup",
        "subject": "Following up: Introduction to Incubein Foundation – {IncubatorName} (Follow-up #{FollowupNumber})",
        "body": """Dear {IncubatorName},

Greetings from {OrgFullName}.

We are following up on our previous email regarding a potential Strategic Cooperation and Academic Collaboration between {OrgName} and {IncubatorName}.

We remain keen to explore a 30-minute Google Meet at your convenience to discuss how we can create mutual value for our respective ecosystems.

Please let us know a suitable date and time, and we'll be happy to coordinate.

Warm regards,

Team {OrgName}
{OrgFullName}
{OrgAddress}
Email: {OrgEmail}
Website: {OrgWebsite}
(Follow-up Reference #{FollowupNumber})""",
        "variables": ["IncubatorName", "FollowupNumber", "OrgName", "OrgFullName", "OrgAddress", "OrgEmail", "OrgWebsite"],
        "is_default": False,
    },
]


def _collection():
    return get_mongo_db()["email_templates"]


def _compile_template(template: dict, context: dict) -> str:
    """Replaces template placeholders using the provided context."""
    text = template.get("subject", "") or ""
    body = template.get("body", "") or ""
    replacements = {
        "StartupName": context.get("StartupName", ""),
        "IncubatorName": context.get("IncubatorName", ""),
        "EntityName": context.get("EntityName", ""),
        "FollowupNumber": str(context.get("FollowupNumber", 1)),
        "Date": context.get("Date", ""),
        "Time": context.get("Time", ""),
        "MeetingLink": context.get("MeetingLink", ""),
    }
    settings = context.get("_settings") or get_settings()
    replacements.update({
        "OrgName": context.get("OrgName", settings.get("org_name", "")),
        "OrgFullName": context.get("OrgFullName", settings.get("org_full_name", "")),
        "OrgEmail": context.get("OrgEmail", settings.get("org_email", "")),
        "OrgWebsite": context.get("OrgWebsite", settings.get("org_website", "")),
        "OrgAddress": context.get("OrgAddress", settings.get("org_address", "")),
    })
    for key, value in replacements.items():
        text = text.replace("{" + key + "}", str(value))
        body = body.replace("{" + key + "}", str(value))
    return {"subject": text, "body": body}


def render_template(template: dict, context: dict) -> dict:
    """Public helper to compile a template subject/body with a context dict."""
    return _compile_template(template, context)


def interpolate_variables(text: str, context: dict) -> str:
    """Fills any remaining template placeholders (e.g. {OrgName}) in plain text
    using the given context and platform settings."""
    return _compile_template({"subject": "", "body": text}, context)["body"]


def seed_default_templates():
    try:
        coll = _collection()
        if coll.count_documents({}) == 0:
            now = datetime.now().isoformat()
            for tpl in DEFAULT_TEMPLATES:
                tpl = dict(tpl)
                tpl.setdefault("cc", "")
                tpl.setdefault("bcc", "")
                tpl.setdefault("attachments", [])
                tpl["created_at"] = now
                tpl["updated_at"] = now
                coll.insert_one(tpl)
    except Exception as e:
        print(f"[Templates] Failed to seed default templates: {e}")


def get_email_templates(category: str = None):
    seed_default_templates()
    coll = _collection()
    query = {}
    if category:
        query["category"] = category
    docs = []
    for doc in coll.find(query):
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    # Guard against duplicate keys (e.g. from older seeds): keep the most
    # recently updated record for each key so the UI never sees dupes.
    by_key = {}
    for doc in docs:
        key = doc.get("key")
        existing = by_key.get(key)
        if existing is None or (doc.get("updated_at") or "") > (existing.get("updated_at") or ""):
            by_key[key] = doc
    docs = list(by_key.values())
    docs.sort(key=lambda d: d.get("category", ""))
    return docs


def get_email_template(key: str):
    seed_default_templates()
    doc = _collection().find_one({"key": key})
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


def get_default_template(category: str) -> dict:
    """Returns the default template for a category (startups/incubators/followup)."""
    seed_default_templates()
    coll = _collection()
    doc = coll.find_one({"category": category, "is_default": True})
    if not doc:
        doc = coll.find_one({"category": category})
    if not doc:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


def create_email_template(data: dict) -> dict:
    seed_default_templates()
    coll = _collection()
    key = (data.get("key") or "").strip()
    if not key:
        key = data.get("name") or "template"
        key = "".join(c for c in key.lower() if c.isalnum() or c in "-_")[:60]
        key = f"{key}_{uuid.uuid4().hex[:4]}"

    if coll.find_one({"key": key}):
        raise ValueError(f"A template with key '{key}' already exists.")

    if data.get("is_default"):
        coll.update_many(
            {"category": data.get("category", "general")},
            {"$set": {"is_default": False}},
        )

    doc = {
        "key": key,
        "name": data.get("name", key),
        "category": data.get("category", "general"),
        "subject": data.get("subject", ""),
        "body": data.get("body", ""),
        "cc": data.get("cc") or "",
        "bcc": data.get("bcc") or "",
        "is_default": bool(data.get("is_default", False)),
        "variables": data.get("variables") or [],
        "attachments": data.get("attachments") or [],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    coll.insert_one(doc)
    doc["_id"] = str(doc["_id"])
    return doc


def update_email_template(key: str, data: dict) -> dict:
    seed_default_templates()
    coll = _collection()
    existing = coll.find_one({"key": key})
    if not existing:
        raise ValueError(f"Template '{key}' not found.")

    update = {}
    for field in ["name", "category", "subject", "body", "cc", "bcc", "is_default", "variables"]:
        if field in data and data[field] is not None:
            if field == "is_default":
                update[field] = bool(data[field])
            elif field == "variables":
                update[field] = list(data[field]) if isinstance(data[field], list) else []
            else:
                update[field] = str(data[field])

    if data.get("is_default"):
        coll.update_many(
            {"category": data.get("category", existing.get("category", "general"))},
            {"$set": {"is_default": False}},
        )
        update["is_default"] = True

    if not update:
        return {**existing, "_id": str(existing["_id"])}

    update["updated_at"] = datetime.now().isoformat()
    coll.update_one({"key": key}, {"$set": update})

    doc = coll.find_one({"key": key})
    doc["_id"] = str(doc["_id"])
    return doc


def delete_email_template(key: str) -> bool:
    seed_default_templates()
    result = _collection().delete_one({"key": key})
    return result.deleted_count > 0


# ---------------------------------------------------------------------------
# Template attachments
# ---------------------------------------------------------------------------

def _attachment_dir(template_key: str) -> str:
    safe_key = "".join(c for c in (template_key or "template") if c.isalnum() or c in "-_")
    path = config.ATTACHMENTS_DIR / safe_key
    os.makedirs(path, exist_ok=True)
    return str(path)


def _attachment_record(template_key: str, attachment_id: str) -> dict:
    """Re-derives an attachment record for a template from its stored metadata."""
    tpl = _collection().find_one({"key": template_key})
    if not tpl:
        return None
    for att in tpl.get("attachments") or []:
        if att.get("id") == attachment_id:
            return att
    return None


def get_template_attachments(template_key: str) -> list:
    seed_default_templates()
    tpl = _collection().find_one({"key": template_key})
    if not tpl:
        return []
    return list(tpl.get("attachments") or [])


def upload_template_attachment(template_key: str, file) -> dict:
    """Saves an uploaded file for a template and stores its metadata in the doc."""
    seed_default_templates()
    coll = _collection()
    tpl = coll.find_one({"key": template_key})
    if not tpl:
        raise ValueError(f"Template '{template_key}' not found.")

    filename = getattr(file, "filename", "") or f"attachment_{uuid.uuid4().hex[:8]}"
    # Keep the original name for display but store under a unique path.
    safe_name = os.path.basename(filename.replace("\\", "/")) or "attachment.bin"
    attachment_id = uuid.uuid4().hex[:12]
    stored_name = f"{attachment_id}_{safe_name}"

    contents = file.file.read()
    target_path = os.path.join(_attachment_dir(template_key), stored_name)
    with open(target_path, "wb") as f:
        f.write(contents)

    record = {
        "id": attachment_id,
        "filename": safe_name,
        "stored_name": stored_name,
        "size": len(contents),
        "content_type": getattr(file, "content_type", "") or "application/octet-stream",
    }

    attachments = list(tpl.get("attachments") or [])
    attachments.append(record)
    coll.update_one(
        {"key": template_key},
        {"$set": {"attachments": attachments, "updated_at": datetime.now().isoformat()}},
    )
    return record


def delete_template_attachment(template_key: str, attachment_id: str) -> bool:
    seed_default_templates()
    coll = _collection()
    tpl = coll.find_one({"key": template_key})
    if not tpl:
        raise ValueError(f"Template '{template_key}' not found.")

    attachments = list(tpl.get("attachments") or [])
    record = None
    for att in attachments:
        if att.get("id") == attachment_id:
            record = att
            break
    if not record:
        return False

    attachments = [att for att in attachments if att.get("id") != attachment_id]
    coll.update_one(
        {"key": template_key},
        {"$set": {"attachments": attachments, "updated_at": datetime.now().isoformat()}},
    )

    stored_path = os.path.join(_attachment_dir(template_key), record.get("stored_name", ""))
    try:
        if os.path.exists(stored_path):
            os.remove(stored_path)
    except Exception as e:
        print(f"[Templates] Failed to remove attachment file: {e}")
    return True


def resolve_template_attachments(template_key: str) -> list:
    """Returns a list of {filename, path} dicts for the files attached to a template.

    Files are resolved from disk; missing files are silently skipped so a send
    never fails because of a stale attachment record.
    """
    records = get_template_attachments(template_key)
    resolved = []
    for rec in records:
        path = os.path.join(_attachment_dir(template_key), rec.get("stored_name", ""))
        if os.path.exists(path):
            resolved.append({"filename": rec.get("filename", os.path.basename(path)), "path": path})
    return resolved


def clone_defaults_to_configured_templates():
    """Migrates legacy hard-coded template content into the DB (no-op safety net)."""
    seed_default_templates()
