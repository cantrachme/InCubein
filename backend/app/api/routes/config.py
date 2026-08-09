from fastapi import APIRouter, Query

from ...schemas.config import (
    SettingsUpdate,
    TemplateCreate,
    TemplateUpdate,
    CampaignCreate,
    CampaignUpdate,
)
from ...services import (
    get_settings,
    update_settings,
    reset_settings,
    get_email_templates,
    create_email_template,
    update_email_template,
    delete_email_template,
    get_campaigns,
    get_campaign,
    create_campaign,
    update_campaign,
    delete_campaign,
    dispatch_campaign,
    get_email_logs,
    clear_email_logs,
)

router = APIRouter()


# --- Platform settings ---
@router.get("/api/settings")
def api_get_settings():
    return get_settings()


@router.post("/api/settings")
def api_update_settings(cfg: SettingsUpdate):
    return update_settings(cfg.dict())


@router.post("/api/settings/reset")
def api_reset_settings():
    return reset_settings()


# --- Email templates ---
@router.get("/api/templates")
def api_get_templates(category: str = Query(None)):
    return get_email_templates(category)


@router.post("/api/templates")
def api_create_template(req: TemplateCreate):
    try:
        return create_email_template(req.dict())
    except ValueError as e:
        return {"status": "error", "message": str(e)}


@router.put("/api/templates/{key}")
def api_update_template(key: str, req: TemplateUpdate):
    try:
        return update_email_template(key, req.dict())
    except ValueError as e:
        return {"status": "error", "message": str(e)}


@router.delete("/api/templates/{key}")
def api_delete_template(key: str):
    deleted = delete_email_template(key)
    return {"status": "success" if deleted else "not_found", "deleted": deleted}


# --- Email campaigns ---
@router.get("/api/campaigns")
def api_get_campaigns():
    return get_campaigns()


@router.post("/api/campaigns")
def api_create_campaign(req: CampaignCreate):
    return create_campaign(req.dict())


@router.get("/api/campaigns/{campaign_id}")
def api_get_campaign(campaign_id: str):
    return get_campaign(campaign_id)


@router.put("/api/campaigns/{campaign_id}")
def api_update_campaign(campaign_id: str, req: CampaignUpdate):
    try:
        return update_campaign(campaign_id, req.dict())
    except ValueError as e:
        return {"status": "error", "message": str(e)}


@router.delete("/api/campaigns/{campaign_id}")
def api_delete_campaign(campaign_id: str):
    deleted = delete_campaign(campaign_id)
    return {"status": "success" if deleted else "not_found", "deleted": deleted}


@router.post("/api/campaigns/{campaign_id}/send")
def api_dispatch_campaign(campaign_id: str):
    return dispatch_campaign(campaign_id)


# --- Email logs ---
@router.get("/api/email-logs")
def api_get_email_logs(lead_id: str = Query(None), campaign_id: str = Query(None), limit: int = Query(200)):
    return get_email_logs(lead_id=lead_id or "", campaign_id=campaign_id or "", limit=limit)


@router.post("/api/email-logs/clear")
def api_clear_email_logs():
    clear_email_logs()
    return {"status": "success"}
