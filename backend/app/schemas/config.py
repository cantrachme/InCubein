from typing import Optional, List

from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    org_name: Optional[str] = None
    org_full_name: Optional[str] = None
    org_email: Optional[str] = None
    org_website: Optional[str] = None
    org_address: Optional[str] = None
    signature_text: Optional[str] = None
    scrape_batch_size: Optional[int] = None
    scrape_batch_delay_seconds: Optional[int] = None
    email_batch_size: Optional[int] = None
    email_batch_delay_seconds: Optional[int] = None
    followup_delay: Optional[int] = None
    sync_interval: Optional[int] = None
    scanning_paused: Optional[bool] = None
    followups_paused: Optional[bool] = None
    default_template_startup: Optional[str] = None
    default_template_incubator: Optional[str] = None
    default_template_startup_followup: Optional[str] = None
    default_template_incubator_followup: Optional[str] = None


class TemplateCreate(BaseModel):
    key: Optional[str] = None
    name: str
    category: str = "general"
    subject: str
    body: str
    cc: Optional[str] = ""
    bcc: Optional[str] = ""
    variables: Optional[List[str]] = []
    is_default: Optional[bool] = False


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    cc: Optional[str] = None
    bcc: Optional[str] = None
    variables: Optional[List[str]] = None
    is_default: Optional[bool] = None


class CampaignCreate(BaseModel):
    name: str
    target_type: str = "all_startups"
    template_id: Optional[str] = None
    subject: Optional[str] = ""
    body: Optional[str] = ""
    cc: Optional[str] = ""
    bcc: Optional[str] = ""
    batch_size: Optional[int] = 8
    delay_seconds: Optional[int] = 15
    status: Optional[str] = "draft"


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    target_type: Optional[str] = None
    template_id: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    cc: Optional[str] = None
    bcc: Optional[str] = None
    batch_size: Optional[int] = None
    delay_seconds: Optional[int] = None
    status: Optional[str] = None
