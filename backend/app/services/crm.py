"""INCUBEIN CRM – University, CEO Dashboard, Deep Analytics, Attention,
My Work, Portfolio, Startups, Founders, Audits, Execution and Commercial
modules.

Storage uses the same MongoDB connection as the rest of the platform
(``get_mongo_db``).  All module data lives in ``crm_*`` collections so it
never interferes with the existing pipelines/outreach collections.
"""

import re
from collections import defaultdict
from datetime import datetime, date, timedelta

import pymongo

from ..core.exceptions import NotFoundError, BadRequestError, ServiceError
from ..core.database import get_mongo_db

# --------------------------------------------------------------------------
# Module registry
# --------------------------------------------------------------------------

MODULES = {
    "startups": "Startups",
    "founders": "Founders & Team",
    "audits": "Startup Audits",
    "milestones": "Milestones",
    "actions": "90-Day Action Tracker",
    "risks": "Risk Register",
    "customers": "Customer CRM",
    "deals": "Sales Pipeline",
    "financials": "Financial KPI",
    "funding": "Funding Tracker",
    "colleges": "Colleges",
    "students": "Student Pipeline",
}

CODE_PREFIXES = {"startups": "INC-", "colleges": "COL-", "students": "STU-"}

# Audit criteria (weights = max score, mirroring the INCUBEIN audit sheet)
AUDIT_CRITERIA = [
    ("founder_team", "Founder & Team", 10),
    ("problem_validation", "Problem Validation", 10),
    ("technology_product", "Technology & Product", 15),
    ("market", "Market", 10),
    ("business_model", "Business Model", 10),
    ("traction", "Traction", 15),
    ("financial", "Financial", 10),
    ("ip_legal", "IP & Legal", 10),
    ("funding", "Funding", 5),
    ("engagement", "Incubein Engagement", 5),
]


def _health_band(score):
    if score is None:
        return "Not Audited"
    if score >= 80:
        return "GREEN"
    if score >= 65:
        return "GROWTH"
    if score >= 50:
        return "AMBER"
    if score >= 35:
        return "INTERVENTION"
    return "CRITICAL"


def _today():
    return date.today().isoformat()


def _next_id(db, collection):
    counter = db["crm_counters"].find_one_and_update(
        {"_id": collection},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=pymongo.ReturnDocument.AFTER,
    )
    return counter["seq"]


def _next_code(db, module_family, label):
    prefix, width = CODE_PREFIXES.get(
        module_family, (module_family.upper()[:3] + "-", 3)
    )
    seq = _next_id(db, f"code_{module_family}")
    return f"{prefix}{seq:0{width}d}"


def _enrich_refs(db, module, doc, startup_map=None, college_map=None):
    """Resolve reference display names so the frontend can render lists."""
    doc = dict(doc)
    if module in ("founders", "audits", "milestones", "actions", "risks",
                  "customers", "deals", "financials", "funding") and doc.get("startup_id"):
        try:
            sid = int(doc["startup_id"])
        except (TypeError, ValueError):
            sid = None
        if sid is not None:
            if startup_map is None:
                startup_map = _startup_map(db)
            code, name = startup_map.get(sid, (None, None))
            doc["startup_name"] = (name or code) or "—"
    if module == "students" and doc.get("college_id"):
        try:
            cid = int(doc["college_id"])
        except (TypeError, ValueError):
            cid = None
        if cid is not None:
            if college_map is None:
                college_map = _college_map(db)
            doc["college_name"] = college_map.get(cid) or "—"
    return doc


def _startup_map(db):
    return {d["id"]: (d.get("code"), d.get("name")) for d in db["crm_startups"].find({}, {"id": 1, "code": 1, "name": 1})}


def _college_map(db):
    return {d["id"]: d.get("name") for d in db["crm_colleges"].find({}, {"id": 1, "name": 1})}


# --------------------------------------------------------------------------
# Generic CRUD
# --------------------------------------------------------------------------

def list_crm(module, q=None, filters=None):
    if module not in MODULES:
        raise NotFoundError("Unknown CRM module.")
    try:
        db = get_mongo_db()
        coll = db[f"crm_{module}"]
        query = {}
        for k, v in (filters or {}).items():
            if v in (None, "", "All", "all"):
                continue
            if k in ("startup_id", "college_id"):
                try:
                    query[k] = int(v)
                except (TypeError, ValueError):
                    query[k] = v
            elif k in ("plan_id", "action_id", "related_action_id"):
                try:
                    query[k] = int(v)
                except (TypeError, ValueError):
                    query[k] = v
            else:
                query[k] = v
        if q:
            regex = {"$regex": re.escape(str(q)), "$options": "i"}
            text_fields = {
                "startups": ["name", "code", "sector", "stage", "status", "city"],
                "founders": ["name", "role", "institution", "email"],
                "audits": ["audit_type", "auditor"],
                "milestones": ["milestone", "owner", "status"],
                "actions": ["action", "owner", "kpi", "status"],
                "risks": ["risk", "category", "owner", "status"],
                "customers": ["name", "customer_type", "lead_status", "customer_status"],
                "deals": ["deal_name", "sales_stage", "deal_status", "sales_owner"],
                "financials": ["fy", "month"],
                "funding": ["scheme", "source", "stage", "status"],
                "colleges": ["name", "code", "district", "college_type", "status"],
                "students": ["student_name", "idea", "sector", "college_id"],
            }.get(module, [])
            qry = []
            for f in text_fields:
                if f in ("startup_id", "college_id"):
                    if str(q).isdigit():
                        qry.append({f: int(q)})
                else:
                    qry.append({f: regex})
            if qry:
                query["$or"] = qry

        docs = list(coll.find(query))
        docs.sort(key=lambda d: d.get("id", 0))
        startup_map = _startup_map(db) if module != "startups" else None
        college_map = _college_map(db) if module == "students" else None
        docs = [_enrich_refs(db, module, d, startup_map, college_map) for d in docs]
        for d in docs:
            d["_id"] = str(d["_id"])
        return {"module": module, "label": MODULES[module], "records": docs, "count": len(docs)}
    except NotFoundError:
        raise
    except Exception as e:
        raise ServiceError(f"Failed to list {module}: {str(e)}")


def _prepare_payload(module, data):
    """Whitelist, coerce numeric fields, and compute derived values."""
    payload = {k: ("" if v is None else v) for k, v in data.items() if k and not k.startswith("_")}
    int_fields = []
    num_fields = []
    if module == "audits":
        int_fields = [c[0] for c in AUDIT_CRITERIA]
    elif module == "risks":
        num_fields = ["probability"]
        if "impact" in payload and payload["impact"] not in ("", None):
            payload["impact"] = str(payload["impact"]).strip().title() or "Medium"
    elif module == "actions":
        float_fields = ["baseline", "target", "actual"]
        for f in float_fields:
            if f in payload and payload[f] in ("", None):
                payload[f] = 0
            if f in payload:
                try:
                    payload[f] = float(payload[f])
                except (TypeError, ValueError):
                    payload[f] = 0
    elif module == "financials":
        num_fields = ["revenue", "mrr", "cogs", "expenses", "cash_balance", "gst_paid"]
        int_fields = ["team_size", "jobs_created"]
    elif module == "funding":
        num_fields = ["amount_sought", "amount_received", "equity_offered", "valuation"]
    elif module == "customers":
        num_fields = ["revenue", "contract_value"]
        int_fields = ["nps"]
    elif module == "deals":
        num_fields = ["pipeline_value"]
    elif module == "colleges":
        int_fields = ["students_reached", "ideas_generated", "ideas_screened", "referrals"]

    for f in int_fields:
        if f in payload and payload[f] not in ("", None):
            try:
                payload[f] = int(float(payload[f]))
            except (TypeError, ValueError):
                payload[f] = 0
    for f in num_fields:
        if f in payload and payload[f] not in ("", None):
            try:
                payload[f] = float(payload[f])
            except (TypeError, ValueError):
                payload[f] = 0

    if module in ("founders", "audits", "milestones", "actions", "risks",
                  "customers", "deals", "financials", "funding") and payload.get("startup_id"):
        try:
            payload["startup_id"] = int(payload["startup_id"])
        except (TypeError, ValueError):
            payload.pop("startup_id", None)
    if module == "students" and payload.get("college_id"):
        try:
            payload["college_id"] = int(payload["college_id"])
        except (TypeError, ValueError):
            payload.pop("college_id", None)

    if module in ("actions", "milestones", "risks") and payload.get("plan_id"):
        try:
            payload["plan_id"] = int(payload["plan_id"])
        except (TypeError, ValueError):
            payload.pop("plan_id", None)
    if module in ("actions", "risks") and payload.get("action_id"):
        try:
            payload["action_id"] = int(payload["action_id"])
        except (TypeError, ValueError):
            payload.pop("action_id", None)

    if module in ("actions", "milestones") and payload.get("related_action_id"):
        try:
            payload["related_action_id"] = int(payload["related_action_id"])
        except (TypeError, ValueError):
            payload.pop("related_action_id", None)

    return payload


def _recompute(db, module, payload, record_id=None):
    if module == "audits":
        total = sum(int(payload.get(k, 0) or 0) for k, *_ in AUDIT_CRITERIA)
        payload["total_score"] = total
        payload["band"] = _health_band(total)
    elif module == "actions":
        target = float(payload.get("target") or 0)
        actual = float(payload.get("actual") or 0)
        status = payload.get("status", "Not Started")
        deadline = payload.get("deadline") or ""
        late = bool(deadline and deadline < _today())
        rag = "GREEN"
        if status == "Delayed":
            rag = "RED"
        elif status in ("Completed", "Achieved", "Blocked"):
            rag = "AMBER" if status == "Blocked" or (status in ("Completed", "Achieved") and late) else "GREEN"
        elif late:
            rag = "RED"
        elif target and actual >= target * 0.99:
            rag = "GREEN"
        elif target and actual >= target * 0.8:
            rag = "AMBER"
        elif status == "In Progress":
            rag = "AMBER"
        payload["rag"] = rag
    elif module == "milestones":
        status = payload.get("status", "Not Started")
        if status in ("Completed", "Achieved"):
            if not payload.get("actual_date"):
                payload["actual_date"] = _today()
        else:
            payload.pop("actual_date", None)
        deadline = payload.get("target_date") or ""
        rag = "GREEN"
        if status in ("Completed", "Achieved"):
            rag = "AMBER" if deadline and deadline < (payload.get("actual_date") or "") else "GREEN"
        elif status == "Delayed" or (deadline and deadline < _today()):
            rag = "RED"
        elif status == "In Progress":
            rag = "AMBER"
        payload["rag"] = rag
    elif module == "risks":
        prob = int(payload.get("probability") or 0)
        imp = {"High": 5, "Medium": 3, "Low": 1}.get(str(payload.get("impact") or "").title(), 3)
        prob_w = 5 if prob >= 80 else 4 if prob >= 60 else 3 if prob >= 40 else 2 if prob >= 20 else 1
        score = prob_w * imp
        payload["risk_score"] = score
        payload["risk_level"] = (
            "Critical" if score >= 15 else "High" if score >= 9 else
            "Medium" if score >= 4 else "Low"
        )


def create_crm(module, data):
    if module not in MODULES:
        raise NotFoundError("Unknown CRM module.")
    try:
        db = get_mongo_db()
        coll = db[f"crm_{module}"]
        payload = _prepare_payload(module, data)

        # auto generated identifiers
        if module == "startups":
            if not payload.get("code"):
                payload["code"] = _next_code(db, "startups", "")
            payload.setdefault("status", "Active")
            payload.setdefault("record_status", "Active")
        elif module == "colleges":
            if not payload.get("code"):
                payload["code"] = _next_code(db, "colleges", "")
        elif module == "students":
            if not payload.get("code"):
                payload["code"] = _next_code(db, "students", "")

        _recompute(db, module, payload)

        new_id = _next_id(db, f"crm_{module}")
        payload["id"] = new_id
        payload["created_at"] = datetime.now().isoformat()
        payload["updated_at"] = payload["created_at"]

        # Startup health is derived from audits, so refresh after an insert
        if module == "audits":
            payload = dict(payload)

        coll.insert_one(payload)

        if module == "audits":
            _refresh_startup_health(db)

        if module in ("milestones", "actions", "risks", "funding"):
            _log_activity(db, module, "create", new_id, _describe(payload, module))

        return {"status": "success", "message": f"{MODULES[module]} record created.", "id": new_id}
    except NotFoundError:
        raise
    except Exception as e:
        raise ServiceError(f"Failed to create {module}: {str(e)}")


def _history_diff_keys(module):
    if module == "actions":
        return ["action", "status", "deadline", "owner", "kpi", "baseline", "target", "actual", "notes", "evidence", "dependencies", "priority"]
    if module == "milestones":
        return ["milestone", "status", "target_date", "actual_date", "owner", "notes", "evidence"]
    if module == "risks":
        return ["risk", "category", "probability", "impact", "severity", "owner", "mitigation", "status", "due_date", "notes"]
    return []


def _record_history(coll, existing, module, payload, reason=""):
    """Appends a structured change entry to the record instead of silently overwriting."""
    changed = {}
    for key in _history_diff_keys(module):
        old = existing.get(key)
        new = payload.get(key)
        if old != new and new is not None:
            changed[key] = {"from": old, "to": new}
    if not changed:
        return []
    entry = {
        "updated_at": datetime.now().isoformat(),
        "reason": reason or "",
        "changes": changed,
    }
    history = list(existing.get("history") or [])
    history.append(entry)
    coll.update_one({"_id": existing["_id"]}, {"$set": {"history": history}})
    return history


def update_crm(module, record_id, data):
    if module not in MODULES:
        raise NotFoundError("Unknown CRM module.")
    try:
        db = get_mongo_db()
        coll = db[f"crm_{module}"]
        try:
            record_id = int(record_id)
        except (TypeError, ValueError):
            pass
        existing = coll.find_one({"id": record_id})
        if not existing:
            raise NotFoundError("Record not found.")

        reason = (data or {}).get("reason") or (data or {}).get("change_reason") or ""
        payload = _prepare_payload(module, {k: v for k, v in (data or {}).items() if k not in ("reason", "change_reason", "performed_by")})
        _recompute(db, module, payload)
        payload["updated_at"] = datetime.now().isoformat()

        coll.update_one({"_id": existing["_id"]}, {"$set": payload})

        if module in ("milestones", "actions", "risks", "funding"):
            _log_activity(db, module, "update", record_id, _describe({**existing, **payload}, module))
        if module in ("actions", "milestones", "risks"):
            _record_history(coll, existing, module, payload, reason)
        if module == "audits":
            # keep every startup's health in sync when a (newest) audit lands
            _refresh_startup_health(db)

        return {"status": "success", "message": f"{MODULES[module]} record updated."}
    except NotFoundError:
        raise
    except Exception as e:
        raise ServiceError(f"Failed to update {module}: {str(e)}")


def delete_crm(module, record_id):
    if module not in MODULES:
        raise NotFoundError("Unknown CRM module.")
    try:
        db = get_mongo_db()
        coll = db[f"crm_{module}"]
        try:
            record_id = int(record_id)
        except (TypeError, ValueError):
            pass
        existing = coll.find_one({"id": record_id})
        if not existing:
            raise NotFoundError("Record not found.")
        coll.delete_one({"_id": existing["_id"]})
        if module == "audits":
            _refresh_startup_health(db)
        return {"status": "success", "message": f"{MODULES[module]} record deleted."}
    except NotFoundError:
        raise
    except Exception as e:
        raise ServiceError(f"Failed to delete {module}: {str(e)}")


# --------------------------------------------------------------------------
# 90-Day Action Plans
# --------------------------------------------------------------------------

def _plan_progress(db, plan):
    pid = plan.get("id")
    steps = list(db["crm_actions"].find({"plan_id": pid}))
    return _progress_from_steps(steps)


def _progress_from_steps(steps):
    total = len(steps)
    completed = len([s for s in steps if s.get("status") in ("Completed", "Achieved")])
    today = _today()
    return {
        "total_steps": total,
        "completed_steps": completed,
        "overdue_steps": len([s for s in steps if s.get("status") not in ("Completed", "Achieved") and s.get("deadline") and s.get("deadline") < today]),
        "in_progress_steps": len([s for s in steps if s.get("status") not in ("Completed", "Achieved", "Not Started")]),
        "progress_pct": round((completed / total) * 100, 1) if total else 0.0,
    }


def _plans_progress_map(db, plan_ids):
    """Progress for many plans in a constant number of queries (no N+1)."""
    progress = {}
    ids = [pid for pid in plan_ids if pid is not None]
    if not ids:
        return progress
    steps = list(db["crm_actions"].find({"plan_id": {"$in": ids}}, {"status": 1, "deadline": 1, "plan_id": 1}))
    buckets = {}
    for s in steps:
        buckets.setdefault(s.get("plan_id"), []).append(s)
    for pid, doc in buckets.items():
        progress[pid] = _progress_from_steps(doc)
    return progress


def _plan_doc(db, plan, startup_map=None, progress_map=None):
    plan = dict(plan)
    if startup_map is None:
        startup_map = _startup_map(db)
    code, name = startup_map.get(plan.get("startup_id"), (None, None))
    plan["startup_name"] = (name or code) or "—"
    plan["_id"] = str(plan.get("_id", ""))
    if progress_map is not None and plan.get("id") in progress_map:
        plan.update(progress_map[plan.get("id")])
    else:
        plan.update(_plan_progress(db, plan))
    return plan


def _coerce_plan_id(plan_id):
    try:
        return int(plan_id)
    except (TypeError, ValueError):
        return plan_id


def import_plan_items(plan_id, items):
    """Bulk import action / milestone / risk rows into an existing plan
    (used by the Execution section's Bulk Upload)."""
    db = get_mongo_db()
    pid = _coerce_plan_id(plan_id)
    plan = db["crm_action_plans"].find_one({"id": pid})
    if not plan:
        raise NotFoundError("Action plan not found.")
    type_map = {"action": "actions", "step": "actions", "milestone": "milestones", "risk": "risks"}
    created = {"actions": 0, "milestones": 0, "risks": 0}
    skipped = 0
    for raw in items or []:
        item = {k: ("" if v is None else v) for k, v in (raw or {}).items() if k and not k.startswith("_")}
        entity = type_map.get(str(item.pop("item_type", "")).strip().lower())
        if not entity:
            skipped += 1
            continue
        title = item.get("title") or item.get("action") or item.get("milestone") or item.get("risk") or ""
        if not title:
            skipped += 1
            continue
        item["plan_id"] = pid
        item["startup_id"] = plan.get("startup_id")
        if entity == "actions":
            item.setdefault("action", title)
            item.setdefault("title", title)
            item.setdefault("status", "Not Started")
        elif entity == "milestones":
            item.setdefault("milestone", title)
            item.setdefault("title", title)
            item.setdefault("status", "Not Started")
        elif entity == "risks":
            item.setdefault("risk", title)
            item.setdefault("title", title)
            item.setdefault("status", "Open")
            item.setdefault("category", "Execution")
        create_crm(entity, item)
        created[entity] += 1
    return {"plan_id": pid, "created": created, "skipped": skipped}


def list_action_plans():
    db = get_mongo_db()
    plans = list(db["crm_action_plans"].find({}).sort("id", 1))
    startup_map = _startup_map(db)
    progress_map = _plans_progress_map(db, [p.get("id") for p in plans])
    return [_plan_doc(db, p, startup_map, progress_map) for p in plans]


def get_action_plan(plan_id):
    db = get_mongo_db()
    plan = db["crm_action_plans"].find_one({"id": _coerce_plan_id(plan_id)})
    if not plan:
        raise NotFoundError("Action plan not found.")
    plan = _plan_doc(db, plan)
    startup_map = _startup_map(db)
    steps = list(db["crm_actions"].find({"plan_id": plan.get("id")}).sort("id", 1))
    steps = [_enrich_refs(db, "actions", s, startup_map) for s in steps]
    for s in steps:
        s["_id"] = str(s.get("_id", ""))
    milestones = list(db["crm_milestones"].find({"plan_id": plan.get("id")}).sort("id", 1))
    milestones = [_enrich_refs(db, "milestones", m, startup_map) for m in milestones]
    for m in milestones:
        m["_id"] = str(m.get("_id", ""))
    risks = list(db["crm_risks"].find({"plan_id": plan.get("id")}).sort("id", 1))
    risks = [_enrich_refs(db, "risks", r, startup_map) for r in risks]
    for r in risks:
        r["_id"] = str(r.get("_id", ""))
    startup = None
    if plan.get("startup_id"):
        startup = db["crm_startups"].find_one({"id": plan["startup_id"]})
        if startup:
            startup["_id"] = str(startup["_id"])
    return {"plan": plan, "steps": steps, "milestones": milestones, "risks": risks, "startup": startup}


def _coerce_id(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return value


def _create_plan_children(db, plan_id, startup_id, data):
    """Create nested steps / milestones / risks together with an action plan.
    Each child is routed through the normal module CRUD so derived fields
    (RAG, risk score, history, activity log) stay consistent."""
    created = {"steps": 0, "milestones": 0, "risks": 0}

    def _merge(item):
        out = {k: ("" if v is None else v) for k, v in (item or {}).items() if k and not k.startswith("_")}
        out["startup_id"] = startup_id
        out["plan_id"] = plan_id
        return out

    for step in (data or {}).get("steps") or []:
        item = _merge(step)
        title = item.get("title") or item.get("action") or ""
        if not title:
            continue
        item.setdefault("action", title)
        item.setdefault("title", title)
        item.setdefault("owner", "")
        item.setdefault("status", "Not Started")
        create_crm("actions", item)
        created["steps"] += 1

    for ms in (data or {}).get("milestones") or []:
        item = _merge(ms)
        title = item.get("title") or item.get("milestone") or ""
        if not title:
            continue
        item.setdefault("milestone", title)
        item.setdefault("title", title)
        item.setdefault("owner", "")
        item.setdefault("status", "Not Started")
        create_crm("milestones", item)
        created["milestones"] += 1

    for rk in (data or {}).get("risks") or []:
        item = _merge(rk)
        title = item.get("title") or item.get("risk") or ""
        if not title:
            continue
        item.setdefault("risk", title)
        item.setdefault("title", title)
        item.setdefault("category", "Execution")
        item.setdefault("severity", "Medium")
        item.setdefault("impact", "Medium")
        item.setdefault("status", "Open")
        item.setdefault("owner", "")
        item.setdefault("probability", 50)
        create_crm("risks", item)
        created["risks"] += 1

    return created


def create_action_plan(data):
    db = get_mongo_db()
    payload = {k: ("" if v is None else v) for k, v in (data or {}).items()
               if k and not k.startswith("_") and k not in ("steps", "milestones", "risks")}
    if payload.get("startup_id"):
        try:
            payload["startup_id"] = int(payload["startup_id"])
        except (TypeError, ValueError):
            payload.pop("startup_id", None)
    payload.setdefault("title", "90-Day Action Plan")
    payload.setdefault("status", "Active")
    if payload.get("start_date") and not payload.get("end_date"):
        try:
            payload["end_date"] = (date.fromisoformat(payload["start_date"]) + timedelta(days=90)).isoformat()
        except ValueError:
            pass
    plan_id = _next_id(db, "crm_action_plans")
    now = datetime.now().isoformat()
    payload["id"] = plan_id
    payload["created_at"] = now
    payload["updated_at"] = now
    db["crm_action_plans"].insert_one(payload)
    created = _create_plan_children(db, plan_id, payload.get("startup_id"), data or {})
    message = "90-day action plan created"
    if any(created.values()):
        message += " with %d step(s), %d milestone(s), %d risk(s)" % (
            created["steps"], created["milestones"], created["risks"])
    message += "."
    return {"status": "success", "message": message, "id": plan_id, "created": created}


def update_action_plan(plan_id, data):
    db = get_mongo_db()
    existing = db["crm_action_plans"].find_one({"id": _coerce_plan_id(plan_id)})
    if not existing:
        raise NotFoundError("Action plan not found.")
    reason = (data or {}).get("reason") or (data or {}).get("change_reason") or ""
    payload = {k: ("" if v is None else v) for k, v in (data or {}).items()
               if k and not k.startswith("_") and k not in ("reason", "change_reason", "performed_by")}
    if payload.get("startup_id"):
        try:
            payload["startup_id"] = int(payload["startup_id"])
        except (TypeError, ValueError):
            payload.pop("startup_id", None)
    payload["updated_at"] = datetime.now().isoformat()

    plan_keys = ["title", "objective", "status", "start_date", "end_date", "priority",
                 "owner", "description", "key_goals", "dependencies", "notes"]
    changed = {}
    for key in plan_keys:
        old = existing.get(key)
        new = payload.get(key)
        if old != new and new is not None:
            changed[key] = {"from": old, "to": new}
    if changed:
        history = list(existing.get("history") or [])
        history.append({
            "updated_at": datetime.now().isoformat(),
            "reason": reason or "",
            "changes": changed,
        })
        payload["history"] = history

    db["crm_action_plans"].update_one({"_id": existing["_id"]}, {"$set": payload})
    return {"status": "success", "message": "Action plan updated."}


def delete_action_plan(plan_id):
    db = get_mongo_db()
    pid = _coerce_plan_id(plan_id)
    existing = db["crm_action_plans"].find_one({"id": pid})
    if not existing:
        raise NotFoundError("Action plan not found.")
    db["crm_action_plans"].delete_one({"_id": existing["_id"]})
    db["crm_actions"].update_many({"plan_id": pid}, {"$set": {"plan_id": None}})
    db["crm_milestones"].update_many({"plan_id": pid}, {"$set": {"plan_id": None}})
    db["crm_risks"].update_many({"plan_id": pid}, {"$set": {"plan_id": None}})
    return {"status": "success", "message": "Action plan deleted; its steps, milestones, and risks were unlinked."}


def _describe(payload, module=None):
    title = payload.get("milestone") or payload.get("action") or payload.get("risk") or payload.get("scheme") or payload.get("title") or ""
    if payload.get("milestone") or (module == "milestones"):
        return f"Milestone '{title}' ({payload.get('status') or 'Pending'})"
    if payload.get("action") or (module == "actions"):
        return f"Action '{title}' ({payload.get('status') or 'Not Started'})"
    if payload.get("risk") or (module == "risks"):
        return f"Risk '{title}' ({payload.get('risk_level') or 'Open'})"
    if payload.get("scheme") or (module == "funding"):
        return f"Funding '{title}' ({payload.get('status') or 'Applied'})"
    return "Record updated"


def _log_activity(db, module, action, record_id, summary):
    try:
        db["crm_activity"].insert_one({
            "module": module,
            "action": action,
            "record_id": record_id,
            "summary": summary or _describe({}),
            "created_at": datetime.now().isoformat(),
        })
    except Exception:
        pass


def _refresh_startup_health(db):
    """Recompute every startup's health from its most recent audit."""
    coll = db["crm_startups"]
    audits = db["crm_audits"]
    for st in coll.find({}):
        latest = list(audits.find({"startup_id": st.get("id")}).sort("audit_date", -1))
        band = "Not Audited"
        score = None
        last_date = None
        if latest:
            score = latest[0].get("total_score")
            band = latest[0].get("band") or _health_band(score)
            last_date = latest[0].get("audit_date")
        st["health_score"] = score
        st["health_band"] = band
        st["last_audit_date"] = last_date
        coll.update_one({"_id": st["_id"]}, {"$set": {
            "health_score": score,
            "health_band": band,
            "last_audit_date": last_date,
        }})


# --------------------------------------------------------------------------
# Startup health + startup-centric joins
# --------------------------------------------------------------------------

def _startups_with_metrics(db):
    """Rich startup records with health, funding, revenue and action metrics."""
    founders = db["crm_founders"]
    audits = db["crm_audits"]
    actions = db["crm_actions"]
    financials = db["crm_financials"]
    funding = db["crm_funding"]
    deals = db["crm_deals"]
    customers = db["crm_customers"]
    milestones = db["crm_milestones"]

    metrics = {}
    for aid in audits.find({}):
        sid = aid.get("startup_id")
        if sid is None:
            continue
        m = metrics.setdefault(sid, {"audits": [], "founders": 0, "actions": [], "risks": [], "deals": [], "financials": []})
        m["audits"].append(aid)

    def touch(sid):
        return metrics.setdefault(sid, {"audits": [], "founders": 0, "actions": [], "risks": [], "deals": [], "financials": []})

    for f in founders.find({}):
        if f.get("startup_id") is not None:
            touch(f["startup_id"])["founders"] += 1
    for a in actions.find({}):
        if a.get("startup_id") is not None:
            touch(a["startup_id"])["actions"].append(a)
    for r in db["crm_risks"].find({}):
        if r.get("startup_id") is not None:
            m = touch(r["startup_id"])
            m.setdefault("risks", []).append(r)
    for d in deals.find({}):
        if d.get("startup_id") is not None:
            touch(d["startup_id"])["deals"].append(d)
    for f in financials.find({}):
        if f.get("startup_id") is not None:
            touch(f["startup_id"])["financials"].append(f)

    funding_totals = {}
    for f in funding.find({}):
        if f.get("startup_id") is None:
            continue
        try:
            funding_totals[f["startup_id"]] = funding_totals.get(f["startup_id"], 0.0) + float(f.get("amount_received") or 0)
        except (TypeError, ValueError):
            pass

    customer_count_map = {}
    for r in customers.aggregate([{"$group": {"_id": "$startup_id", "n": {"$sum": 1}}}]):
        if r.get("_id") is not None:
            customer_count_map[r["_id"]] = r["n"]

    rows = []
    for st in db["crm_startups"].find({}).sort("id", 1):
        m = metrics.get(st.get("id"), {})
        latest_audit = m.get("audits", sorted([]))
        latest_audit.sort(key=lambda a: a.get("audit_date") or "", reverse=True)
        band = st.get("health_band") or "Not Audited"
        score = st.get("health_score")
        if not latest_audit and (band == "Not Audited" or score is None):
            pass
        elif latest_audit:
            band = latest_audit[0].get("band") or band
            score = latest_audit[0].get("total_score")

        action_list = m.get("actions", [])
        overdue_actions = [a for a in action_list if a.get("status") != "Completed" and a.get("deadline") and a.get("deadline") < _today()]
        open_deals = [d for d in m.get("deals", []) if d.get("deal_status", "Open") != "Won"]
        pipeline_value = sum(float(d.get("pipeline_value") or 0) for d in open_deals)
        monthly_rev = m.get("financials", [])
        latest_fin = None
        if monthly_rev:
            latest_fin = sorted(monthly_rev, key=lambda f: f.get("month_end") or "", reverse=True)[0]

        rows.append({
            **st,
            "founder_count": m.get("founders", 0),
            "health_score": score if latest_audit else st.get("health_score"),
            "health_band": band,
            "founders_count": m.get("founders", 0),
            "action_count": len(action_list),
            "overdue_actions": len(overdue_actions),
            "pipeline_value": round(pipeline_value, 2),
            "funding_received": round(funding_totals.get(st.get("id"), 0.0), 2),
            "monthly_revenue": latest_fin.get("revenue") if latest_fin else 0,
            "latest_revenue": (latest_fin.get("revenue") if latest_fin else 0) or 0,
            "active_deals": len(open_deals),
"customer_count": customer_count_map.get(st.get("id"), 0),
    })
    return rows


# --------------------------------------------------------------------------
# Attention Required
# --------------------------------------------------------------------------

def _attention_triggers(db, st, groups):
    sid = st.get("id")
    band = st.get("health_band") or "Not Audited"
    triggers = []

    if band == "CRITICAL":
        triggers.append({"type": "critical_health", "label": "Critical health score", "sev": "critical"})
    elif band == "INTERVENTION":
        triggers.append({"type": "intervention_health", "label": "Intervention-level health", "sev": "high"})

    if not st.get("health_score") and band == "Not Audited":
        triggers.append({"type": "never_audited", "label": "Never audited – no health score", "sev": "high"})

    actions = groups["actions"].get(sid, [])
    overdue = [a for a in actions if a.get("status") != "Completed" and a.get("deadline") and a.get("deadline") < _today()]
    if overdue:
        triggers.append({"type": "overdue_actions", "label": f"{len(overdue)} overdue action(s)", "sev": "high"})

    risks = [r for r in groups["risks"].get(sid, []) if r.get("status") != "Closed"]
    high_risk = [r for r in risks if (r.get("risk_score") or 0) >= 9]
    if high_risk:
        triggers.append({"type": "high_risk", "label": f"{len(high_risk)} high/critical open risk(s)", "sev": "critical"})

    milestones = groups["milestones"].get(sid, [])
    delayed = [m for m in milestones if m.get("status") != "Completed" and m.get("target_date") and m.get("target_date") < _today()]
    if delayed:
        triggers.append({"type": "delayed_milestones", "label": f"{len(delayed)} delayed milestone(s)", "sev": "medium"})

    stage = st.get("stage", "")
    if stage in ("Revenue", "Growth/Scaling") and st.get("latest_revenue", 0) <= 0:
        triggers.append({"type": "no_revenue", "label": "Revenue-stage but no revenue recorded", "sev": "high"})

    if not st.get("primary_mentor"):
        triggers.append({"type": "no_mentor", "label": "No primary mentor assigned", "sev": "low"})

    funding_deadlines = [f for f in groups["funding"].get(sid, [])
                         if f.get("status") not in ("Approved", "Received", "Declined", "Closed", "Completed")
                         and f.get("deadline") and f.get("deadline") < _today()]
    if funding_deadlines:
        triggers.append({"type": "funding_deadline", "label": "Funding deadline passed", "sev": "medium"})

    fin = groups["financials"].get(sid, [])
    if not fin:
        triggers.append({"type": "no_financials", "label": "No financial KPI recorded", "sev": "low"})

    if st.get("updated_at"):
        try:
            updated = datetime.fromisoformat(st["updated_at"]).date()
            if (_today_iso() and (date.today() - updated).days > 60):
                triggers.append({"type": "stale", "label": "Record stale (>60 days)", "sev": "low"})
        except Exception:
            pass

    return triggers


def _today_iso():
    return _today()


def get_attention(limit=None):
    try:
        db = get_mongo_db()

        def _group_by_sid(collection):
            out = defaultdict(list)
            for doc in collection.find({}):
                sid = doc.get("startup_id")
                if sid is not None:
                    out[sid].append(doc)
            return out

        groups = {
            "actions": _group_by_sid(db["crm_actions"]),
            "risks": _group_by_sid(db["crm_risks"]),
            "milestones": _group_by_sid(db["crm_milestones"]),
            "funding": _group_by_sid(db["crm_funding"]),
            "financials": _group_by_sid(db["crm_financials"]),
        }

        startups = _startups_with_metrics(db)
        rows = []
        for st in startups:
            triggers = _attention_triggers(db, st, groups)
            if not triggers:
                st["_triggers"] = []
                continue
            st["_triggers"] = triggers
            rows.append(st)

        sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        rows.sort(key=lambda r: (-len(r["_triggers"]),
                                 sev_order.get(min((t.get("sev") for t in r["_triggers"]), default="low"), 3),
                                 -(r.get("health_score") or 0)))
        if limit:
            rows = rows[:limit]
        for r in rows:
            r["_id"] = str(r["_id"])
        return {"count": len(rows), "records": rows}
    except Exception as e:
        raise ServiceError(str(e))


# --------------------------------------------------------------------------
# CEO Dashboard
# --------------------------------------------------------------------------

def get_ceo_dashboard():
    try:
        db = get_mongo_db()
        startups = _startups_with_metrics(db)

        health_bands = {}
        for st in startups:
            band = st.get("health_band") or "Not Audited"
            health_bands[band] = health_bands.get(band, 0) + 1

        stages = {}
        for st in startups:
            s = st.get("stage") or "Unspecified"
            stages[s] = stages.get(s, 0) + 1

        # finance aggregates
        financials = list(db["crm_financials"].find({}))
        latest_month = None
        total_monthly_revenue = 0
        total_mrr = 0
        for f in financials:
            if f.get("month_end") and (latest_month is None or f["month_end"] > latest_month):
                latest_month = f["month_end"]
        if latest_month:
            for f in financials:
                if f.get("month_end") == latest_month:
                    total_monthly_revenue += float(f.get("revenue") or 0)
                    total_mrr += float(f.get("mrr") or 0)

        funding = list(db["crm_funding"].find({}))
        total_funding_received = sum(float(f.get("amount_received") or 0) for f in funding if f.get("status") in ("Approved", "Received", "Completed"))
        funding_pipeline = sum(float(f.get("amount_sought") or 0) for f in funding if f.get("status") not in ("Approved", "Received", "Declined", "Completed", "Closed"))

        deals = list(db["crm_deals"].find({}))
        deal_stages = {}
        total_pipeline = 0
        for d in deals:
            stage = d.get("sales_stage") or "Unspecified"
            deal_stages[stage] = deal_stages.get(stage, 0) + 1
            if d.get("deal_status", "Open") != "Won":
                total_pipeline += float(d.get("pipeline_value") or 0)

        actions = list(db["crm_actions"].find({}))
        overdue_actions = len([a for a in actions if a.get("status") != "Completed" and a.get("deadline") and a.get("deadline") < _today()])
        completed_actions = len([a for a in actions if a.get("status") == "Completed"])
        on_track_actions = completed_actions + len([a for a in actions if a.get("status") not in ("Completed", "Not Started") and not (a.get("deadline") and a.get("deadline") < _today())])

        colleges = db["crm_colleges"].count_documents({})
        students = list(db["crm_students"].find({}))
        student_referrals = len([s for s in students if s.get("referral") in ("Yes", "yes")])
        student_startups = len([s for s in students if s.get("startup_created") in ("Yes", "yes")])

        attention = get_attention(limit=8)

        upcoming_milestones = sorted(
            [m for m in db["crm_milestones"].find({}) if m.get("status") != "Completed" and m.get("target_date")],
            key=lambda m: m["target_date"]
        )[:6]

        return {
            "totals": {
                "startups": len(startups),
                "active_startups": len([s for s in startups if s.get("status") == "Active"]),
                "founders": db["crm_founders"].count_documents({}),
                "audits": db["crm_audits"].count_documents({}),
                "avg_health": round((sum(s.get("health_score") or 0 for s in startups if s.get("health_score") is not None) /
                                     max(len([s for s in startups if s.get("health_score") is not None]), 1) or 0), 1),
                "healthy_count": len([s for s in startups if (s.get("health_band") or "") in ("GREEN", "GROWTH")]),
                "attention_count": attention["count"],
                "colleges": colleges,
                "students": len(students),
                "student_referrals": student_referrals,
                "student_startups": student_startups,
            },
            "health_bands": [{"band": k, "count": v} for k, v in sorted(health_bands.items(), key=lambda x: -x[1])],
            "stages": [{"stage": k, "count": v} for k, v in sorted(stages.items(), key=lambda x: -x[1])],
            "finance": {
                "latest_month": latest_month,
                "monthly_revenue": round(total_monthly_revenue, 2),
                "mrr": round(total_mrr, 2),
                "funding_received": round(total_funding_received, 2),
                "funding_pipeline": round(funding_pipeline, 2),
            },
            "pipeline": {
                "deal_stages": [{"stage": k, "count": v} for k, v in sorted(deal_stages.items(), key=lambda x: -x[1])],
                "total_pipeline_value": round(total_pipeline, 2),
                "total_deals": len(deals),
                "won_deals": len([d for d in deals if d.get("deal_status") == "Won"]),
            },
            "execution": {
                "total_actions": len(actions),
                "overdue_actions": overdue_actions,
                "completed_actions": completed_actions,
                "on_track_actions": on_track_actions,
            },
            "attention": attention,
            "upcoming_milestones": [{
                "id": m.get("id"),
                "title": m.get("milestone"),
                "startup_id": m.get("startup_id"),
                "startup_name": _startup_map(db).get(m.get("startup_id"), ("", ""))[1] or "—",
                "target_date": m.get("target_date"),
                "status": m.get("status"),
                "owner": m.get("owner"),
            } for m in upcoming_milestones],
        }
    except Exception as e:
        raise ServiceError(str(e))


# --------------------------------------------------------------------------
# Deep Analytics
# --------------------------------------------------------------------------

def get_analytics():
    try:
        db = get_mongo_db()
        startups = _startups_with_metrics(db)

        def dist(key):
            out = {}
            for s in startups:
                v = s.get(key) or "Unspecified"
                out[v] = out.get(v, 0) + 1
            return [{"key": k, "count": v} for k, v in sorted(out.items(), key=lambda x: -x[1])]

        health_bands = dist("health_band")
        stages = dist("stage")
        sectors = dist("sector")

        # funding by stage
        funding = list(db["crm_funding"].find({}))
        funding_by_stage = {}
        for f in funding:
            stg = f.get("stage") or "Unspecified"
            d = funding_by_stage.setdefault(stg, {"count": 0, "received": 0.0, "sought": 0.0})
            d["count"] += 1
            d["received"] += float(f.get("amount_received") or 0)
            d["sought"] += float(f.get("amount_sought") or 0)
        funding_by_stage = [{"stage": k, **v} for k, v in sorted(funding_by_stage.items(), key=lambda x: -x[1]["received"])]

        # audit trend (avg total_score per month, last 8 months)
        audits = list(db["crm_audits"].find({}))
        monthly = {}
        for a in audits:
            if not a.get("audit_date"):
                continue
            try:
                ym = a["audit_date"][:7]
            except Exception:
                continue
            d = monthly.setdefault(ym, {"total": 0, "n": 0})
            d["total"] += a.get("total_score") or 0
            d["n"] += 1
        audit_trend = [{"month": k, "avg": round(v["total"] / v["n"], 1), "count": v["n"]}
                       for k, v in sorted(monthly.items())][-8:]

        # revenue trend across cohort
        financials = list(db["crm_financials"].find({}))
        rev_by_month = {}
        for f in financials:
            if not f.get("month_end"):
                continue
            ym = f["month_end"][:7]
            d = rev_by_month.setdefault(ym, {"revenue": 0.0, "expenses": 0.0, "n": 0})
            d["revenue"] += float(f.get("revenue") or 0)
            d["expenses"] += float(f.get("expenses") or 0)
            d["n"] += 1
        revenue_trend = [{"month": k, **v} for k, v in sorted(rev_by_month.items())][-8:]

        # deals funnel
        deals = list(db["crm_deals"].find({}))
        deal_funnel = {}
        for d in deals:
            stg = d.get("sales_stage") or "Unspecified"
            x = deal_funnel.setdefault(stg, {"count": 0, "value": 0.0})
            x["count"] += 1
            x["value"] += float(d.get("pipeline_value") or 0)
        deal_funnel = [{"stage": k, **v} for k, v in sorted(deal_funnel.items(), key=lambda x: -x[1]["value"])]

        # risks by category
        risks = list(db["crm_risks"].find({}))
        risk_by_cat = {}
        open_risks = 0
        for r in risks:
            cat = r.get("category") or "Unspecified"
            d = risk_by_cat.setdefault(cat, {"count": 0, "open": 0})
            d["count"] += 1
            if r.get("status") != "Closed":
                d["open"] += 1
                open_risks += 1
        risk_by_cat = [{"category": k, **v} for k, v in sorted(risk_by_cat.items(), key=lambda x: -x[1]["count"])]

        # founder demographics
        founders = list(db["crm_founders"].find({}))
        founder_gender = {}
        founder_student = {}
        for f in founders:
            g = f.get("gender") or "Unspecified"
            founder_gender[g] = founder_gender.get(g, 0) + 1
            st = f.get("student_status") or "Unspecified"
            founder_student[st] = founder_student.get(st, 0) + 1
        founder_gender = [{"key": k, "count": v} for k, v in sorted(founder_gender.items(), key=lambda x: -x[1])]
        founder_student = [{"key": k, "count": v} for k, v in sorted(founder_student.items(), key=lambda x: -x[1])]

        # customer / commercial analytics
        customers = list(db["crm_customers"].find({}))
        customer_revenue = sum(float(c.get("revenue") or 0) for c in customers)
        repeat_customers = len([c for c in customers if c.get("repeat_customer") == "Yes"])
        nps_avg = None
        nps = [c.get("nps") for c in customers if c.get("nps") not in (None, "")]
        if nps:
            nps_avg = round(sum(float(x) for x in nps) / len(nps), 1)

        return {
            "distributions": {
                "health_bands": health_bands,
                "stages": stages,
                "sectors": sectors,
            },
            "funding_by_stage": funding_by_stage,
            "audit_trend": audit_trend,
            "revenue_trend": revenue_trend,
            "deal_funnel": deal_funnel,
            "risk_by_category": risk_by_cat,
            "founder_demographics": {"gender": founder_gender, "student_status": founder_student},
            "commercial": {
                "customers": len(customers),
                "customer_revenue": round(customer_revenue, 2),
                "repeat_customers": repeat_customers,
                "nps_avg": nps_avg,
                "open_risks": open_risks,
                "total_funding_received": round(sum(float(f.get("amount_received") or 0) for f in funding), 2),
            },
            "totals": {
                "startups": len(startups),
                "audits": len(audits),
                "deals": len(deals),
                "financials": len(financials),
                "funding": len(funding),
                "risks": len(risks),
                "customers": len(customers),
                "founders": len(founders),
            },
        }
    except Exception as e:
        raise ServiceError(str(e))


# --------------------------------------------------------------------------
# Portfolio / My Work / University
# --------------------------------------------------------------------------

def get_portfolio():
    try:
        db = get_mongo_db()
        startups = _startups_with_metrics(db)
        for s in startups:
            s["_id"] = str(s.get("_id") or "")

        stage_buckets = {}
        for s in startups:
            stg = s.get("stage") or "Unspecified"
            stage_buckets.setdefault(stg, []).append(s)

        return {
            "startups": startups,
            "stage_buckets": [{"stage": k, "count": len(v), "records": v} for k, v in stage_buckets.items()],
            "totals": {
                "startups": len(startups),
                "funding_received": round(sum(float(s.get("funding_received") or 0) for s in startups), 2),
                "pipeline_value": round(sum(float(s.get("pipeline_value") or 0) for s in startups), 2),
                "monthly_revenue": round(sum(float(s.get("latest_revenue") or 0) for s in startups), 2),
            },
        }
    except Exception as e:
        raise ServiceError(str(e))


def get_mywork(owner=None):
    try:
        db = get_mongo_db()
        owner = (owner or "Incubation Manager").strip()

        def filter_docs(coll, name_field):
            q = {"$or": [{"owner": owner}, {"crm_owner": owner}, {"sales_owner": owner}]}
            docs = [d for d in coll.find(q) if d.get(name_field)]
            return docs

        startup_map = _startup_map(db)
        actions = [_enrich_refs(db, "actions", d, startup_map) for d in sorted(db["crm_actions"].find({}), key=lambda x: x.get("deadline") or "")]
        actions = [a for a in actions if a.get("owner") == owner]
        milestones = [_enrich_refs(db, "milestones", d, startup_map) for d in sorted(db["crm_milestones"].find({}), key=lambda x: x.get("target_date") or "")]
        milestones = [m for m in milestones if m.get("owner") == owner]
        risks = [_enrich_refs(db, "risks", d, startup_map) for d in db["crm_risks"].find({})]
        risks = [r for r in risks if r.get("owner") == owner]
        funding = [_enrich_refs(db, "funding", d, startup_map) for d in db["crm_funding"].find({})]
        funding = [f for f in funding if f.get("owner") == owner]

        today = _today()
        overdue = [a for a in actions if a.get("status") != "Completed" and a.get("deadline") and a.get("deadline") < today]
        due_this_week = [a for a in actions if a.get("status") != "Completed" and a.get("deadline") and today <= a.get("deadline") <= _days_ahead(7)]
        open_risks = [r for r in risks if r.get("status") != "Closed"]
        upcoming_milestones = [m for m in milestones if m.get("status") != "Completed" and m.get("target_date") and m.get("target_date") >= today]

        activity = list(db["crm_activity"].find({}).sort("created_at", -1).limit(30))
        for a in activity:
            a["_id"] = str(a["_id"])

        return {
            "owner": owner,
            "stats": {
                "my_actions": len(actions),
                "overdue": len(overdue),
                "due_this_week": len(due_this_week),
                "my_risks": len(risks),
                "open_risks": len(open_risks),
                "my_milestones": len(milestones),
                "upcoming_milestones": len(upcoming_milestones),
            },
            "actions": actions,
            "milestones": milestones,
            "risks": risks,
            "funding": funding,
            "overdue_actions": overdue,
            "due_this_week_actions": due_this_week,
            "open_risks": open_risks,
            "recent_activity": activity,
        }
    except Exception as e:
        raise ServiceError(str(e))


def _days_ahead(n):
    return (date.today() + timedelta(days=n)).isoformat()


def get_university():
    try:
        db = get_mongo_db()
        colleges = sorted(list(db["crm_colleges"].find({})), key=lambda c: c.get("id") or 0)
        students = sorted(list(db["crm_students"].find({})), key=lambda s: s.get("id") or 0)
        college_map = _college_map(db)
        students = [_enrich_refs(db, "students", s, None, college_map) for s in students]
        for s in students:
            s["_id"] = str(s.get("_id", ""))

        college_totals = {}
        for s in students:
            cid = s.get("college_id")
            d = college_totals.setdefault(cid, {"students": 0, "ideas": 0, "referrals": 0, "startups": 0})
            d["students"] += 1
            if s.get("idea"):
                d["ideas"] += 1
            if s.get("referral") in ("Yes", "yes"):
                d["referrals"] += 1
            if s.get("startup_created") in ("Yes", "yes"):
                d["startups"] += 1

        enriched_colleges = []
        for c in colleges:
            c = dict(c)
            c["_id"] = str(c.get("_id", ""))
            if c.get("id") in college_totals:
                c["active_students"] = college_totals[c["id"]]["students"]
                c["pipeline_ideas"] = college_totals[c["id"]]["ideas"]
                c["referrals"] = college_totals[c["id"]]["referrals"]
                c["referrals_count"] = college_totals[c["id"]]["referrals"]
                c["startups_created"] = college_totals[c["id"]]["startups"]
            else:
                c["active_students"] = c.get("students_reached") or 0
                c["pipeline_ideas"] = 0
                c["referrals"] = c.get("referrals") or 0
                c["referrals_count"] = c.get("referrals") or 0
                c["startups_created"] = 0
            enriched_colleges.append(c)

        return {
            "colleges": enriched_colleges,
            "students": students,
            "totals": {
                "colleges": len(colleges),
                "mou_signed": len([c for c in colleges if c.get("mou") in ("Signed", "Active")]),
                "students_reached": sum(int(c.get("students_reached") or 0) for c in colleges),
                "ideas_generated": sum(int(c.get("ideas_generated") or 0) for c in colleges),
                "referrals": sum(int(c.get("referrals_count") or 0) for c in enriched_colleges),
                "student_pipeline": len(students),
                "startups_created": len([s for s in students if s.get("startup_created") in ("Yes", "yes")]),
            },
        }
    except Exception as e:
        raise ServiceError(str(e))


def get_summary_counts():
    try:
        db = get_mongo_db()
        return {
            "startups": db["crm_startups"].count_documents({}),
            "founders": db["crm_founders"].count_documents({}),
            "audits": db["crm_audits"].count_documents({}),
            "milestones": db["crm_milestones"].count_documents({}),
            "actions": db["crm_actions"].count_documents({}),
            "risks": db["crm_risks"].count_documents({}),
            "customers": db["crm_customers"].count_documents({}),
            "deals": db["crm_deals"].count_documents({}),
            "financials": db["crm_financials"].count_documents({}),
            "funding": db["crm_funding"].count_documents({}),
            "colleges": db["crm_colleges"].count_documents({}),
            "students": db["crm_students"].count_documents({}),
        }
    except Exception as e:
        raise ServiceError(str(e))


def get_ref_options():
    try:
        db = get_mongo_db()
        return {
            "startups": [{"id": s["id"], "name": f"{s.get('code','')} – {s.get('name','')}"} for s in db["crm_startups"].find({}).sort("id", 1)],
            "colleges": [{"id": c["id"], "name": c.get("name", "")} for c in db["crm_colleges"].find({}).sort("id", 1)],
        }
    except Exception as e:
        raise ServiceError(str(e))


# --------------------------------------------------------------------------
# Live sync from ecosystem uploads (directory startups + cohort applications)
# This is the SOURCE OF TRUTH for the CRM portfolio & student pipeline.
# No mock/demo data is ever auto-generated.
# --------------------------------------------------------------------------

SYNC_TTL_SECONDS = 60

DEMO_SEED_STARTUPS = {
    "AgriSense Analytics", "MediPulse AI", "EduPath Learning", "SolarGrid Works",
    "LogiTrack India", "FinSahay", "CropCare Bharat", "RetailVue",
}
DEMO_SEED_STUDENTS = {
    "Aarav Singh", "Ishita Rao", "Rohan Joshi", "Meera Nair",
    "Yash Thakur", "Sanika Patil", "Devendra Wagh",
}
DEMO_SEED_COLLEGES = {
    "Ramdeobaba College of Engineering", "G H Raisoni College", "Vidya Vikas College",
    "S B Jain Institute", "Hislop College", "St. Francis De Sales",
}


def _fmt(value):
    return ("" if value is None else str(value)).strip()


def _by_name(coll, name):
    n = (name or "").strip()
    if not n:
        return None
    return coll.find_one({"name": n})


def _purge_demo_leftovers(db):
    """Remove records produced by the old auto-seed so only real uploads remain.
    Only records WITHOUT a ``source_ref`` (i.e. never created by a live sync)
    are touched, so real uploads with matching names are never deleted."""
    def _name_filter(collection, names):
        return {"name": {"$in": list(names)}, "source_ref": {"$exists": False}}

    ids = {s["id"] for s in db["crm_startups"].find(_name_filter(db["crm_startups"], DEMO_SEED_STARTUPS), {"id": 1})}
    if ids:
        db["crm_startups"].delete_many({"id": {"$in": list(ids)}})
        for coll in ("crm_founders", "crm_audits", "crm_milestones", "crm_actions",
                     "crm_risks", "crm_customers", "crm_deals", "crm_financials", "crm_funding"):
            db[coll].delete_many({"startup_id": {"$in": list(ids)}})
    db["crm_students"].delete_many({"student_name": {"$in": list(DEMO_SEED_STUDENTS)}, "source_ref": {"$exists": False}})
    db["crm_colleges"].delete_many(_name_filter(db["crm_colleges"], DEMO_SEED_COLLEGES))


def sync_from_ecosystem(force=False):
    """Import real ecosystem uploads (directory startups + cohort applications)
    into the CRM startup, founder, college and student pipeline. Re-runs are
    idempotent (keyed on the source document) and preserve CRM-side fields."""
    try:
        db = get_mongo_db()
        now = datetime.now()
        now_iso = now.isoformat()

        src_startups = db["startups"].count_documents({})
        src_apps = db["incubein_applications"].count_documents({})

        meta = db["crm_counters"].find_one({"_id": "sync_meta"})
        if not force and meta and db["crm_startups"].count_documents({}) > 0:
            try:
                last = datetime.fromisoformat(str(meta.get("last_sync_at", "")))
                if (now - last).total_seconds() < SYNC_TTL_SECONDS:
                    return {
                        "status": "up-to-date",
                        "message": "CRM already in sync with your uploads.",
                        "imported": {"startups": 0, "founders": 0, "students": 0, "colleges": 0},
                        "collections": {"startups": src_startups, "incubein_applications": src_apps},
                    }
            except (TypeError, ValueError):
                pass

        _purge_demo_leftovers(db)
        imported = {"startups": 0, "founders": 0, "students": 0, "colleges": 0}

        # 1) Startups / founders — from the ecosystem directory `startups` collection
        for doc in db["startups"].find({}):
            name = _fmt(doc.get("startup_name"))
            if not name:
                continue
            existing = db["crm_startups"].find_one({"source_ref": "startups:%s" % doc.get("_id")})
            if not existing:
                existing = _by_name(db["crm_startups"], name)

            city = _fmt(doc.get("hq_city")) or _fmt(doc.get("city"))
            stage = _fmt(doc.get("stage_category")) or _fmt(doc.get("funding_stage")) or "Ideation"
            is_cohort = doc.get("incubator_id") == "incubein_cohort"
            synced_fields = {
                "name": name,
                "sector": _fmt(doc.get("sector")) or "",
                "stage": stage,
                "program": _fmt(doc.get("funding_stage")) or _fmt(doc.get("program")) or "",
                "city": city,
                "operating_location": city,
                "state": _fmt(doc.get("state")) or "Maharashtra",
                "status": _fmt(doc.get("status")) or "Active",
                "website": _fmt(doc.get("website")) or "",
                "email": _fmt(doc.get("email")) or "",
                "phone": _fmt(doc.get("phone")) or "",
                "business_model": _fmt(doc.get("business_model")) or "",
                "entry_route": "Cohort Import" if is_cohort else "Directory Upload",
                "incubator_id": _fmt(doc.get("incubator_id")) or "",
                "confidence_score": doc.get("confidence_score"),
                "source_ref": "startups:%s" % doc.get("_id"),
                "source_synced_at": now_iso,
                "updated_at": now_iso,
            }
            if existing:
                for key in ("id", "code", "created_at", "crm_owner", "relationship_manager",
                            "primary_mentor", "health_score", "health_band", "record_status"):
                    if existing.get(key) is not None:
                        synced_fields[key] = existing[key]
                db["crm_startups"].update_one({"_id": existing["_id"]}, {"$set": synced_fields})
                sid = existing["id"]
            else:
                sid = _next_id(db, "crm_startups")
                db["crm_startups"].insert_one({
                    "id": sid, "code": "INC-%04d" % sid, "name": name, "previous_name": "",
                    "startup_type": "Technology", "application_date": "", "selection_date": "",
                    "incubation_start": "", "graduation_date": "", "geography": "Vidarbha",
                    "district": "", "address": "", "crm_owner": "Incubation Manager",
                    "relationship_manager": "Incubation Manager", "primary_mentor": "",
                    "source_college": "", "remarks": "", "created_at": now_iso,
                    **synced_fields,
                })
                imported["startups"] += 1

            for fname in [f.strip() for f in _fmt(doc.get("founders")).replace(";", ",").split(",") if f.strip()]:
                if db["crm_founders"].find_one({"startup_id": sid, "name": fname}):
                    continue
                db["crm_founders"].insert_one({
                    "id": _next_id(db, "crm_founders"), "startup_id": sid, "name": fname,
                    "founder_type": "Founder", "role": "Founder", "gender": "", "age_group": "",
                    "student_status": "", "institution": "", "department": "",
                    "qualification": "", "discipline": "", "commitment": "",
                    "email": "", "phone": "", "linkedin": "", "remarks": "",
                    "source_ref": "startups:%s" % doc.get("_id"), "created_at": now_iso, "updated_at": now_iso,
                })
                imported["founders"] += 1

        # 2) Students / colleges — from the cohort evaluation applications
        for doc in db["incubein_applications"].find({}):
            sname = _fmt(doc.get("name"))
            startup_name = _fmt(doc.get("startup_name"))
            if not sname and not startup_name:
                continue

            college_name = _fmt(doc.get("school_university")) or "RTMNU Affiliated College"
            col = _by_name(db["crm_colleges"], college_name)
            if col:
                cid = col["id"]
            else:
                cid = _next_id(db, "crm_colleges")
                db["crm_colleges"].insert_one({
                    "id": cid, "code": "COL-%03d" % cid, "name": college_name, "district": "",
                    "taluka": "", "college_type": "Affiliated", "principal": "", "principal_contact": "",
                    "coordinator": "", "coordinator_contact": "", "email": "", "startup_cell": "",
                    "first_contact": "", "last_visit": "", "next_visit": "", "students_reached": 0,
                    "ideas_generated": 0, "ideas_screened": 0, "referrals": 0, "mou": "",
                    "mou_date": "", "status": "Active", "owner": "Manager Innovation", "remarks": "",
                    "source_ref": "apps:college:%s" % college_name, "created_at": now_iso, "updated_at": now_iso,
                })
                imported["colleges"] += 1

            linked = _by_name(db["crm_startups"], startup_name) if startup_name else None
            stage = _fmt(doc.get("stage_category")) or "Ideation"
            idea = _fmt(doc.get("business_summary"))[:400] or startup_name or ""

            # Every cohort application is also a portfolio candidate: if no startup
            # with the same name exists in the CRM yet, create one straight from the
            # MongoDB application so uploads always show up on the CRM pages.
            if not linked and startup_name:
                app_city = _fmt(doc.get("city_state"))
                city = app_city.split(",")[0].strip() if app_city else ""
                app_sid = _next_id(db, "crm_startups")
                db["crm_startups"].insert_one({
                    "id": app_sid, "code": "INC-%04d" % app_sid, "name": startup_name,
                    "previous_name": "", "startup_type": "Technology", "program": "",
                    "stage": stage, "entry_route": "Cohort Application",
                    "status": "Shortlisted", "sector": _fmt(doc.get("sector")) or "",
                    "business_model": "", "geography": "Vidarbha", "state": "Maharashtra",
                    "district": "", "city": city, "operating_location": city,
                    "website": _fmt(doc.get("website")) or "", "email": "", "phone": "",
                    "address": "", "crm_owner": "Incubation Manager",
                    "relationship_manager": "Incubation Manager", "primary_mentor": "",
                    "source_college": "", "application_date": _fmt(doc.get("timestamp"))[:10],
                    "confidence_score": doc.get("final_score"),
                    "record_status": "Shortlisted", "remarks": "",
                    "source_ref": "apps:%s" % doc.get("_id"), "source_synced_at": now_iso,
                    "created_at": now_iso, "updated_at": now_iso,
                })
                imported["startups"] += 1
                if sname and not db["crm_founders"].find_one({"startup_id": app_sid, "name": sname}):
                    db["crm_founders"].insert_one({
                        "id": _next_id(db, "crm_founders"), "startup_id": app_sid, "name": sname,
                        "founder_type": "Founder", "role": "Founder", "gender": _fmt(doc.get("gender")) or "",
                        "age_group": "", "student_status": "", "institution": college_name,
                        "department": "", "qualification": _fmt(doc.get("highest_qualification")) or "",
                        "discipline": "", "commitment": "", "email": "", "phone": "",
                        "linkedin": "", "remarks": "",
                        "source_ref": "apps:%s" % doc.get("_id"), "created_at": now_iso, "updated_at": now_iso,
                    })
                    imported["founders"] += 1
                linked = {"id": app_sid}

            existing = db["crm_students"].find_one({"source_ref": "apps:%s" % doc.get("_id")})
            if existing:
                db["crm_students"].update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "student_name": sname or "Unknown", "college_id": cid,
                        "course": _fmt(doc.get("highest_qualification")) or "",
                        "idea": idea, "sector": _fmt(doc.get("sector")) or "",
                        "stage": stage, "startup_created": "Yes" if linked else "No",
                        "startup_id": linked["id"] if linked else None,
                        "gender": _fmt(doc.get("gender")) or "",
                        "priority": _fmt(doc.get("priority")) or "Medium",
                        "source_synced_at": now_iso, "updated_at": now_iso,
                    }},
                )
            else:
                stu_id = _next_id(db, "crm_students")
                db["crm_students"].insert_one({
                    "id": stu_id, "code": "STU-%03d" % stu_id, "college_id": cid,
                    "student_name": sname or "Unknown", "course": _fmt(doc.get("highest_qualification")) or "",
                    "year": "", "gender": _fmt(doc.get("gender")) or "", "email": "", "phone": "",
                    "idea": idea, "sector": _fmt(doc.get("sector")) or "", "problem": "",
                    "mentor": "", "stage": stage, "validation": "", "prototype": "",
                    "referral": "No", "referral_date": "", "startup_created": "Yes" if linked else "No",
                    "startup_id": linked["id"] if linked else None, "owner": "Manager Innovation",
                    "remarks": "", "priority": _fmt(doc.get("priority")) or "Medium",
                    "source_ref": "apps:%s" % doc.get("_id"), "source_synced_at": now_iso,
                    "created_at": now_iso, "updated_at": now_iso,
                })
                imported["students"] += 1

        db["crm_counters"].update_one({"_id": "sync_meta"}, {"$set": {"last_sync_at": now_iso}}, upsert=True)
        if imported["startups"] or imported["students"]:
            _refresh_startup_health(db)

        print("CRM sync: MongoDB collections -> startups:%d, incubein_applications:%d; imported %r"
              % (src_startups, src_apps, imported))

        return {
            "status": "synced",
            "message": "MongoDB sync: +%d startups, +%d founders, +%d students, +%d colleges."
                       % (imported["startups"], imported["founders"], imported["students"], imported["colleges"]),
            "imported": imported,
            "collections": {"startups": src_startups, "incubein_applications": src_apps},
            "synced_at": now_iso,
        }
    except Exception as e:
        print("CRM sync FAILED: %s" % str(e))
        raise ServiceError("Failed to sync CRM with ecosystem uploads: %s" % str(e))


# --------------------------------------------------------------------------
# Demo seed (only when collections are empty)
# --------------------------------------------------------------------------

def demo_seeded():
    try:
        db = get_mongo_db()
        return db["crm_startups"].count_documents({}) > 0
    except Exception:
        return False


def seed_demo():
    """Populate a realistic demo dataset the first time the CRM is opened."""
    try:
        db = get_mongo_db()
        if db["crm_startups"].count_documents({}) > 0:
            return {"status": "skipped", "message": "CRM already has data; demo seed skipped."}

        now = datetime.now().isoformat()

        def base(d):
            d["created_at"] = now
            d["updated_at"] = now
            return d

        is_ = date(2026, 9, 1)
        i30 = date(2026, 9, 30)
        i60 = date(2026, 10, 30)
        i90 = date(2026, 11, 30)

        def ds(d):
            return d.isoformat()

        startup_rows = [
            ("AgriSense Analytics", "Ideation", "AgriTech", "Nagpur", "Active", "Seed Stage"),
            ("MediPulse AI", "Prototype", "HealthTech", "Nagpur", "Active", "Seed Stage"),
            ("EduPath Learning", "MVP/Pre-Revenue", "EdTech", "Amravati", "Active", "MVP/Pre-Revenue"),
            ("SolarGrid Works", "Revenue", "CleanTech", "Nagpur", "Active", "Revenue"),
            ("LogiTrack India", "Growth/Scaling", "Logistics", "Pune", "Active", "Growth/Scaling"),
            ("FinSahay", "Prototype", "FinTech", "Nagpur", "Active", "Prototype"),
            ("CropCare Bharat", "Ideation", "AgriTech", "Wardha", "Active", "Ideation"),
            ("RetailVue", "MVP/Pre-Revenue", "RetailTech", "Nagpur", "Active", "MVP/Pre-Revenue"),
        ]
        st_id = {}
        for i, (name, stg, sector, city, status, program) in enumerate(startup_rows, start=1):
            st_id[i] = i
            db["crm_startups"].insert_one(base({
                "id": i, "code": f"INC-{i:04d}", "name": name, "previous_name": "",
                "startup_type": "Technology", "program": program, "stage": stg, "entry_route": "Application",
                "status": status, "priority": "High" if i <= 3 else "Medium", "application_date": ds(date(2026, 1, 15)),
                "selection_date": ds(date(2026, 3, 1)), "incubation_start": ds(date(2026, 3, 15)),
                "graduation_date": "", "sector": sector, "business_model": "B2B",
                "geography": "Vidarbha", "state": "Maharashtra", "district": "", "city": city,
                "operating_location": city, "website": f"https://www.{name.lower().replace(' ', '')}.in",
                "email": f"hello@{name.lower().replace(' ', '')}.in", "phone": "94221 43556",
                "address": "", "crm_owner": "Incubation Manager", "relationship_manager": "Incubation Manager",
                "primary_mentor": "Prof. R. Deshmukh" if i in (2, 5) else "", "source_college": "",
                "record_status": "Active", "remarks": "",
            }))

        founder_rows = [
            (1, "Pooja More", "Founder", "CEO", "Male", "Non-student"), (1, "Kunal Agrawal", "Co-Founder", "CTO", "Female", "Non-student"),
            (2, "Dr. Nikhil Kulkarni", "Founder", "CEO", "Male", "Non-student"),
            (3, "Sneha Kadam", "Founder", "CEO", "Female", "Alumnus"),
            (4, "Arjun Bhosale", "Founder", "CEO", "Male", "Non-student"), (4, "Ritu Rathi", "Co-Founder", "COO", "Female", "Non-student"),
            (5, "Mohit Jain", "Founder", "CEO", "Male", "Non-student"),
            (6, "Ananya Deshpande", "Founder", "CEO", "Female", "Student"),
            (7, "Sahil Gajbhiye", "Founder", "Founder", "Male", "Student"),
            (8, "Tanvi Mankar", "Founder", "CEO", "Female", "Alumnus"),
        ]
        for i, row in enumerate(founder_rows, start=1):
            sid, name, ftype, role, gender, student = row
            db["crm_founders"].insert_one(base({
                "id": i, "startup_id": sid, "name": name, "founder_type": ftype, "role": role,
                "gender": gender, "age_group": "25-34", "student_status": student, "institution": "RTMNU",
                "department": "Engineering", "qualification": "Post Graduate", "discipline": "Engineering",
                "commitment": "Full-time", "email": f"{name.split()[0].lower()}@email.com", "phone": "98230 12345",
                "linkedin": "", "remarks": "",
            }))

        # audits with criterion scores adding to a desired band
        audit_specs = [
            (1, 82), (2, 76), (3, 68), (4, 88), (5, 72), (6, 58), (7, 44), (8, 62),
        ]
        base_criteria = {"founder_team": 8, "problem_validation": 7, "technology_product": 10,
                         "market": 7, "business_model": 7, "traction": 9, "financial": 7,
                         "ip_legal": 7, "funding": 4, "engagement": 4}
        weights = [10, 10, 15, 10, 10, 15, 10, 10, 5, 5]
        crit_keys = [c[0] for c in AUDIT_CRITERIA]
        for i, (sid, target) in enumerate(audit_specs, start=1):
            # scale base criteria to hit target
            tot = sum(base_criteria[k] for k in crit_keys)
            scale = (target / tot) if tot else 1

            def sco(v):
                return min(v, round(v * scale))

            scores = {k: sco(base_criteria[k]) for k in crit_keys}
            total = sum(scores.values())
            while total < target and max(scores.values()) < 10:
                k = max(crit_keys, key=lambda k_: scores[k_])
                scores[k] += 1
                total = sum(scores.values())
            db["crm_audits"].insert_one(base({
                "id": i, "startup_id": sid, "audit_type": "Entry Audit" if i % 2 else "Quarterly Review",
                "audit_date": ds(date(2026, 6, 20 + i)), "auditor": "Incubation Manager",
                **scores, "total_score": total, "band": _health_band(total),
                "strengths": "Clear problem-solution fit; engaged team.",
                "gaps": "Needs stronger go-to-market execution.",
                "ceo_decision": "Continue Support", "next_review": ds(date(2026, 11, 1)), "remarks": "",
            }))

        members = ["Incubation Manager", "Manager Innovation", "Technical Assistant", "CEO"]
        for i, sid in enumerate(st_id, start=1):
            db["crm_milestones"].insert_one(base({
                "id": i, "startup_id": sid, "milestone": "Product Prototype v1",
                "status": "Completed" if i % 3 else "In Progress", "target_date": ds(date(2026, 8, 1)),
                "actual_date": ds(date(2026, 8, 12)) if i % 3 == 0 else "", "owner": members[i % len(members)],
                "evidence": "Demo video link", "verified_by": "Incubation Manager", "remarks": "",
            }))

        action_specs = [
            (1, "Secure 5 pilot customers", 5, 3, "In Progress", 22, "High"),
            (2, "File provisional patent", 1, 0, "In Progress", 60, "Medium"),
            (3, "Launch LMS pilot in 2 colleges", 2, 2, "Completed", 15, "High"),
            (4, "Close seed round of ₹50L", 50, 35, "In Progress", 45, "High"),
            (5, "Reach ₹10L ARR", 10, 8, "In Progress", 30, "High"),
            (6, "Publish clinical validation", 1, 0, "Not Started", 90, "Medium"),
            (7, "Recruit 2 co-founders", 2, 1, "In Progress", 14, "Medium"),
            (8, "Sign 3 retail stores", 3, 2, "In Progress", 21, "High"),
        ]
        for i, (sid, action, tgt, act, status, days_left, prio) in enumerate(action_specs, start=1):
            deadline = _dt_days(days_left)
            db["crm_actions"].insert_one(base({
                "id": i, "startup_id": sid, "source": "Audit", "action": action,
                "kpi": action, "baseline": 0, "target": tgt, "actual": act,
                "owner": members[i % len(members)], "priority": prio, "start_date": ds(date(2026, 7, 1)),
                "deadline": deadline.isoformat(), "status": status, "completion_date": ds(date(2026, 9, 10)) if status == "Completed" else "",
                "ceo_remark": "", "rag": "GREEN" if (tgt and act >= tgt) or status == "Completed" else "AMBER" if tgt and act >= tgt * 0.8 else "RED",
            }))

        risk_specs = [
            (1, "Market", "Customer adoption slower than planned", 4, 4, "High", "Open"),
            (2, "Regulatory", "Medical device clearance delayed", 3, 5, "High", "Open"),
            (3, "Financial", "Delayed institutional payments", 3, 3, "Medium", "Open"),
            (4, "Market", "Competitor pricing pressure", 4, 3, "Medium", "Open"),
            (5, "Financial", "Contractor attrition during scale-up", 3, 4, "Medium", "Open"),
            (6, "Technical", "Model accuracy below target", 2, 4, "Medium", "Open"),
            (7, "Team", "Key founder considering exit", 4, 5, "Critical", "Open"),
            (8, "Financial", "Working capital gap", 2, 3, "Low", "Open"),
        ]
        for i, (sid, cat, risk, prob, imp, level, status) in enumerate(risk_specs, start=1):
            db["crm_risks"].insert_one(base({
                "id": i, "startup_id": sid, "category": cat, "risk": risk, "probability": prob,
                "impact": imp, "risk_score": prob * imp, "risk_level": level, "mitigation": "Monthly review with incubation manager",
                "owner": members[i % len(members)], "target_date": ds(date(2026, 10, 1)), "status": status,
                "residual_risk": "Medium", "last_reviewed": ds(date(2026, 8, 20)), "remarks": "",
            }))

        customer_specs = [
            (1, "AgroTech Enterprises", "B2B", 120000, "Customer"), (1, "Krishi Mandi Pune", "B2B", 80000, "Prospect"),
            (3, "St. Xavier College", "B2B", 90000, "Customer"), (3, "Pioneer College", "B2B", 60000, "Prospect"),
            (4, "Vidarbha Housing", "B2B", 350000, "Customer"), (4, "SolarOne Energy", "B2B", 250000, "Prospect"),
            (5, "Fastmove Logistics", "B2B", 500000, "Customer"), (8, "CityMart Retail", "B2B", 140000, "Prospect"),
        ]
        for i, (sid, name, ctype, rev, cstatus) in enumerate(customer_specs, start=1):
            db["crm_customers"].insert_one(base({
                "id": i, "startup_id": sid, "name": name, "customer_type": ctype, "geography": "Maharashtra",
                "lead_source": "Referral", "lead_status": "Qualified Lead" if cstatus == "Prospect" else "Won",
                "customer_status": cstatus, "first_contact": ds(date(2026, 5, 1)), "first_purchase": ds(date(2026, 6, 1)) if cstatus == "Customer" else "",
                "revenue": rev, "repeat_customer": "Yes" if cstatus == "Customer" else "No",
                "contract_value": rev * 3, "renewal_date": ds(date(2026, 12, 1)), "nps": 8, "feedback": "",
                "owner": "Incubation Manager", "remarks": "",
            }))

        deal_specs = [
            (1, "AgroTech pilot – 6 months", "Proposal", 250000, "Open"), (2, "Hospital pilot", "Negotiation", 400000, "Open"),
            (3, "LMS annual licence", "Demo", 180000, "Open"), (4, "Solar retrofit project", "Closing", 900000, "Open"),
            (5, "3-year logistics contract", "Negotiation", 1500000, "Open"), (6, "BFSI sandbox engagement", "Discovery", 600000, "Open"),
            (8, "Retail analytics POC", "Proposal", 300000, "Open"),
        ]
        for i, (sid, name, stage, val, dstatus) in enumerate(deal_specs, start=1):
            db["crm_deals"].insert_one(base({
                "id": i, "startup_id": sid, "deal_name": name, "sales_stage": stage, "pipeline_value": val,
                "expected_close": ds(date(2026, 9, 30)), "actual_close": "", "deal_status": dstatus,
                "sales_owner": "Incubation Manager", "next_action": "Follow-up call", "next_action_date": ds(date(2026, 9, 20)),
                "remarks": "",
            }))

        month_ends = [date(2026, 4, 30), date(2026, 5, 31), date(2026, 6, 30), date(2026, 7, 31)]
        months = ["April", "May", "June", "July"]
        fin_i = 1
        for sid in st_id:
            base_rev = max(8000, sid * 25000)
            for mi, mend in enumerate(month_ends):
                db["crm_financials"].insert_one(base({
                    "id": fin_i, "startup_id": sid, "fy": "FY 2026-27", "month": months[mi],
                    "month_end": mend.isoformat(), "revenue": base_rev * (mi + 1) * (0.7 if sid % 2 else 1.0),
                    "mrr": base_rev * (mi + 1), "cogs": base_rev * 0.4, "expenses": base_rev * 0.9,
                    "cash_balance": 500000 + sid * 10000 - mi * 40000, "team_size": min(20, 2 + sid + mi),
                    "jobs_created": min(10, sid + mi), "gst_paid": base_rev * 0.05, "statements": "Submitted",
                    "remarks": "",
                }))
                fin_i += 1

        funding_specs = [
            (1, "Seed", "Dormant Beginning", "mahamission Startup Fund", 1500000, 400000, "Partial"),
            (2, "Pre-Seed", "CSI Scheme", 800000, 800000, "Received"),
            (4, "Seed", "GEM Funding", 2000000, 600000, "In Negotiation"),
            (5, "Series A", "Private VC", 5000000, 0, "In Discussion"),
            (6, "Pre-Seed", "BIRAC", 1200000, 0, "Applied"),
            (3, "Seed", "AVISHKAR Scheme", 1000000, 300000, "Applied"),
            (7, "Pre-Seed", "SSIP Grant", 500000, 500000, "Received"),
            (8, "Seed", "Dormant Beginning", 900000, 0, "Applied"),
        ]
        for i, (sid, stg, src, scheme, sought, recv, status) in enumerate(funding_specs, start=1):
            db["crm_funding"].insert_one(base({
                "id": i, "startup_id": sid, "stage": stg, "source": src, "scheme": scheme,
                "readiness": "Investment Ready", "amount_sought": sought, "amount_received": recv,
                "equity_offered": 10, "valuation": 50000000, "application_date": ds(date(2026, 4, 1)),
                "decision_date": ds(date(2026, 6, 1)) if recv else "", "status": status,
                "investor": "", "next_action": "Update deck", "owner": "Incubation Manager",
                "deadline": ds(date(2026, 10, 1)), "remarks": "",
            }))

        college_names = [
            ("Ramdeobaba College of Engineering", "Nagpur", "Engineering", 3, 120, "Signed"),
            ("G H Raisoni College", "Nagpur", "Engineering", 2, 90, "Signed"),
            ("Vidya Vikas College", "Amravati", "Commerce", 1, 60, "Draft"),
            ("S B Jain Institute", "Nagpur", "Management", 2, 80, "Signed"),
            ("Hislop College", "Nagpur", "Science", 1, 55, "In Process"),
            ("St. Francis De Sales", "Nagpur", "Arts", 1, 40, "In Process"),
        ]
        col_id = {}
        for i, (name, dist, ctype, ideas, students_reached, mou) in enumerate(college_names, start=1):
            col_id[i] = i
            db["crm_colleges"].insert_one(base({
                "id": i, "code": f"COL-{i:03d}", "name": name, "district": dist, "taluka": "",
                "college_type": ctype, "principal": "", "principal_contact": "", "coordinator": "Innovation Coordinator",
                "coordinator_contact": "98230 00000", "email": "coord@email.com", "startup_cell": "Yes",
                "first_contact": ds(date(2026, 2, 1)), "last_visit": ds(date(2026, 8, 1)), "next_visit": ds(date(2026, 10, 1)),
                "students_reached": students_reached, "ideas_generated": ideas, "ideas_screened": max(2, ideas - 1),
                "referrals": max(1, students_reached // 30), "mou": mou, "mou_date": ds(date(2026, 4, 15)) if mou == "Signed" else "",
                "status": "Active", "owner": "Manager Innovation", "remarks": "",
            }))

        student_names = [
            (1, "Aarav Singh", "B.Tech", "AgriTech", "Crop pest monitoring app", "Referred", "No"),
            (1, "Ishita Rao", "B.Tech", "HealthTech", "Tele-medicine for clinics", "In Progress", "No"),
            (2, "Rohan Joshi", "B.E.", "FinTech", "College fee financing", "Referred", "Yes"),
            (3, "Meera Nair", "BBA", "EdTech", "Skill marketplace", "In Progress", "No"),
            (4, "Yash Thakur", "MBA", "CleanTech", "Solar micro-grids", "Referred", "No"),
            (5, "Sanika Patil", "B.Sc", "AgriTech", "Organic produce platform", "In Progress", "No"),
            (6, "Devendra Wagh", "B.A.", "EdTech", "Regional language content", "Referred", "No"),
        ]
        student_stage = {"Referred": "MVP/Pre-Revenue", "In Progress": "Ideation"}
        for i, (cid, name, course, sector, idea, progress, started) in enumerate(student_names, start=1):
            db["crm_students"].insert_one(base({
                "id": i, "code": f"STU-{i:03d}", "college_id": cid, "student_name": name, "course": course,
                "year": "Final Year", "gender": "Male" if i % 2 else "Female", "email": f"{name.split()[0].lower()}@email.com",
                "phone": "90220 12345", "idea": idea, "sector": sector, "problem": "", "mentor": "Prof. R. Deshmukh",
                "stage": student_stage[progress], "validation": "Early Interviews", "prototype": "No",
                "referral": "Yes" if progress == "Referred" else "No", "referral_date": ds(date(2026, 7, 1)) if progress == "Referred" else "",
                "startup_created": started, "startup_id": None, "owner": "Manager Innovation", "remarks": "",
            }))

        _refresh_startup_health(db)

        return {"status": "success", "message": "CRM demo dataset seeded (8 startups, founders, audits, executions, commercial + university)."}
    except Exception as e:
        raise ServiceError(f"Failed to seed demo data: {str(e)}")


def _dt_days(days):
    return date.today() + timedelta(days=days)


def ensure_seeded():
    """Fast health-check for the CRM database.

    Full ecosystem sync is intentionally not run on every request because it can
    block the CRM APIs for several seconds and cause the frontend to show a
    timeout even when the database is simply unavailable or slow.
    """
    try:
        db = get_mongo_db()
        db.command("ping", maxTimeMS=1200)
        return {"status": "ok", "message": "CRM database reachable."}
    except Exception:
        return {"status": "skipped", "message": "CRM sync skipped; MongoDB unavailable."}