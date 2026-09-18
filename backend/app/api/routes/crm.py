import json
from typing import Optional

from fastapi import APIRouter, Query

from ...services.crm import (
    ensure_seeded,
    seed_demo,
    sync_from_ecosystem,
    get_summary_counts,
    get_ref_options,
    get_ceo_dashboard,
    get_attention,
    get_analytics,
    get_portfolio,
    get_mywork,
    get_university,
    list_crm,
    create_crm,
    update_crm,
    delete_crm,
    list_action_plans,
    get_action_plan,
    create_action_plan,
    update_action_plan,
    delete_action_plan,
    import_plan_items,
)

router = APIRouter(prefix="/api/crm")


def _decode_filters(filters: Optional[str]) -> dict:
    if not filters:
        return {}
    try:
        value = json.loads(filters)
        return value if isinstance(value, dict) else {}
    except (TypeError, ValueError):
        return {}


@router.get("/summary")
def api_crm_summary():
    return get_summary_counts()


@router.get("/refs")
def api_crm_refs():
    return get_ref_options()


@router.post("/seed-demo")
def api_crm_seed_demo():
    return seed_demo()


@router.post("/sync")
def api_crm_sync(force: bool = True):
    return sync_from_ecosystem(force=force)


@router.get("/ceo")
def api_crm_ceo():
    return get_ceo_dashboard()


@router.get("/attention")
def api_crm_attention(limit: Optional[int] = Query(None, ge=1, le=200)):
    return get_attention(limit=limit)


@router.get("/analytics")
def api_crm_analytics():
    return get_analytics()


@router.get("/portfolio")
def api_crm_portfolio():
    return get_portfolio()


@router.get("/mywork")
def api_crm_mywork(owner: Optional[str] = Query(None)):
    return get_mywork(owner)


@router.get("/university")
def api_crm_university():
    return get_university()


@router.get("/action-plans")
def api_list_action_plans():
    return list_action_plans()


@router.post("/action-plans")
def api_create_action_plan(payload: dict):
    return create_action_plan(payload or {})


@router.get("/action-plans/{plan_id}")
def api_get_action_plan(plan_id: int):
    return get_action_plan(plan_id)


@router.put("/action-plans/{plan_id}")
def api_update_action_plan(plan_id: int, payload: dict):
    return update_action_plan(plan_id, payload or {})


@router.delete("/action-plans/{plan_id}")
def api_delete_action_plan(plan_id: int):
    return delete_action_plan(plan_id)


@router.post("/action-plans/{plan_id}/import")
def api_import_plan_items(plan_id: int, payload: dict):
    return import_plan_items(plan_id, (payload or {}).get("items") or [])


@router.get("/{module}")
def api_list_crm(
    module: str,
    q: Optional[str] = Query(None),
    filters: Optional[str] = Query(None),
):
    return list_crm(module, q=q, filters=_decode_filters(filters))


@router.post("/{module}")
def api_create_crm(module: str, payload: dict):
    return create_crm(module, payload or {})


@router.put("/{module}/{record_id}")
def api_update_crm(module: str, record_id: int, payload: dict):
    return update_crm(module, record_id, payload or {})


@router.delete("/{module}/{record_id}")
def api_delete_crm(module: str, record_id: int):
    return delete_crm(module, record_id)