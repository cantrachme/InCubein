import os
import re
import json
import uuid
import threading
import time
import imaplib
import email
from email.header import decode_header
from datetime import datetime
from typing import Optional, List

from ..core import config
from ..core.database import get_db_connection, get_mongo_db
from ..core.exceptions import NotFoundError, BadRequestError
from ..schemas.outreach import (
    AddLeadRequest,
    UpdateLeadStatusRequest,
    UpdateLeadNotesRequest,
    UpdateStageRequest,
    OutreachEmailRequest,
    MassSendRequest,
    FollowupEmailRequest,
    OutreachConfig,
)
from .email import get_smtp_config, send_outreach_single, send_plain_email
from .settings import get_settings, get_setting, update_settings
from .templates import get_email_template, get_default_template, render_template, interpolate_variables, resolve_template_attachments
from .email_logs import log_email_send


def seed_outreach_leads():
    """Initializes outreach_leads DB table schema. Targeted outreach leads are added dynamically by the user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS outreach_leads (
            id TEXT PRIMARY KEY,
            incubator_id TEXT,
            incubator_name TEXT,
            email TEXT,
            status TEXT DEFAULT 'Draft',
            lead_score INTEGER DEFAULT 0,
            contact_count INTEGER DEFAULT 0,
            last_contact_reason TEXT,
            next_action_date TEXT,
            sent_at TEXT,
            nurture_start_date TEXT,
            nurture_cycle_days INTEGER DEFAULT 90,
            reply_text TEXT,
            reply_detected_at TEXT,
            intent_classification TEXT,
            meeting_link TEXT,
            meeting_scheduled_at TEXT,
            notes TEXT,
            is_read INTEGER DEFAULT 0,
            followup_count INTEGER DEFAULT 0
        )
    ''')
    conn.commit()
    # Migration: add columns if missing (existing DBs)
    for col_def in [
        "ALTER TABLE outreach_leads ADD COLUMN is_read INTEGER DEFAULT 0",
        "ALTER TABLE outreach_leads ADD COLUMN followup_count INTEGER DEFAULT 0",
        "ALTER TABLE outreach_leads ADD COLUMN reply_sentiment TEXT",
        "ALTER TABLE outreach_leads ADD COLUMN reply_urgency TEXT",
        "ALTER TABLE outreach_leads ADD COLUMN reply_reason TEXT",
        "ALTER TABLE outreach_leads ADD COLUMN last_followup_at TEXT",
    ]:
        try:
            cursor.execute(col_def)
        except Exception:
            pass
    conn.commit()
    conn.close()


def get_outreach_leads():
    seed_outreach_leads()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def _unreplied_filter():
    return {
        "status": {"$in": ["Sent", "Follow-up Sent"]},
        "reply_text": {"$in": [None, ""]},
        "reply_detected_at": {"$in": [None, ""]},
    }


def _fetch_unreplied_leads(startup: bool):
    """Leads that were contacted but never replied to or engaged.

    ``startup=True`` scopes to the Startup Cohort (incubein_cohort),
    otherwise to the Incubator Network."""
    db = get_mongo_db()
    query = _unreplied_filter()
    if startup:
        query["incubator_id"] = "incubein_cohort"
    else:
        query["incubator_id"] = {"$ne": "incubein_cohort"}
    return [dict(doc) for doc in db["outreach_leads"].find(query).sort("sent_at", -1)]


def get_unreplied_leads():
    db = get_mongo_db()
    rows = [dict(doc) for doc in db["outreach_leads"].find(_unreplied_filter()).sort("sent_at", -1)]
    for row in rows:
        row["_id"] = str(row.get("_id", ""))
    return rows


def delete_outreach_lead(lead_id):
    """Permanently removes a lead and its scheduled meetings (targeted-list removal)."""
    db = get_mongo_db()
    lead = db["outreach_leads"].find_one({"id": lead_id})
    if not lead:
        raise NotFoundError("Lead not found")
    db["outreach_leads"].delete_many({"id": lead_id})
    db["scheduled_meetings"].delete_many({"lead_id": lead_id})
    return {
        "status": "success",
        "message": f"Removed {lead.get('incubator_name', lead_id)} from targeted outreach.",
    }


def funnel_lead_to_nurture(lead_id):
    """Moves a non-responsive lead into the 90-day nurturing sequence."""
    db = get_mongo_db()
    lead = db["outreach_leads"].find_one({"id": lead_id})
    if not lead:
        raise NotFoundError("Lead not found")
    today = datetime.now().strftime("%Y-%m-%d")
    prev_notes = lead.get("notes") or ""
    note = f"Funneled into 90-day nurturing sequence on {today}."
    db["outreach_leads"].update_one(
        {"id": lead_id},
        {"$set": {
            "status": "In Loop",
            "nurture_start_date": today,
            "nurture_cycle_days": 90,
            "notes": f"{prev_notes}\n{note}" if prev_notes else note,
        }},
    )
    return {
        "status": "success",
        "message": f"{lead.get('incubator_name', lead_id)} moved into the nurturing sequence.",
    }


def add_outreach_lead(req: AddLeadRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if already exists in campaign
    cursor.execute("SELECT COUNT(*) FROM outreach_leads WHERE incubator_id = ?", (req.incubator_id,))
    id_exists = cursor.fetchone()[0] > 0

    cursor.execute("SELECT COUNT(*) FROM outreach_leads WHERE email = ?", (req.email,))
    email_exists = cursor.fetchone()[0] > 0

    if id_exists or email_exists:
        conn.close()
        return {"status": "exists", "message": "Lead already exists in campaign leads."}

    lead_id = f"lead_{uuid.uuid4().hex[:8]}"
    cursor.execute('''
        INSERT INTO outreach_leads (id, incubator_id, incubator_name, email, status, lead_score, contact_count, last_contact_reason, next_action_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (lead_id, req.incubator_id, req.incubator_name, req.email, 'Draft', 0, 0, 'None', ''))

    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Successfully added {req.incubator_name} to campaigns.", "lead_id": lead_id}


def reset_outreach():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM scheduled_meetings")
    cursor.execute("DELETE FROM outreach_leads")
    conn.commit()
    conn.close()
    seed_outreach_leads()
    return {"status": "success", "message": "Campaign data successfully reset."}


def mark_all_leads_as_sent():
    """Bulk update all Draft leads to Sent status."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "UPDATE outreach_leads SET status = 'Sent', sent_at = ? WHERE status = 'Draft'",
        (now,)
    )
    updated = cursor.rowcount
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Marked {updated} lead(s) as Sent.", "updated_count": updated}


def update_lead_status(req: UpdateLeadStatusRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise NotFoundError("Lead not found")
    cursor.execute("UPDATE outreach_leads SET status = ? WHERE id = ?", (req.status, req.lead_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Campaign lead status updated to {req.status}."}


def update_lead_notes(req: UpdateLeadNotesRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise NotFoundError("Lead not found")
    if req.next_action_date is not None:
        cursor.execute("UPDATE outreach_leads SET notes = ?, next_action_date = ? WHERE id = ?", (req.notes, req.next_action_date, req.lead_id))
    else:
        cursor.execute("UPDATE outreach_leads SET notes = ? WHERE id = ?", (req.notes, req.lead_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Campaign lead notes updated successfully."}


def update_collaboration_stage(req: UpdateStageRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise NotFoundError("Lead not found")

    if req.notes is not None:
        cursor.execute("UPDATE outreach_leads SET status = ?, notes = ? WHERE id = ?", (req.stage, req.notes, req.lead_id))
    else:
        cursor.execute("UPDATE outreach_leads SET status = ? WHERE id = ?", (req.stage, req.lead_id))

    conn.commit()
    conn.close()


def clean_email_reply(text: str) -> str:
    if not text:
        return ""
    lines = []
    thread_indicators = [
        "on ", "wrote:", "-----original message-----", "from:", "to:", "sent:"
    ]
    for line in text.splitlines():
        line_strip = line.strip()
        # Skip quoted lines in email threads
        if line_strip.startswith(">"):
            continue
        # Stop processing if we hit the beginning of the reply/forward thread history
        line_lower = line_strip.lower()
        if any(indicator in line_lower for indicator in thread_indicators) and ("@" in line_lower or "," in line_lower or ":" in line_lower):
            break
        lines.append(line)
    return "\n".join(lines).strip()


def _pick_template(entity_kind: str, template_key: str = None) -> dict:
    """Resolves the email template for an entity (startup/incubator).

    Priority: explicitly chosen template key -> configured default for the
    kind -> first default template of the matching category.
    """
    tpl = None
    if template_key:
        tpl = get_email_template(template_key)
    if not tpl:
        if entity_kind == "startup":
            tpl = get_email_template(get_setting("default_template_startup", "")) or get_default_template("startups")
        else:
            tpl = get_email_template(get_setting("default_template_incubator", "")) or get_default_template("incubators")
    return tpl


def _context_for_entity(lead: dict, extra: dict = None) -> dict:
    context = {
        "StartupName": lead.get("incubator_name", ""),
        "IncubatorName": lead.get("incubator_name", ""),
        "EntityName": lead.get("incubator_name", ""),
    }
    if extra:
        context.update(extra)
    return context


def get_lead_timeline(lead_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (lead_id,))
    lead_row = cursor.fetchone()
    if not lead_row:
        conn.close()
        raise NotFoundError("Lead not found")

    lead = dict(lead_row)

    cursor.execute("SELECT * FROM scheduled_meetings WHERE lead_id = ? OR incubator_name = ?", (lead_id, lead["incubator_name"]))
    meetings = [dict(r) for r in cursor.fetchall()]

    conn.close()

    timeline = []

    timeline.append({
        "type": "ranked",
        "title": "📌 Indexed & Evaluated",
        "timestamp": lead.get("sent_at") or "Initial Setup",
        "details": f"Entity {lead['incubator_name']} indexed in ecosystem intelligence platform."
    })

    if lead.get("sent_at") or lead.get("contact_count", 0) > 0:
        cnt = lead.get("contact_count", 1)
        timeline.append({
            "type": "outreach",
            "title": f"📤 Outreach Email Dispatched (Contact Count: {cnt})",
            "timestamp": lead.get("sent_at") or "Recently",
            "details": f"Outreach email campaign sent to {lead['email']}."
        })

    if lead.get("followup_count", 0) > 0:
        timeline.append({
            "type": "followup",
            "title": f"🔄 Follow-up Dispatched (#{lead['followup_count']})",
            "timestamp": lead.get("last_followup_at") or "Recently",
            "details": f"Automated follow-up email sent to {lead['email']}."
        })

    if lead.get("reply_detected_at") or lead.get("reply_text"):
        raw_reply = lead.get("reply_text") or ""
        clean_text = clean_email_reply(raw_reply) if raw_reply else "Entity responded to outreach email."
        if not clean_text:
            clean_text = raw_reply

        quoted_history = ""
        if raw_reply and clean_text and len(raw_reply) > len(clean_text):
            quoted_history = raw_reply[len(clean_text):].strip()

        intent = lead.get("intent_classification")
        lead_score = lead.get("lead_score") or 50

        raw_lower = raw_reply.lower()
        if not intent or intent == "Neutral":
            if any(k in raw_lower for k in ["meet", "schedule", "call", "available", "zoom", "google meet", "calendar"]):
                intent = "Meeting Requested"
                lead_score = max(lead_score, 90)
                sentiment = "Highly Interested"
            elif any(k in raw_lower for k in ["interested", "collaborate", "partnership", "mou", "yes"]):
                intent = "Positive Response"
                lead_score = max(lead_score, 75)
                sentiment = "Interested"
            elif any(k in raw_lower for k in ["not interested", "no thanks", "unsubscribe"]):
                intent = "Not Interested"
                lead_score = 10
                sentiment = "Uninterested"
            else:
                intent = "Information Received"
                sentiment = "Neutral"
        else:
            sentiment = "Highly Interested" if lead_score >= 80 else "Interested" if lead_score >= 60 else "Neutral"

        timeline.append({
            "type": "reply",
            "title": "📩 Email Reply Received & Analyzed",
            "timestamp": lead.get("reply_detected_at") or "Recently",
            "details": clean_text,
            "clean_text": clean_text,
            "quoted_history": quoted_history,
            "intent": intent,
            "score": lead_score,
            "sentiment": sentiment
        })

    for m in meetings:
        timeline.append({
            "type": "meeting",
            "title": f"📅 Meeting Booked ({m.get('status', 'Scheduled')})",
            "timestamp": f"{m.get('meeting_date', '')} {m.get('meeting_time', '')}".strip() or "Scheduled",
            "details": f"Subject: {m.get('subject', 'Strategic Meeting')} | Meeting Link: {m.get('meeting_link') or 'Google Meet'}"
        })

    if lead.get("notes"):
        timeline.append({
            "type": "notes",
            "title": "📝 Progress Notes & Collected Info",
            "timestamp": "Latest Notes",
            "details": lead.get("notes")
        })

    if lead.get("status") in ["MOUs", "Incubated", "TBI Partnership"]:
        timeline.append({
            "type": "collaboration",
            "title": f"🤝 Collaboration Stage: {lead['status']}",
            "timestamp": "Active",
            "details": f"Entity active in stage {lead['status']}."
        })

    return {
        "lead": lead,
        "meetings": meetings,
        "timeline": timeline
    }


def trigger_outreach_email(req: OutreachEmailRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise NotFoundError("Lead not found")

    smtp_cfg = get_smtp_config(req.mail_account)
    sender_email = smtp_cfg["sender_email"]

    lead_name = lead["incubator_name"]
    is_startup = lead["incubator_id"] == "incubein_cohort"

    subject = req.subject
    body_text = req.body
    template_key = getattr(req, "template_id", None) or ""

    tpl = None
    if template_key:
        tpl = get_email_template(template_key)

    if not subject or not body_text:
        entity_kind = "startup" if is_startup else "incubator"
        tpl = tpl or _pick_template(entity_kind, template_key)
        if tpl:
            rendered = render_template(tpl, _context_for_entity(lead))
            subject = subject or rendered["subject"]
            body_text = body_text or rendered["body"]
            if not template_key:
                template_key = tpl.get("key", "")

    if not subject or not body_text:
        conn.close()
        raise BadRequestError("No subject/body provided and no matching template found.")

    context = _context_for_entity(lead)
    subject = interpolate_variables(subject, context)
    body_text = interpolate_variables(body_text, context)

    cc = (req.cc or "").strip()
    bcc = (req.bcc or "").strip()
    if tpl:
        cc = cc or (tpl.get("cc") or "").strip()
        bcc = bcc or (tpl.get("bcc") or "").strip()
    cc = interpolate_variables(cc, context) if cc else ""
    bcc = interpolate_variables(bcc, context) if bcc else ""
    attachments = resolve_template_attachments(template_key) if template_key else []

    email_sent_successfully = send_outreach_single(
        smtp_cfg, sender_email, lead["email"], subject, body_text, cc=cc, bcc=bcc, attachments=attachments
    )

    cursor.execute(
        "UPDATE outreach_leads SET status = 'Sent', sent_at = ?, contact_count = coalesce(contact_count, 0) + 1, last_contact_reason = ? WHERE id = ?",
        (datetime.now().isoformat(), subject or "Outreach Email", req.lead_id)
    )
    conn.commit()
    conn.close()

    log_email_send(
        recipient_email=lead["email"],
        recipient_name=lead_name,
        subject=subject,
        template_key=template_key,
        kind="outreach",
        status="sent" if email_sent_successfully else "simulated",
    )

    msg_status = "Real email sent via SMTP" if email_sent_successfully else "SMTP not configured, simulated sending"
    return {"status": "success", "message": f"Outreach email campaign successfully triggered for {lead['incubator_name']} ({msg_status})."}


def send_followup_email(lead_id: str, lead_name: str, lead_email: str, followup_number: int):
    smtp_cfg = get_smtp_config()
    sender_email = smtp_cfg["sender_email"]

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (lead_id,))
    lead_row = cursor.fetchone()
    conn.close()

    is_startup = bool(lead_row and lead_row["incubator_id"] == "incubein_cohort")
    lead = {"incubator_name": lead_name}

    entity_kind = "startup" if is_startup else "incubator"
    tpl = get_email_template(get_setting(f"default_template_{entity_kind}_followup", "")) or get_default_template("followup")

    if tpl:
        rendered = render_template(tpl, _context_for_entity(lead, {"FollowupNumber": followup_number}))
        subject = rendered["subject"]
        body_text = rendered["body"]
    else:
        subject = f"Following up: Introduction to Incubein Foundation – {lead_name} (Follow-up #{followup_number})"
        body_text = f"Dear {lead_name},\n\nGreetings from Incubein Foundation RTM Nagpur University.\n\nWe are following up on our previous email.\n\nWarm regards,\n\nTeam Incubein Foundation\n(Follow-up Reference #{followup_number})"

    email_sent_successfully = send_plain_email(
        smtp_cfg, sender_email, lead_email, subject, body_text, from_display="Incubein Outreach"
    )

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE outreach_leads 
        SET status = 'Follow-up Sent', 
            followup_count = ?, 
            last_followup_at = ? 
        WHERE id = ?
    ''', (followup_number, datetime.now().isoformat(), lead_id))
    conn.commit()
    conn.close()

    log_email_send(
        recipient_email=lead_email,
        recipient_name=lead_name,
        subject=subject,
        template_key=tpl.get("key", "") if tpl else "",
        kind="followup",
        status="sent" if email_sent_successfully else "simulated",
        details=f"Follow-up #{followup_number}",
    )

    return email_sent_successfully


def trigger_mass_send(req: MassSendRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Select all Draft leads of the target type
    if req.target_type == "unreplied_startups":
        leads = _fetch_unreplied_leads(startup=True)
    elif req.target_type == "unreplied_incubators":
        leads = _fetch_unreplied_leads(startup=False)
    elif req.target_type == "startups":
        cursor.execute("SELECT * FROM outreach_leads WHERE status = 'Draft' AND incubator_id = 'incubein_cohort'")
        leads = [dict(row) for row in cursor.fetchall()]
    else:
        cursor.execute("SELECT * FROM outreach_leads WHERE status = 'Draft' AND incubator_id != 'incubein_cohort'")
        leads = [dict(row) for row in cursor.fetchall()]

    leads = [dict(row) for row in leads]

    if not leads:
        conn.close()
        return {"status": "success", "message": f"No draft leads found for {req.target_type}.", "sent_count": 0}

    smtp_cfg = get_smtp_config(req.mail_account)
    sender_email = smtp_cfg["sender_email"]
    is_smtp_ready = smtp_cfg["is_smtp_ready"]

    settings = get_settings()
    batch_size = int(settings.get("scrape_batch_size", 8))
    batch_delay = int(settings.get("scrape_batch_delay_seconds", 15))

    entity_kind = "startup" if req.target_type in ("startups", "unreplied_startups") else "incubator"
    tpl = _pick_template(entity_kind, getattr(req, "template_id", None) or "")

    cc = (req.cc or "").strip()
    bcc = (req.bcc or "").strip()
    if tpl:
        cc = cc or (tpl.get("cc") or "").strip()
        bcc = bcc or (tpl.get("bcc") or "").strip()
    cc = interpolate_variables(cc, {"_settings": settings}) if cc else ""
    bcc = interpolate_variables(bcc, {"_settings": settings}) if bcc else ""
    template_key = tpl.get("key", "") if tpl else ""
    attachments = resolve_template_attachments(template_key) if template_key else []

    sent_count = 0
    simulated_count = 0
    processed = 0

    for lead in leads:
        ctx = _context_for_entity(lead)
        ctx["_settings"] = settings
        # Resolve subject/body: explicit overrides, else rendered template.
        subject_to_send = req.subject
        body_to_send = req.body
        if (not subject_to_send or not body_to_send) and tpl:
            rendered = render_template(tpl, ctx)
            subject_to_send = subject_to_send or rendered["subject"]
            body_to_send = body_to_send or rendered["body"]

        # Last-resort fallback so a lead is never emailed blank.
        if not subject_to_send:
            subject_to_send = f"Introduction to Incubein Foundation"
        if not body_to_send:
            body_to_send = f"Hello {lead['incubator_name']},\n\nGreetings from Incubein Foundation RTM Nagpur University.\n\nWe would love to schedule a 30-minute Google Meet at your convenience.\n\nWarm regards,\n\nTeam Incubein Foundation"

        # Interpolate any remaining placeholders (names, org branding, etc.)
        subject_to_send = interpolate_variables(subject_to_send, ctx)
        body_to_send = interpolate_variables(body_to_send, ctx)

        email_sent = False
        if is_smtp_ready:
            email_sent = send_outreach_single(
                smtp_cfg, sender_email, lead["email"], subject_to_send, body_to_send, cc=cc, bcc=bcc, attachments=attachments
            )
            if email_sent:
                sent_count += 1
            else:
                simulated_count += 1
        else:
            simulated_count += 1

        log_email_send(
            recipient_email=lead["email"],
            recipient_name=lead["incubator_name"],
            subject=subject_to_send,
            template_key=tpl.get("key", "") if tpl else "",
            kind="mass",
            status="sent" if email_sent else "simulated",
            details=f"Mass send ({req.target_type})",
        )

        # Update lead in DB
        cursor.execute(
            "UPDATE outreach_leads SET status = 'Sent', sent_at = ?, contact_count = coalesce(contact_count, 0) + 1, last_contact_reason = ? WHERE id = ?",
            (datetime.now().isoformat(), subject_to_send or "Mass Outreach Email", lead["id"])
        )

        processed += 1
        if processed % batch_size == 0 and batch_delay > 0:
            conn.commit()
            time.sleep(batch_delay)

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "sent_count": sent_count,
        "simulated_count": simulated_count,
        "message": f"Successfully processed mass send for {len(leads)} {req.target_type} ({sent_count} real emails, {simulated_count} simulated)."
    }


def dispatch_campaign(campaign_id: str):
    """Dispatches an email campaign to its target audience with batching.

    Supported target_type values:
      - "all_startups"      : every Draft startup lead in outreach_leads
      - "all_incubators"    : every Draft incubator lead in outreach_leads
      - "lead:<lead_id>"    : a single existing outreach lead
      - "custom:<email>"    : an arbitrary recipient
    """
    from .campaigns import get_campaign, update_campaign

    campaign = get_campaign(campaign_id)
    if not campaign:
        raise NotFoundError("Campaign not found")

    if campaign.get("status") not in ("draft", "paused"):
        raise BadRequestError(f"Campaign status is '{campaign.get('status')}'. Only draft/paused campaigns can be dispatched.")

    target_type = campaign.get("target_type") or "all_startups"
    subject = campaign.get("subject") or ""
    body = campaign.get("body") or ""
    cc = campaign.get("cc") or ""
    bcc = campaign.get("bcc") or ""
    template_key = campaign.get("template_id") or ""

    leads = []
    if target_type == "all_startups":
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM outreach_leads WHERE status = 'Draft' AND incubator_id = 'incubein_cohort'")
        leads = [dict(row) for row in cursor.fetchall()]
        conn.close()
        entity_kind = "startup"
    elif target_type == "all_incubators":
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM outreach_leads WHERE status = 'Draft' AND incubator_id != 'incubein_cohort'")
        leads = [dict(row) for row in cursor.fetchall()]
        conn.close()
        entity_kind = "incubator"
    elif target_type == "unreplied_startups":
        leads = _fetch_unreplied_leads(startup=True)
        entity_kind = "startup"
    elif target_type == "unreplied_incubators":
        leads = _fetch_unreplied_leads(startup=False)
        entity_kind = "incubator"
    elif target_type.startswith("lead:"):
        lead_id = target_type.split(":", 1)[1]
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (lead_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            leads = [dict(row)]
        entity_kind = "startup" if leads and leads[0].get("incubator_id") == "incubein_cohort" else "incubator"
    elif target_type.startswith("custom:"):
        email = target_type.split(":", 1)[1].strip()
        if email:
            leads = [{"id": None, "incubator_name": email, "email": email, "incubator_id": "custom"}]
        entity_kind = "startup"
    else:
        raise BadRequestError(f"Unsupported campaign target_type '{target_type}'.")

    if not leads:
        update_campaign(campaign_id, {"status": "completed"})
        return {"status": "success", "sent_count": 0, "simulated_count": 0, "message": "No recipients matched for this campaign."}

    smtp_cfg = get_smtp_config()
    sender_email = smtp_cfg["sender_email"]
    is_smtp_ready = smtp_cfg["is_smtp_ready"]

    settings = get_settings()
    batch_size = int(campaign.get("batch_size") or settings.get("scrape_batch_size", 8))
    batch_delay = int(campaign.get("delay_seconds") or settings.get("scrape_batch_delay_seconds", 15))

    tpl = None
    if template_key:
        tpl = get_email_template(template_key)
    if not tpl:
        tpl = _pick_template(entity_kind, None)

    cc = (cc or "").strip() or ((tpl.get("cc") or "").strip() if tpl else "")
    bcc = (bcc or "").strip() or ((tpl.get("bcc") or "").strip() if tpl else "")
    cc = interpolate_variables(cc, {"_settings": settings}) if cc else ""
    bcc = interpolate_variables(bcc, {"_settings": settings}) if bcc else ""
    attachments = resolve_template_attachments(tpl.get("key", "")) if tpl else []

    update_campaign(campaign_id, {"status": "sending"})

    sent_count = 0
    simulated_count = 0
    processed = 0

    for lead in leads:
        ctx = _context_for_entity(lead)
        ctx["_settings"] = settings
        subject_to_send = subject
        body_to_send = body
        if (not subject_to_send or not body_to_send) and tpl:
            rendered = render_template(tpl, ctx)
            subject_to_send = subject_to_send or rendered["subject"]
            body_to_send = body_to_send or rendered["body"]

        if not subject_to_send:
            subject_to_send = f"Introduction to Incubein Foundation"
        if not body_to_send:
            body_to_send = f"Hello {lead.get('incubator_name', '')},\n\nGreetings from Incubein Foundation RTM Nagpur University.\n\nWarm regards,\n\nTeam Incubein Foundation"

        # Interpolate any remaining placeholders (names, org branding, etc.)
        subject_to_send = interpolate_variables(subject_to_send, ctx)
        body_to_send = interpolate_variables(body_to_send, ctx)

        email_sent = False
        if is_smtp_ready:
            email_sent = send_outreach_single(smtp_cfg, sender_email, lead["email"], subject_to_send, body_to_send, cc=cc, bcc=bcc, attachments=attachments)
            if email_sent:
                sent_count += 1
            else:
                simulated_count += 1
        else:
            simulated_count += 1

        log_email_send(
            recipient_email=lead["email"],
            recipient_name=lead.get("incubator_name", ""),
            subject=subject_to_send,
            template_key=tpl.get("key", "") if tpl else "",
            campaign_id=campaign_id,
            kind="campaign",
            status="sent" if email_sent else "simulated",
        )

        if lead.get("id"):
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE outreach_leads SET status = 'Sent', sent_at = ?, contact_count = coalesce(contact_count, 0) + 1, last_contact_reason = ? WHERE id = ?",
                (datetime.now().isoformat(), subject_to_send or "Campaign Email", lead["id"])
            )
            conn.commit()
            conn.close()

        processed += 1
        if processed % batch_size == 0 and batch_delay > 0:
            time.sleep(batch_delay)

    update_campaign(campaign_id, {"status": "completed"})

    return {
        "status": "success",
        "campaign_id": campaign_id,
        "sent_count": sent_count,
        "simulated_count": simulated_count,
        "message": f"Campaign '{campaign.get('name')}' dispatched to {len(leads)} recipient(s) ({sent_count} real emails, {simulated_count} simulated)."
    }


def send_followup_single(req: FollowupEmailRequest):
    if get_setting("followups_paused", True):
        raise BadRequestError("Follow-up emails are permanently paused. Resume follow-ups in the Outreach Automation controls to proceed.")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise NotFoundError("Lead not found")

    lead = dict(lead)
    current_count = lead.get("followup_count", 0) or 0

    if lead["status"] not in ["Sent", "Follow-up Sent"]:
        conn.close()
        raise BadRequestError(f"Lead status is '{lead['status']}'. Can only follow up on Sent or Follow-up Sent leads.")

    next_count = current_count + 1
    if next_count > 2:
        conn.close()
        raise BadRequestError("Maximum follow-ups (2) already reached for this lead.")

    conn.close()

    email_sent = send_followup_email(lead["id"], lead["incubator_name"], lead["email"], next_count)
    msg_status = "Real email sent via SMTP" if email_sent else "SMTP not configured, simulated sending"

    return {
        "status": "success",
        "message": f"Follow-up #{next_count} successfully triggered for {lead['incubator_name']} ({msg_status}).",
        "followup_count": next_count
    }


def send_followups():
    if get_setting("followups_paused", True):
        return {
            "status": "paused",
            "checked_at": datetime.now().isoformat(),
            "followups_sent_count": 0,
            "dispatched": [],
            "message": "Follow-up emails are permanently paused. Resume follow-ups in the Outreach Automation controls to proceed."
        }

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM outreach_leads WHERE status IN ('Sent', 'Follow-up Sent')")
    leads = [dict(row) for row in cursor.fetchall()]

    dispatched = []
    now = datetime.now()
    followup_delay = int(get_setting("followup_delay", 120))

    for lead in leads:
        last_time_str = lead.get("last_followup_at") or lead.get("sent_at")
        if not last_time_str:
            continue

        try:
            last_time = datetime.fromisoformat(last_time_str)
            elapsed_seconds = (now - last_time).total_seconds()

            if elapsed_seconds >= followup_delay:
                current_count = lead.get("followup_count", 0) or 0
                next_count = current_count + 1

                if next_count <= 2:
                    email_sent = send_followup_email(lead["id"], lead["incubator_name"], lead["email"], next_count)
                    msg_status = "SMTP Sent" if email_sent else "Simulated"
                    dispatched.append({
                        "id": lead["id"],
                        "incubator_name": lead["incubator_name"],
                        "email": lead["email"],
                        "followup_number": next_count,
                        "status": msg_status
                    })
        except Exception as e:
            print(f"Error parsing date/sending follow-up for lead {lead['email']}: {e}")

    conn.close()
    return {
        "status": "success",
        "checked_at": now.isoformat(),
        "followups_sent_count": len(dispatched),
        "dispatched": dispatched
    }


def check_and_send_followups_sync():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE status IN ('Sent', 'Follow-up Sent')")
    leads = [dict(row) for row in cursor.fetchall()]

    now = datetime.now()
    followup_delay = int(get_setting("followup_delay", 120))
    for lead in leads:
        last_time_str = lead.get("last_followup_at") or lead.get("sent_at")
        if not last_time_str:
            continue

        try:
            last_time = datetime.fromisoformat(last_time_str)
            elapsed_seconds = (now - last_time).total_seconds()
            if elapsed_seconds >= followup_delay:
                current_count = lead.get("followup_count", 0) or 0
                next_count = current_count + 1
                if next_count <= 2:
                    print(f"Background daemon: Triggering follow-up #{next_count} for {lead['incubator_name']} ({lead['email']})")
                    send_followup_email(lead["id"], lead["incubator_name"], lead["email"], next_count)
        except Exception as e:
            print(f"Background daemon error sending follow-up: {e}")

    conn.close()


def process_reply(lead_id: str, reply_text: str):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        return None

    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    api_key = os.environ.get("GEMINI_API_KEY")
    intent = "Neutral"
    score = 50
    summary = "Acknowledge receipt and waiting for more context."
    sentiment = "Neutral"
    urgency = "Low"
    reason_code = "Other"

    analyzed = False
    cleaned_reply = clean_email_reply(reply_text)

    # Try OpenRouter first
    if openrouter_key and "your_openrouter" not in openrouter_key:
        try:
            import requests
            prompt = f"""
            You are the AI Intent Classifier and Sentiment Analyzer for the Indian Startup Ecosystem Outreach System.
            Analyze the following email reply from an incubator and output a JSON object containing:
            1. "intent": One of "Positive", "Neutral", "Negative", "Information Request"
            2. "score": An interest score from 0 to 100 representing how eager they are to collaborate/arrange a meeting. (e.g. "we would love to meet" = 90+, "tell me more" = 60-79, "no thanks" = <30).
            3. "summary": A 1-sentence summary of their response.
            4. "sentiment": One of "Highly Interested", "Tentative", "Uninterested", "Requires Clarification"
            5. "urgency": One of "High", "Medium", "Low"
            6. "reason_code": One of "Wants to meet", "Wants more details", "Too busy/Not now", "Wrong contact person", "Not interested", "Other"

            Reply text: "{cleaned_reply}"

            Output ONLY valid JSON.
            """

            # We can try a few models to be robust
            models_to_try = [
                "google/gemini-2.5-flash",
                "meta-llama/llama-3-8b-instruct:free",
                "google/gemma-2-9b-it:free"
            ]

            for model in models_to_try:
                try:
                    response = requests.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openrouter_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": model,
                            "messages": [
                                {"role": "user", "content": prompt}
                            ],
                            "temperature": 0.1
                        },
                        timeout=12
                    )
                    if response.status_code == 200:
                        result_data = response.json()
                        result_text = result_data["choices"][0]["message"]["content"].strip()
                        if "```json" in result_text:
                            result_text = result_text.split("```json")[1].split("```")[0].strip()
                        elif "```" in result_text:
                            result_text = result_text.split("```")[1].split("```")[0].strip()

                        res = json.loads(result_text)
                        intent = res.get("intent", intent)
                        score = int(res.get("score", score))
                        summary = res.get("summary", summary)
                        sentiment = res.get("sentiment", sentiment)
                        urgency = res.get("urgency", urgency)
                        reason_code = res.get("reason_code", reason_code)
                        analyzed = True
                        print(f"OpenRouter analyzed reply successfully using {model}.")
                        break
                except Exception as model_err:
                    print(f"OpenRouter model {model} failed: {model_err}")
        except Exception as e:
            print("OpenRouter classification failed:", e)

    # Try Gemini fallback if OpenRouter did not succeed
    if not analyzed and api_key and "your_gemini" not in api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')

            prompt = f"""
            You are the AI Intent Classifier and Sentiment Analyzer for the Indian Startup Ecosystem Outreach System.
            Analyze the following email reply from an incubator and output a JSON object containing:
            1. "intent": One of "Positive", "Neutral", "Negative", "Information Request"
            2. "score": An interest score from 0 to 100 representing how eager they are to collaborate/arrange a meeting. (e.g. "we would love to meet" = 90+, "tell me more" = 60-79, "no thanks" = <30).
            3. "summary": A 1-sentence summary of their response.
            4. "sentiment": One of "Highly Interested", "Tentative", "Uninterested", "Requires Clarification"
            5. "urgency": One of "High", "Medium", "Low"
            6. "reason_code": One of "Wants to meet", "Wants more details", "Too busy/Not now", "Wrong contact person", "Not interested", "Other"

            Reply text: "{cleaned_reply}"

            Output ONLY valid JSON.
            """
            response = model.generate_content(prompt)
            result_text = response.text.strip()
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()

            res = json.loads(result_text)
            intent = res.get("intent", intent)
            score = int(res.get("score", score))
            summary = res.get("summary", summary)
            sentiment = res.get("sentiment", sentiment)
            urgency = res.get("urgency", urgency)
            reason_code = res.get("reason_code", reason_code)
            analyzed = True
        except Exception as e:
            print("Gemini analysis error:", e)

    # Local fallback rules
    if not analyzed or score == 50:
        reply_lower = cleaned_reply.lower()

        negative_keywords = [
            r"not\s+interested",
            r"not\s+intrested",
            r"uninterested",
            r"no\s+interest",
            r"no\s+thanks",
            r"\bno\b",
            r"decline",
            r"sorry",
            r"cannot",
            r"cancel",
            r"busy",
            r"unable",
            r"not\s+looking"
        ]

        positive_keywords = [
            r"love\s+to",
            r"excited",
            r"schedule",
            r"meeting",
            r"meet",
            r"calendar",
            r"join",
            r"interested",
            r"sure",
            r"definitely",
            r"yes",
            r"great",
            r"mou"
        ]

        info_keywords = [
            r"what",
            r"how",
            r"information",
            r"details",
            r"docs",
            r"document",
            r"questions",
            r"send\s+me"
        ]

        if any(re.search(pat, reply_lower) for pat in negative_keywords):
            intent = "Negative"
            score = 15
            summary = "Declined the collaboration proposal."
            sentiment = "Uninterested"
            urgency = "Low"
            reason_code = "Not interested"
        elif any(re.search(pat, reply_lower) for pat in positive_keywords):
            intent = "Positive"
            score = 90
            summary = "Expressed strong interest and requested to schedule a meeting."
            sentiment = "Highly Interested"
            urgency = "High"
            reason_code = "Wants to meet"
        elif any(re.search(pat, reply_lower) for pat in info_keywords):
            intent = "Information Request"
            score = 70
            summary = "Requested additional information or documentation."
            sentiment = "Tentative"
            urgency = "Medium"
            reason_code = "Wants more details"

    meeting_details = None
    meeting_link = None
    meeting_scheduled_at = None

    if score < 30:
        new_status = 'Not Interested'
    else:
        new_status = 'Replied'

    cursor.execute('''
        UPDATE outreach_leads 
        SET status = ?, 
            reply_text = ?, 
            reply_detected_at = ?, 
            intent_classification = ?, 
            lead_score = ?,
            meeting_link = ?,
            meeting_scheduled_at = ?,
            reply_sentiment = ?,
            reply_urgency = ?,
            reply_reason = ?
        WHERE id = ?
    ''', (
        new_status,
        reply_text,
        datetime.now().isoformat(),
        intent,
        score,
        meeting_link if meeting_link else lead["meeting_link"],
        meeting_scheduled_at if meeting_scheduled_at else lead["meeting_scheduled_at"],
        sentiment,
        urgency,
        reason_code,
        lead_id
    ))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "lead_status": new_status,
        "intent": intent,
        "score": score,
        "summary": summary,
        "sentiment": sentiment,
        "urgency": urgency,
        "reason_code": reason_code,
        "meeting": meeting_details
    }


def process_outreach_reply(req):
    res = process_reply(req.lead_id, req.reply_text)
    if not res:
        raise NotFoundError("Lead not found")
    return res


def extract_email_address(from_header):
    if not from_header:
        return ""
    match = re.search(r'<([^>]+)>', from_header)
    if match:
        return match.group(1).strip().lower()
    # Remove surrounding quotes if any
    return from_header.strip().strip('"').strip("'").lower()


def get_imap_config(account: str = "default"):
    """Resolve IMAP credentials for the given mail account suffix."""
    if account and account.strip() not in ("", "default"):
        suffix = account.strip()
        host = os.environ.get(f"IMAP_HOST{suffix}")
        port = os.environ.get(f"IMAP_PORT{suffix}", "993")
        user = os.environ.get(f"IMAP_USER{suffix}")
        pwd = os.environ.get(f"IMAP_PASS{suffix}")
    else:
        host = os.environ.get("IMAP_HOST")
        port = os.environ.get("IMAP_PORT", "993")
        user = os.environ.get("IMAP_USER")
        pwd = os.environ.get("IMAP_PASS")

    if user:
        user = user.strip().strip('"').strip("'")
    if pwd:
        pwd = pwd.strip().strip('"').strip("'")

    return {
        "host": host,
        "port": int(port) if port else 993,
        "user": user,
        "password": pwd,
    }


def check_imap_replies_sync(mail_account: str = "default"):
    imap_cfg = get_imap_config(mail_account)
    imap_host = imap_cfg["host"]
    imap_port = imap_cfg["port"]
    imap_user = imap_cfg["user"]
    imap_pass = imap_cfg["password"]

    if not (imap_host and imap_user and imap_pass) or "your_email" in imap_user:
        print("IMAP parameters not configured or using placeholders. Skipping IMAP scan.")
        return []

    processed_replies = []
    try:
        print(f"Connecting to IMAP server {imap_host}:{imap_port} for user {imap_user}...")
        mail = imaplib.IMAP4_SSL(imap_host, int(imap_port))
        mail.login(imap_user, imap_pass)
        mail.select("inbox")

        # Search ALL messages in the inbox (Seen and Unseen)
        status, response = mail.search(None, "ALL")
        if status != "OK":
            mail.logout()
            print("IMAP search failed.")
            return []

        mail_ids = response[0].split()
        if not mail_ids:
            mail.logout()
            print("Inbox is empty.")
            return []

        # Inspect the last 200 messages to find replies
        mail_ids = mail_ids[-200:]
        print(f"IMAP connection successful. Scanning the last {len(mail_ids)} messages in Inbox...")

        conn = get_db_connection()
        cursor = conn.cursor()

        # Get active leads email map that are currently waiting for a reply
        cursor.execute("SELECT id, email, status, incubator_name, sent_at FROM outreach_leads WHERE status IN ('Sent', 'Follow-up Sent')")
        leads = {row["email"].lower().strip(): row for row in cursor.fetchall()}

        print("Active leads waiting for replies (Sent/Follow-up status):", list(leads.keys()))

        for m_id in reversed(mail_ids):  # Scan from newest to oldest
            try:
                status, msg_data = mail.fetch(m_id, "(RFC822)")
                if status != "OK":
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                from_header = msg.get("From", "")
                from_email = extract_email_address(from_header)

                print(f"Checking message From: {from_header} (parsed: {from_email})")

                if from_email in leads:
                    lead = leads[from_email]

                    print(f"Match found for Sent lead: {lead['incubator_name']} ({from_email})!")

                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            content_type = part.get_content_type()
                            content_disposition = str(part.get("Content-Disposition"))
                            if content_type == "text/plain" and "attachment" not in content_disposition:
                                payload = part.get_payload(decode=True)
                                body = payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
                                break
                    else:
                        payload = msg.get_payload(decode=True)
                        body = payload.decode(msg.get_content_charset() or "utf-8", errors="ignore")

                    res = process_reply(lead["id"], body)
                    if res:
                        print(f"Successfully processed reply from {from_email}. New status: {res['lead_status']}")
                        # Mark the lead as read in the DB
                        try:
                            update_cursor = conn.cursor()
                            update_cursor.execute("UPDATE outreach_leads SET is_read = 1 WHERE id = ?", (lead["id"],))
                            conn.commit()
                        except Exception as mark_err:
                            print(f"Error marking lead as read: {mark_err}")

                        processed_replies.append({
                            "incubator_name": lead["incubator_name"],
                            "email": from_email,
                            "reply_text": body,
                            "intent": res["intent"],
                            "score": res["score"],
                            "status": res["lead_status"]
                        })

                        # Remove from the temporary leads dictionary so we don't process older emails from the same sender in this run
                        del leads[from_email]

                    # Mark Seen (optional since it was already scanned, but keeps inbox clean)
                    mail.store(m_id, "+FLAGS", "\\Seen")
            except Exception as item_err:
                print(f"Error reading message ID {m_id}: {item_err}")

        conn.close()
        mail.close()
        mail.logout()
    except Exception as e:
        print("IMAP sync exception:", e)

    return processed_replies


def fetch_inbox_emails(limit: int = 100, mail_account: str = "default"):
    """Fetch all emails from the IMAP inbox for display in the dashboard.
    Returns a list of dicts with from, to, subject, date, body_preview, is_unread, message_id."""
    imap_cfg = get_imap_config(mail_account)
    imap_host = imap_cfg["host"]
    imap_port = imap_cfg["port"]
    imap_user = imap_cfg["user"]
    imap_pass = imap_cfg["password"]

    if not (imap_host and imap_user and imap_pass) or "your_email" in imap_user:
        return []

    emails = []
    try:
        mail = imaplib.IMAP4_SSL(imap_host, int(imap_port))
        mail.login(imap_user, imap_pass)
        mail.select("inbox")

        status, response = mail.search(None, "ALL")
        if status != "OK":
            mail.logout()
            return []

        mail_ids = response[0].split()
        if not mail_ids:
            mail.logout()
            return []

        # Fetch the latest N messages
        mail_ids = mail_ids[-limit:]

        for m_id in reversed(mail_ids):
            try:
                status, msg_data = mail.fetch(m_id, "(RFC822)")
                if status != "OK":
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                from_header = msg.get("From", "")
                to_header = msg.get("To", "")
                subject_header = msg.get("Subject", "")
                date_header = msg.get("Date", "")
                message_id_header = msg.get("Message-ID", "")

                # Decode subject
                try:
                    decoded_subject = decode_header(subject_header)
                    subject_parts = []
                    for part, enc in decoded_subject:
                        if isinstance(part, bytes):
                            subject_parts.append(part.decode(enc or "utf-8", errors="ignore"))
                        else:
                            subject_parts.append(part)
                    subject = "".join(subject_parts)
                except Exception:
                    subject = subject_header

                # Check if message is unread (no \Seen flag)
                is_unread = True
                try:
                    status_flags, flags_data = mail.fetch(m_id, "(FLAGS)")
                    if status_flags == "OK":
                        flags_str = flags_data[0].decode() if flags_data[0] else ""
                        if "\\Seen" in flags_str:
                            is_unread = False
                except Exception:
                    pass

                # Extract body preview (first 500 chars of plain text)
                body_preview = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        content_type = part.get_content_type()
                        content_disposition = str(part.get("Content-Disposition"))
                        if content_type == "text/plain" and "attachment" not in content_disposition:
                            payload = part.get_payload(decode=True)
                            if payload:
                                body_preview = payload.decode(part.get_content_charset() or "utf-8", errors="ignore")[:500]
                            break
                else:
                    payload = msg.get_payload(decode=True)
                    if payload:
                        body_preview = payload.decode(msg.get_content_charset() or "utf-8", errors="ignore")[:500]

                # Parse date
                parsed_date = date_header
                try:
                    msg_date = email.utils.parsedate_to_datetime(date_header)
                    parsed_date = msg_date.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    pass

                emails.append({
                    "from": extract_email_address(from_header),
                    "from_name": from_header,
                    "to": to_header,
                    "subject": subject,
                    "date": parsed_date,
                    "body_preview": body_preview,
                    "is_unread": is_unread,
                    "message_id": message_id_header,
                    "mail_id": m_id.decode() if isinstance(m_id, bytes) else str(m_id),
                })
            except Exception as e:
                print(f"Error fetching inbox message {m_id}: {e}")

        mail.close()
        mail.logout()
    except Exception as e:
        print("fetch_inbox_emails error:", e)

    return emails


def get_outreach_config():
    settings = get_settings()
    return {
        "sync_interval": settings.get("sync_interval", config.IMAP_SYNC_INTERVAL),
        "followup_delay": settings.get("followup_delay", config.FOLLOWUP_DELAY),
        "scanning_paused": settings.get("scanning_paused", config.SCANNING_PAUSED),
        "followups_paused": settings.get("followups_paused", config.FOLLOWUPS_PAUSED),
    }


def update_outreach_config(cfg: OutreachConfig):
    patch = {
        "sync_interval": cfg.sync_interval,
        "followup_delay": cfg.followup_delay if cfg.followup_delay is not None else None,
        "scanning_paused": cfg.scanning_paused,
        "followups_paused": cfg.followups_paused,
    }
    update_settings({k: v for k, v in patch.items() if v is not None})
    print(f"Updated outreach config: sync_interval={cfg.sync_interval}s, followup_delay={cfg.followup_delay}s, scanning_paused={cfg.scanning_paused}, followups_paused={cfg.followups_paused}")
    return get_outreach_config()


def trigger_check_replies(mail_account: str = "default"):
    if get_setting("scanning_paused", True):
        return {"status": "paused", "checked_at": datetime.now().isoformat(), "new_replies": [], "message": "Inbox scanning is permanently paused. Resume scanning in the Outreach Automation controls to proceed."}
    replies = check_imap_replies_sync(mail_account)
    return {"status": "success", "checked_at": datetime.now().isoformat(), "new_replies": replies}


def register_mou_recipient(recipient_email: str, incubator_name: str):
    """Registers an MOU recipient as an outreach lead (called before dispatching the MOU email)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM outreach_leads WHERE email = ?", (recipient_email,))
    row = cursor.fetchone()
    if row:
        lead_id = row["id"]
        cursor.execute(
            "UPDATE outreach_leads SET status = 'MOUs', sent_at = ?, reply_text = NULL, reply_detected_at = NULL, intent_classification = NULL, lead_score = 0, meeting_link = NULL, meeting_scheduled_at = NULL WHERE id = ?",
            (datetime.now().isoformat(), lead_id)
        )
    else:
        lead_id = f"lead_{uuid.uuid4().hex[:8]}"
        cursor.execute('''
            INSERT INTO outreach_leads (
                id, incubator_id, incubator_name, email, status, sent_at, lead_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (lead_id, "inc_mou_" + uuid.uuid4().hex[:4], incubator_name, recipient_email, "MOUs", datetime.now().isoformat(), 0))
    conn.commit()
    conn.close()


# Start periodic background email reply checker daemon thread
def start_imap_checking_loop():
    def loop():
        while True:
            try:
                settings = get_settings()
                sync_interval = int(settings.get("sync_interval", config.IMAP_SYNC_INTERVAL))
                scanning_paused = settings.get("scanning_paused", config.SCANNING_PAUSED)
                followups_paused = settings.get("followups_paused", config.FOLLOWUPS_PAUSED)
                if sync_interval > 0:
                    if not scanning_paused:
                        check_imap_replies_sync()
                    else:
                        print("[Background] Inbox scanning paused; skipping IMAP check cycle.")
                    if not followups_paused:
                        check_and_send_followups_sync()
                    else:
                        print("[Background] Follow-ups paused; skipping follow-up dispatch cycle.")
            except Exception as e:
                print("IMAP background checker loop error:", e)

            sleep_time = max(5, int(get_setting("sync_interval", 30)))
            time.sleep(sleep_time)

    t = threading.Thread(target=loop, daemon=True)
    t.start()
