from typing import Optional

from pydantic import BaseModel


class OutreachEmailRequest(BaseModel):
    lead_id: str
    subject: Optional[str] = None
    body: Optional[str] = None
    cc: Optional[str] = None
    mail_account: Optional[str] = None
    template_id: Optional[str] = None


class OutreachReplyRequest(BaseModel):
    lead_id: str
    reply_text: str


class AddLeadRequest(BaseModel):
    incubator_id: str
    incubator_name: str
    email: str


class UpdateMeetingStatusRequest(BaseModel):
    meeting_id: str
    status: str


class UpdateLeadStatusRequest(BaseModel):
    lead_id: str
    status: str


class UpdateLeadNotesRequest(BaseModel):
    lead_id: str
    notes: str
    next_action_date: Optional[str] = ""


class UpdateStageRequest(BaseModel):
    lead_id: str
    stage: str
    notes: Optional[str] = None


class MassSendRequest(BaseModel):
    target_type: str
    subject: Optional[str] = None
    body: Optional[str] = None
    cc: Optional[str] = None
    mail_account: Optional[str] = None
    template_id: Optional[str] = None


class FollowupEmailRequest(BaseModel):
    lead_id: str


class OutreachConfig(BaseModel):
    sync_interval: int
    followup_delay: Optional[int] = 120
    scanning_paused: Optional[bool] = None
    followups_paused: Optional[bool] = None
