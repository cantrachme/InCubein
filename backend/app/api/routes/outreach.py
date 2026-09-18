from typing import Optional

from fastapi import APIRouter, Query

from ...schemas.outreach import (
    AddLeadRequest,
    UpdateLeadStatusRequest,
    UpdateLeadNotesRequest,
    UpdateStageRequest,
    OutreachEmailRequest,
    OutreachReplyRequest,
    MassSendRequest,
    FollowupEmailRequest,
    NurtureFunnelRequest,
    OutreachConfig,
)
from ...services import (
    get_outreach_leads,
    add_outreach_lead,
    reset_outreach,
    mark_all_leads_as_sent,
    update_lead_status,
    update_lead_notes,
    update_collaboration_stage,
    get_lead_timeline,
    trigger_outreach_email,
    trigger_mass_send,
    send_followup_single,
    send_followups,
    process_outreach_reply,
    get_outreach_config,
    update_outreach_config,
    trigger_check_replies,
    fetch_inbox_emails,
    get_unreplied_leads,
    delete_outreach_lead,
    funnel_lead_to_nurture,
    get_inquiry_dashboard,
    get_inquiries,
    get_inquiry_detail,
    send_inquiry_reply,
    schedule_inquiry_meeting,
    update_inquiry_stage,
    mark_inquiry_read,
    get_activity_feed,
)

router = APIRouter()


@router.get("/api/outreach/leads")
def api_get_outreach_leads():
    return get_outreach_leads()


@router.get("/api/outreach/leads/unreplied")
def api_get_unreplied_leads():
    return get_unreplied_leads()


@router.delete("/api/outreach/leads/{lead_id}")
def api_delete_outreach_lead(lead_id: str):
    return delete_outreach_lead(lead_id)


@router.post("/api/outreach/leads/funnel-nurture")
def api_funnel_lead_to_nurture(req: NurtureFunnelRequest):
    return funnel_lead_to_nurture(req.lead_id)


@router.post("/api/outreach/add-lead")
def api_add_outreach_lead(req: AddLeadRequest):
    return add_outreach_lead(req)


@router.post("/api/outreach/reset")
def api_reset_outreach():
    return reset_outreach()


@router.post("/api/outreach/mark-all-sent")
def api_mark_all_as_sent():
    return mark_all_leads_as_sent()


@router.post("/api/outreach/leads/update-status")
def api_update_lead_status(req: UpdateLeadStatusRequest):
    return update_lead_status(req)


@router.post("/api/outreach/leads/update-notes")
def api_update_lead_notes(req: UpdateLeadNotesRequest):
    return update_lead_notes(req)


@router.post("/api/outreach/update-stage")
def api_update_collaboration_stage(req: UpdateStageRequest):
    return update_collaboration_stage(req)


@router.get("/api/outreach/lead-timeline/{lead_id}")
def api_get_lead_timeline(lead_id: str):
    return get_lead_timeline(lead_id)


@router.post("/api/outreach/send-email")
def api_trigger_outreach_email(req: OutreachEmailRequest):
    return trigger_outreach_email(req)


@router.post("/api/outreach/mass-send")
def api_trigger_mass_send(req: MassSendRequest):
    return trigger_mass_send(req)


@router.post("/api/outreach/send-followup-single")
def api_send_followup_single(req: FollowupEmailRequest):
    return send_followup_single(req)


@router.post("/api/outreach/send-followups")
def api_send_followups():
    return send_followups()


@router.post("/api/outreach/simulate-reply")
def api_process_outreach_reply(req: OutreachReplyRequest):
    return process_outreach_reply(req)


@router.get("/api/outreach/config")
def api_get_outreach_config():
    return get_outreach_config()


@router.post("/api/outreach/config")
def api_update_outreach_config(cfg: OutreachConfig):
    return update_outreach_config(cfg)


@router.post("/api/outreach/check-replies")
def api_trigger_check_replies(mail_account: str = Query("default")):
    return trigger_check_replies(mail_account)


@router.get("/api/outreach/inquiry-dashboard")
def api_get_inquiry_dashboard(entity: str = Query("all")):
    return get_inquiry_dashboard(entity)


@router.get("/api/outreach/inquiries")
def api_get_inquiries(entity: str = Query("all")):
    return get_inquiries(entity)


@router.get("/api/outreach/inquiries/{lead_id}")
def api_get_inquiry_detail(lead_id: str):
    return get_inquiry_detail(lead_id)


@router.post("/api/outreach/inquiries/{lead_id}/reply")
def api_send_inquiry_reply(lead_id: str, payload: dict):
    return send_inquiry_reply(
        lead_id,
        body=(payload or {}).get("body") or "",
        subject=(payload or {}).get("subject") or "",
        performed_by=(payload or {}).get("performed_by") or "",
    )


@router.post("/api/outreach/inquiries/{lead_id}/meeting")
def api_schedule_inquiry_meeting(lead_id: str, payload: dict):
    p = payload or {}
    return schedule_inquiry_meeting(
        lead_id,
        title=p.get("title"),
        date_str=p.get("date"),
        time_str=p.get("time"),
        duration_minutes=p.get("duration_minutes") or 30,
        participants=p.get("participants"),
        meeting_type=p.get("meeting_type"),
        meeting_link=p.get("meeting_link"),
        notes=p.get("notes"),
        performed_by=p.get("performed_by") or "",
    )


@router.post("/api/outreach/inquiries/{lead_id}/stage")
def api_update_inquiry_stage(lead_id: str, payload: dict):
    p = payload or {}
    return update_inquiry_stage(
        lead_id,
        stage=p.get("stage") or "",
        notes=p.get("notes"),
        performed_by=p.get("performed_by") or "",
    )


@router.post("/api/outreach/inquiries/{lead_id}/read")
def api_mark_inquiry_read(lead_id: str, payload: dict = None):
    return mark_inquiry_read(lead_id, performed_by=(payload or {}).get("performed_by") or "")


@router.get("/api/outreach/activity-feed")
def api_get_activity_feed(limit: int = Query(200), startup_id: Optional[int] = Query(None)):
    return get_activity_feed(limit=limit, startup_id=startup_id)


@router.get("/api/outreach/inbox")
def api_fetch_inbox_emails(mail_account: str = Query("default")):
    return fetch_inbox_emails(limit=200, mail_account=mail_account)
