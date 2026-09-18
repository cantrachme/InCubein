"""Operational inquiry inbox for the Outreach Hub.

Provides the single source of truth for outreach inquiries, split into
two independent classes — INCUBATION and STARTUP — that are filtered at the
data layer (never mixed) and surfaced through the Inquirer Dashboard,
the Timeline activity feed and the Inquiry Workspace.

Every interaction with an inquiry (reply sent, meeting scheduled, stage
changed) is persisted both on the lead record and as a clickable activity
record in the ``outreach_activity`` collection.
"""

import uuid
import re
import hashlib
from datetime import datetime, date

from ..core.database import get_mongo_db
from ..core.exceptions import NotFoundError, BadRequestError
from .outreach import clean_email_reply
from .email import get_smtp_config, send_plain_email
from .email_logs import log_email_send

STARTUP_LEAD_ID = "incubein_cohort"

INQUIRY_STAGES = [
    "Draft",
    "Sent",
    "Follow-up Sent",
    "Replied",
    "Meeting Scheduled",
    "In Loop",
    "Interviewed",
    "MOUs",
    "Incubated",
    "TBI Partnership",
    "Not Interested",
]


def _entity_kind(lead):
    """Decides whether a lead belongs to INCUBATION or STARTUP.

    Startup leads are scoped by the special incubator_id 'incubein_cohort',
    everything else is an incubation / incubator record.
    """
    if lead.get("incubator_id") == STARTUP_LEAD_ID:
        return "startup"
    if str(lead.get("incubator_id", "")).startswith("inc_"):
        return "incubation"
    name = str(lead.get("incubator_name", "") or "").lower()
    if any(k in name for k in ("startup", "start-up", "cohort")):
        return "startup"
    return "incubation"


def _norm(s):
    return re.sub(r"\s+", " ", str(s or "")).strip().lower()


def _match_startup(db, name):
    n = _norm(name)
    if not n:
        return None
    for st in db["crm_startups"].find({}):
        if _norm(st.get("name")) == n or (st.get("code") and _norm(st.get("code")) == n):
            return st
    for st in db["startups"].find({}):
        if _norm(st.get("name")) == n:
            return st
    return None


def _match_incubator(db, name):
    n = _norm(name)
    if not n:
        return None
    for inc in db["incubators"].find({}):
        if _norm(inc.get("name")) == n:
            return inc
    return None


def _priority_from_score(score):
    try:
        score = int(score or 0)
    except (TypeError, ValueError):
        score = 0
    if score >= 80:
        return "High"
    if score >= 60:
        return "Medium"
    return "Low"


def _last_activity_for_lead(db, lead):
    """Resolves the most recent activity timestamp + label for an inquiry."""
    events = []
    if lead.get("reply_detected_at"):
        events.append(("Email received", lead.get("reply_detected_at")))
    if lead.get("sent_at"):
        events.append(("Outreach sent", lead.get("sent_at")))
    if lead.get("last_followup_at"):
        events.append(("Follow-up sent", lead.get("last_followup_at")))
    if lead.get("meeting_scheduled_at"):
        events.append(("Meeting scheduled", lead.get("meeting_scheduled_at")))
    initials = list(db["outreach_activity"].find({"lead_id": lead.get("id")}))
    for a in initials:
        events.append((a.get("title") or a.get("activity_type", "Activity"), a.get("created_at")))
    events = [(label, ts) for label, ts in events if ts]
    if not events:
        return {"label": "No activity", "timestamp": None}
    events.sort(key=lambda x: str(x[1]) or "", reverse=True)
    return {"label": events[0][0], "timestamp": events[0][1]}


def _meeting_status_for_lead(db, lead):
    meeting = db["scheduled_meetings"].find_one({"lead_id": lead.get("id")})
    if not meeting:
        return None
    if str(meeting.get("date") or ""):
        return {
            "id": meeting.get("id"),
            "title": meeting.get("title") or "Meeting",
            "date": meeting.get("date"),
            "time": meeting.get("time"),
            "link": meeting.get("meeting_link") or "",
        }
    return None


def _enrich_lead(db, lead, idx=0):
    lead = dict(lead)
    lead["id"] = lead.get("id") or lead.get("_id") or idx

    sector = lead.get("sector") or lead.get("industry") or "—"
    sub_sector = lead.get("sub_sector") or lead.get("subindustry") or "—"
    stage = lead.get("stage") or lead.get("status") or "Draft"
    phone = lead.get("phone") or lead.get("phone_number") or "—"
    contact = lead.get("contact_name") or lead.get("contact") or ""
    score = lead.get("lead_score") or 0

    lead["sector"] = sector
    lead["sub_sector"] = sub_sector
    lead["stage"] = stage
    lead["phone"] = phone
    lead["contact_name"] = contact
    lead["city"] = lead.get("city") or ""
    lead["priority"] = lead.get("priority") or _priority_from_score(score)
    lead["source"] = lead.get("source") or lead.get("last_contact_reason") or "Outreach Hub"
    lead["received_at"] = lead.get("reply_detected_at") or lead.get("sent_at") or lead.get("nurture_start_date") or lead.get("created_at") or ""
    lead["assigned_to"] = lead.get("assigned_to") or lead.get("assignee") or ""
    lead["next_action"] = lead.get("next_action_date") or lead.get("next_action") or ""
    lead["reply_status"] = "Replied" if lead.get("reply_sent_at") else ("Replied" if lead.get("reply_text") else "Pending")
    last = _last_activity_for_lead(db, lead)
    lead["last_activity"] = last["label"]
    lead["last_activity_at"] = last["timestamp"]
    lead["meeting"] = _meeting_status_for_lead(db, lead)

    raw_reply = lead.get("reply_text") or ""
    lead["message"] = clean_email_reply(raw_reply) if raw_reply else (lead.get("message_body") or lead.get("notes") or "")
    lead["message_raw"] = raw_reply
    lead["contact_count"] = lead.get("contact_count") or 0
    lead["followup_count"] = lead.get("followup_count") or 0
    return lead


def _bucket(db, leads, kind):
    rows = [_enrich_lead(db, l, idx) for idx, l in enumerate(leads)]
    total = len(rows)
    new_count = len([
        r for r in rows if (r.get("status") == "Draft") or (r.get("is_read") in (0, None) and r.get("reply_status") == "Pending")
    ])
    in_progress = len([r for r in rows if r.get("status") in ("Sent", "Follow-up Sent", "In Loop", "Interviewed")])
    replied = len([r for r in rows if r.get("reply_status") == "Replied" or r.get("status") in ("MOUs", "Incubated", "TBI Partnership")])
    meetings = len([r for r in rows if r.get("meeting")])
    return {
        "entity": kind,
        "total": total,
        "new": new_count,
        "in_progress": in_progress,
        "replied": replied,
        "meetings": meetings,
        "inquiries": rows,
    }


def get_inquiry_dashboard(entity=None):
    db = get_mongo_db()
    leads = list(db["outreach_leads"].find({}))
    incubation = [l for l in leads if _entity_kind(l) == "incubation"]
    startup = [l for l in leads if _entity_kind(l) == "startup"]
    result = {
        "incubation": _bucket(db, incubation, "incubation"),
        "startup": _bucket(db, startup, "startup"),
        "total": len(leads),
    }
    if entity in ("incubation", "startup"):
        return result[entity]
    return result


def get_inquiries(entity="all"):
    if entity not in ("incubation", "startup", "all"):
        raise BadRequestError("entity must be 'incubation', 'startup' or 'all'.")
    db = get_mongo_db()
    leads = list(db["outreach_leads"].find({}))
    if entity == "incubation":
        leads = [l for l in leads if _entity_kind(l) == "incubation"]
    elif entity == "startup":
        leads = [l for l in leads if _entity_kind(l) == "startup"]
    rows = [_enrich_lead(db, l, idx) for idx, l in enumerate(leads)]
    rows.sort(key=lambda r: str(r.get("received_at") or ""), reverse=True)
    return rows


def get_inquiry_detail(lead_id):
    db = get_mongo_db()
    lead = db["outreach_leads"].find_one({"id": lead_id})
    if not lead:
        raise NotFoundError("Inquiry not found.")
    detail = _enrich_lead(db, lead, 0)

    meetings = list(db["scheduled_meetings"].find({"lead_id": lead_id}).sort("date", 1))
    for m in meetings:
        m["_id"] = str(m.get("_id", ""))
    detail["meetings_list"] = meetings

    activity = list(db["outreach_activity"].find({"lead_id": lead_id}).sort("created_at", 1))
    for a in activity:
        a["_id"] = str(a.get("_id", ""))
    detail["activity"] = activity
    return detail


def _log_activity(db, lead, activity_type, title, details, performed_by="", extra=None):
    record = {
        "id": f"act_{uuid.uuid4().hex[:10]}",
        "lead_id": lead.get("id") or lead.get("_id") or "",
        "entity_kind": _entity_kind(lead),
        "entity_name": lead.get("incubator_name") or lead.get("incubator_id") or "",
        "email": lead.get("email") or "",
        "activity_type": activity_type,
        "title": title,
        "details": details or "",
        "created_at": datetime.now().isoformat(),
        "performed_by": performed_by or "Incubein Team",
    }
    if extra:
        record.update(extra)
    try:
        if activity_type == "meeting_scheduled" and extra and extra.get("meeting_id"):
            existing = db["outreach_activity"].find_one({
                "lead_id": lead.get("id") or lead.get("_id") or "",
                "activity_type": "meeting_scheduled",
                "meeting_id": extra["meeting_id"],
            })
            if existing:
                return existing
        db["outreach_activity"].insert_one(record)
    except Exception as e:
        print("Failed to log outreach activity:", e)
    return record


def send_inquiry_reply(lead_id, body, subject=None, performed_by=""):
    """Sends an actual reply to the inquiry email and records it as an activity."""
    db = get_mongo_db()
    lead = db["outreach_leads"].find_one({"id": lead_id})
    if not lead:
        raise NotFoundError("Inquiry not found.")
    if not (body or "").strip():
        raise BadRequestError("Reply body cannot be empty.")

    lead = dict(lead)
    recipient = lead.get("email") or ""
    if not recipient:
        raise BadRequestError("Inquiry has no recipient email address.")

    smtp_cfg = get_smtp_config()
    sender_email = smtp_cfg["sender_email"]
    _reply_subject = subject or "Re: Introduction to Incubein Foundation"

    if str(lead.get("incubator_id")) == STARTUP_LEAD_ID:
        entity_kind = "startup"
    else:
        entity_kind = "incubation"

    email_sent = send_plain_email(
        smtp_cfg,
        sender_email,
        recipient,
        _reply_subject,
        body,
        from_display="Incubein Foundation",
    )

    log_email_send(
        recipient_email=recipient,
        recipient_name=lead.get("incubator_name") or "",
        subject=_reply_subject,
        kind="reply",
        status="sent" if email_sent else "simulated",
        details=f"Inquiry reply ({entity_kind})",
    )

    now = datetime.now().isoformat()
    prev_notes = lead.get("notes") or ""
    note_line = f"Reply sent on {now}: {_reply_subject}"
    db["outreach_leads"].update_one(
        {"id": lead_id},
        {"$set": {
            "reply_sent_at": now,
            "reply_sent_body": body,
            "reply_sent_subject": _reply_subject,
            "reply_status": "Replied",
            "status": lead.get("status") if lead.get("status") in ("MOUs", "Incubated", "TBI Partnership", "Meeting Scheduled") else "Replied",
            "updated_at": now,
            "notes": f"{prev_notes}\n{note_line}".strip() if prev_notes else note_line,
        }},
    )

    _log_activity(
        db,
        lead,
        "reply_sent",
        "Reply sent",
        body,
        performed_by=performed_by,
        extra={"subject": _reply_subject, "sent_status": "sent" if email_sent else "simulated"},
    )

    return {
        "status": "success",
        "message": ("Reply email sent via SMTP." if email_sent else "SMTP not configured — reply recorded as simulated."),
        "delivered": email_sent,
        "reply_sent_at": now,
    }


def schedule_inquiry_meeting(
    lead_id,
    title=None,
    date_str=None,
    time_str=None,
    duration_minutes=30,
    participants=None,
    meeting_type=None,
    meeting_link=None,
    notes=None,
    performed_by="",
):
    """Schedules a meeting linked to an inquiry and logs it as an activity."""
    db = get_mongo_db()
    lead = db["outreach_leads"].find_one({"id": lead_id})
    if not lead:
        raise NotFoundError("Inquiry not found.")
    if not date_str or not time_str:
        raise BadRequestError("Meeting date and time are required.")

    lead = dict(lead)
    meeting_id = f"evt_{uuid.uuid4().hex[:8]}"
    meeting_title = title or f"Strategic Meeting: {lead.get('incubator_name') or ''}".strip()

    meeting = {
        "id": meeting_id,
        "lead_id": lead_id,
        "incubator_id": lead.get("incubator_id"),
        "incubator_name": lead.get("incubator_name") or "",
        "title": meeting_title,
        "date": date_str,
        "time": time_str,
        "duration_minutes": int(duration_minutes or 30),
        "participants": (participants or "").strip(),
        "meeting_type": meeting_type or "",
        "meeting_link": meeting_link or lead.get("meeting_link") or "",
        "notes": notes or "",
        "status": "Scheduled",
        "created_at": datetime.now().isoformat(),
    }
    db["scheduled_meetings"].insert_one(meeting)

    now = datetime.now().isoformat()
    db["outreach_leads"].update_one(
        {"id": lead_id},
        {"$set": {
            "meeting_link": meeting["meeting_link"],
            "meeting_scheduled_at": f"{date_str} at {time_str}",
            "status": lead.get("status") if lead.get("status") in ("MOUs", "Incubated", "TBI Partnership") else "Meeting Scheduled",
            "updated_at": now,
        }},
    )
    _log_activity(
        db,
        lead,
        "meeting_scheduled",
        "Meeting scheduled",
        f"Meeting scheduled for {date_str}, {time_str} ({meeting_title})",
        performed_by=performed_by,
        extra={"meeting_id": meeting_id, "meeting_title": meeting_title, "date": date_str, "time": time_str},
    )
    return {
        "status": "success",
        "meeting_id": meeting_id,
        "meeting_link": meeting["meeting_link"],
        "message": f"Meeting scheduled for {date_str} at {time_str}.",
    }


def update_inquiry_stage(lead_id, stage, notes=None, performed_by=""):
    if stage not in INQUIRY_STAGES:
        raise BadRequestError(f"Unknown inquiry stage '{stage}'.")
    db = get_mongo_db()
    lead = db["outreach_leads"].find_one({"id": lead_id})
    if not lead:
        raise NotFoundError("Inquiry not found.")

    now = datetime.now().isoformat()
    patch = {"status": stage, "updated_at": now}
    if notes is not None:
        patch["notes"] = notes
    db["outreach_leads"].update_one({"id": lead_id}, {"$set": patch})
    _log_activity(db, lead, "stage_change", f"Stage → {stage}", notes or "", performed_by=performed_by, extra={"stage": stage})
    return {"status": "success", "message": f"Inquiry stage updated to {stage}."}


def mark_inquiry_read(lead_id, performed_by=""):
    db = get_mongo_db()
    lead = db["outreach_leads"].find_one({"id": lead_id})
    if not lead:
        raise NotFoundError("Inquiry not found.")
    db["outreach_leads"].update_one(
        {"id": lead_id},
        {"$set": {"is_read": 1, "updated_at": datetime.now().isoformat()}},
    )
    _log_activity(db, lead, "reviewed", "Inquiry reviewed", "", performed_by=performed_by, extra={"is_read": 1})
    return {"status": "success", "message": "Inquiry marked as read."}


def get_activity_feed(limit=200, startup_id=None):
    db = get_mongo_db()
    budget = max(int(limit or 20), 20) * 2
    events = []

    def add_event(event):
        if not event or not event.get("timestamp"):
            return
        sid = event.get("startup_id")
        if startup_id is not None and sid != startup_id and not (event.get("extra") or {}).get("startup_id") == startup_id:
            return
        events.append(event)

    for a in db["outreach_activity"].find({}).sort("created_at", -1).limit(budget):
        event = _feed_event(
            id=a.get("id") or str(a.get("_id", "")),
            activity_type=a.get("activity_type") or "activity",
            title=a.get("title") or "Activity",
            timestamp=a.get("created_at"),
            details=a.get("details") or "",
            entity_name=a.get("entity_name") or "",
            entity_kind=a.get("entity_kind") or "",
            lead_id=a.get("lead_id") or "",
            performed_by=a.get("performed_by") or "",
            email=a.get("email") or "",
            extra={k: v for k, v in a.items() if k not in (
                "_id", "id", "activity_type", "title", "timestamp", "details",
                "entity_name", "entity_kind", "lead_id", "performed_by", "email",
                "created_at", "meta")},
            startup_id=a.get("startup_id") or a.get("entity_startup_id"),
        )
        add_event(event)

    lead_fields = {
        "id": 1, "incubator_name": 1, "incubator_id": 1, "email": 1,
        "reply_detected_at": 1, "reply_text": 1, "intent_classification": 1,
        "lead_score": 1, "reply_sentiment": 1, "sent_at": 1,
        "last_contact_reason": 1, "last_followup_at": 1, "followup_count": 1,
        "startup_id": 1, "entity_startup_id": 1,
    }
    for lead in db["outreach_leads"].find({}, lead_fields):
        ename = lead.get("incubator_name") or ""
        ekind = _entity_kind(lead)
        if lead.get("reply_detected_at"):
            raw = clean_email_reply(lead.get("reply_text") or "")
            add_event(_feed_event(
                activity_type="email_received",
                title="Email received",
                timestamp=lead.get("reply_detected_at"),
                details=raw or (lead.get("reply_text") or "Reply received."),
                entity_name=ename,
                entity_kind=ekind,
                lead_id=lead.get("id"),
                email=lead.get("email"),
                extra={"intent": lead.get("intent_classification") or "",
                       "score": lead.get("lead_score") or "",
                       "sentiment": lead.get("reply_sentiment") or ""},
                startup_id=lead.get("startup_id") or lead.get("entity_startup_id"),
            ))
        if lead.get("sent_at"):
            add_event(_feed_event(
                activity_type="outreach_sent",
                title="Email dispatched",
                timestamp=lead.get("sent_at"),
                details=lead.get("last_contact_reason") or "Outreach email sent.",
                entity_name=ename,
                entity_kind=ekind,
                lead_id=lead.get("id"),
                email=lead.get("email"),
                startup_id=lead.get("startup_id") or lead.get("entity_startup_id"),
            ))
        if lead.get("last_followup_at"):
            add_event(_feed_event(
                activity_type="followup_sent",
                title=f"Follow-up #{(lead.get('followup_count') or 0)} sent",
                timestamp=lead.get("last_followup_at"),
                details="Automated follow-up dispatched.",
                entity_name=ename,
                entity_kind=ekind,
                lead_id=lead.get("id"),
                email=lead.get("email"),
                startup_id=lead.get("startup_id") or lead.get("entity_startup_id"),
            ))

    for m in db["scheduled_meetings"].find({"date": {"$nin": ["", None]}}).sort("date", -1).limit(budget):
        ts = f"{m.get('date')}T{m.get('time')}" if m.get("date") else None
        add_event(_feed_event(
            activity_type="meeting_scheduled",
            title=f"Meeting: {m.get('title') or 'Scheduled'}",
            timestamp=ts,
            details=f"Meeting for {m.get('date')}, {m.get('time')}.",
            entity_name=m.get("incubator_name") or "",
            entity_kind=_entity_kind(m) if m.get("incubator_id") else "incubation",
            lead_id=m.get("lead_id") or "",
            email="",
            extra={"meeting_id": m.get("id"), "meeting_link": m.get("meeting_link") or m.get("link") or "",
                   "date": m.get("date"), "time": m.get("time")},
            startup_id=m.get("startup_id") or m.get("entity_startup_id"),
        ))

    crm_logs = list(db["crm_activity"].find({}).sort("created_at", -1).limit(budget))
    startup_map = {s.get("id"): s for s in db["crm_startups"].find({}, {"id": 1, "name": 1})}
    by_module = {}
    for a in crm_logs:
        if a.get("module") and a.get("record_id") is not None:
            by_module.setdefault(a["module"], []).append(a["record_id"])
    target_sid = {}
    for module, ids in by_module.items():
        try:
            coll = db[f"crm_{module}"]
        except Exception:
            continue
        for rec in coll.find({"id": {"$in": ids}}, {"id": 1, "startup_id": 1}):
            target_sid.setdefault(module, {})[rec.get("id")] = rec.get("startup_id")
    for a in crm_logs:
        sid = None
        if a.get("module") and a.get("record_id") is not None:
            sid = target_sid.get(a["module"], {}).get(a.get("record_id"))
        sname = startup_map.get(sid, {}).get("name") if sid else ""
        add_event(_feed_event(
            activity_type=f"crm_{a.get('module', 'execution')}",
            title=f"{a.get('module', 'Execution')}: {a.get('action', 'update')}",
            timestamp=a.get("created_at"),
            details=a.get("summary") or "",
            entity_name=sname or "",
            entity_kind="startup",
            lead_id="",
            email="",
            performed_by="",
            extra={"module": a.get("module"), "record_id": a.get("record_id")},
            startup_id=sid,
        ))

    valid = [e for e in events if e.get("timestamp")]
    valid.sort(key=lambda e: str(e["timestamp"]), reverse=True)
    deduped = []
    seen = set()
    for e in valid:
        key = (
            e.get("type"),
            e.get("title"),
            e.get("timestamp"),
            e.get("entity_name"),
            e.get("details"),
            e.get("lead_id"),
            e.get("email"),
            e.get("performed_by"),
            e.get("startup_id"),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(e)
    return {"events": deduped[:limit], "total": len(deduped)}


def _feed_event(id="", activity_type="activity", title="", timestamp="", details="",
                entity_name="", entity_kind="startup", lead_id="", email="",
                performed_by="Incubein Team", extra=None, startup_id=None):
    if not id:
        seed = f"{activity_type}:{lead_id}:{timestamp}:{title}"
        id = "ev_" + hashlib.md5(seed.encode()).hexdigest()[:10]
    out = {
        "id": id or f"ev_{uuid.uuid4().hex[:10]}",
        "type": activity_type,
        "title": title,
        "timestamp": timestamp,
        "details": details or "",
        "entity_name": entity_name or "—",
        "entity_kind": entity_kind or "startup",
        "lead_id": lead_id or "",
        "performed_by": performed_by,
        "email": email or "",
        "startup_id": startup_id,
        "extra": extra or {},
    }
    if startup_id is not None:
        out["extra"] = {**out["extra"], "startup_id": startup_id}
    return out
