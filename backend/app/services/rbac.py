"""Role-Based Access Control (RBAC) — user & role administration.

Stores users and roles in MongoDB collections (``users`` / ``roles``) scoped to
the same ``ecosystem`` database as the rest of the platform. Passwords are
hashed with PBKDF2-SHA256 (stdlib only) and never returned by API responses.

This module only administers users/roles/permissions — no login enforcement is
performed yet (by design).
"""

import hashlib
import hmac
import re
import secrets
from datetime import datetime

import pymongo

from ..core.exceptions import BadRequestError, NotFoundError, ServiceError
from ..core.database import get_mongo_db

PBKDF2_ITERATIONS = 120_000

# Canonical feature/permission catalogue (mirrors the frontend sidebar).
FEATURES = [
    {"id": "dashboard", "label": "Dashboard", "section": "Analytics"},
    {"id": "ceo_dashboard", "label": "CEO Dashboard", "section": "Executive"},
    {"id": "deep_analytics", "label": "Deep Analytics", "section": "Executive"},
    {"id": "attention", "label": "Attention Required", "section": "Executive"},
    {"id": "my_work", "label": "My Work", "section": "Executive"},
    {"id": "university", "label": "University", "section": "University"},
    {"id": "colleges", "label": "Colleges", "section": "University"},
    {"id": "students", "label": "Student Pipeline", "section": "University"},
    {"id": "portfolio", "label": "Portfolio", "section": "Incubation CRM"},
    {"id": "startups", "label": "Startups", "section": "Incubation CRM"},
    {"id": "founders", "label": "Founders & Team", "section": "Incubation CRM"},
    {"id": "audits", "label": "Startup Audits", "section": "Incubation CRM"},
    {"id": "milestones", "label": "Milestones", "section": "Execution"},
    {"id": "actions", "label": "90-Day Action Tracker", "section": "Execution"},
    {"id": "action_plans", "label": "90-Day Action Plans", "section": "Execution"},
    {"id": "risks", "label": "Risk Register", "section": "Execution"},
    {"id": "customers", "label": "Customer CRM", "section": "Commercial"},
    {"id": "deals", "label": "Sales Pipeline", "section": "Commercial"},
    {"id": "financials", "label": "Financial KPI", "section": "Commercial"},
    {"id": "funding", "label": "Funding Tracker", "section": "Commercial"},
    {"id": "directory", "label": "Incubators Directory", "section": "Outreach & Nurturing"},
    {"id": "startups_directory", "label": "Startups Directory", "section": "Outreach & Nurturing"},
    {"id": "outreach", "label": "Outreach Hub", "section": "Outreach & Nurturing"},
    {"id": "nurture_loop", "label": "90-Day Incubation Loop", "section": "Outreach & Nurturing"},
    {"id": "cohort_evaluator", "label": "Cohort Evaluator", "section": "Intelligence & Evaluation"},
    {"id": "enrichment_hub", "label": "Scraper & Enrichment", "section": "Intelligence & Evaluation"},
    {"id": "inquirers", "label": "Inquirers Dashboard", "section": "Dashboard Views"},
    {"id": "startups_dashboard", "label": "Startups Dashboard", "section": "Dashboard Views"},
    {"id": "timeline", "label": "Timeline Dashboard", "section": "Dashboard Views"},
    {"id": "platform_settings", "label": "Platform Settings", "section": "Configuration"},
]

ALL_FEATURE_IDS = [f["id"] for f in FEATURES]


def _collection(db=None):
    return (db or get_mongo_db())["roles"]


def _users_collection(db=None):
    return (db or get_mongo_db())["users"]


def _next_id(db, collection):
    counter = db["crm_counters"].find_one_and_update(
        {"_id": collection},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=pymongo.ReturnDocument.AFTER,
    )
    return counter["seq"]


def _now():
    return datetime.now().isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, expected = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iterations))
        return hmac.compare_digest(digest.hex(), expected)
    except Exception:
        return False


def get_feature_catalogue():
    return FEATURES


def _ensure_default_role(db):
    if db["roles"].count_documents({}) == 0:
        db["roles"].insert_one({
            "id": 1,
            "name": "Admin",
            "description": "Full platform access.",
            "permissions": ALL_FEATURE_IDS,
            "is_system": True,
            "created_at": _now(),
            "updated_at": _now(),
        })
    max_id = max([r.get("id", 0) for r in db["roles"].find({})] or [0])
    db["crm_counters"].update_one(
        {"_id": "roles"},
        {"$max": {"seq": max_id}},
        upsert=True,
    )


# --------------------------------------------------------------------------
# Roles
# --------------------------------------------------------------------------

def list_roles():
    db = get_mongo_db()
    _ensure_default_role(db)
    rows = []
    for doc in db["roles"].find({}).sort("id", 1):
        doc = dict(doc)
        doc["_id"] = str(doc.get("_id", ""))
        rows.append(doc)
    return rows


def create_role(data):
    db = get_mongo_db()
    _ensure_default_role(db)
    payload = {k: ("" if v is None else v) for k, v in (data or {}).items() if k and not k.startswith("_")}
    name = (payload.get("name") or "").strip()
    if not name:
        raise BadRequestError("Role name is required.")
    if db["roles"].find_one({"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}):
        raise BadRequestError("A role with this name already exists.")
    perms = payload.get("permissions") or []
    if isinstance(perms, str):
        perms = [p for p in perms.split(",") if p]
    perms = [p for p in perms if p in ALL_FEATURE_IDS]
    payload["permissions"] = perms
    payload.setdefault("description", "")
    payload["id"] = _next_id(db, "roles")
    payload["is_system"] = False
    payload["created_at"] = _now()
    payload["updated_at"] = _now()
    db["roles"].insert_one(payload)
    return {"status": "success", "message": f"Role '{name}' created.", "id": payload["id"]}


def update_role(role_id, data):
    db = get_mongo_db()
    try:
        role_id = int(role_id)
    except (TypeError, ValueError):
        pass
    existing = db["roles"].find_one({"id": role_id})
    if not existing:
        raise NotFoundError("Role not found.")
    payload = {k: ("" if v is None else v) for k, v in (data or {}).items() if k and not k.startswith("_")}
    if "name" in payload:
        payload["name"] = (payload["name"] or "").strip()
        dup = db["roles"].find_one({"name": {"$regex": f"^{re.escape(payload['name'])}$", "$options": "i"}, "id": {"$ne": role_id}})
        if dup:
            raise BadRequestError("A role with this name already exists.")
    if "permissions" in payload:
        perms = payload["permissions"]
        if isinstance(perms, str):
            perms = [p for p in perms.split(",") if p]
        payload["permissions"] = [p for p in perms if p in ALL_FEATURE_IDS]
    payload["updated_at"] = _now()
    db["roles"].update_one({"_id": existing["_id"]}, {"$set": payload})
    return {"status": "success", "message": "Role updated."}


def delete_role(role_id):
    db = get_mongo_db()
    try:
        role_id = int(role_id)
    except (TypeError, ValueError):
        pass
    existing = db["roles"].find_one({"id": role_id})
    if not existing:
        raise NotFoundError("Role not found.")
    if existing.get("is_system"):
        raise BadRequestError("System roles cannot be deleted.")
    if db["users"].count_documents({"role_id": role_id}) > 0:
        raise BadRequestError("Role is assigned to users. Reassign or delete those users first.")
    db["roles"].delete_one({"_id": existing["_id"]})
    return {"status": "success", "message": "Role deleted."}


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------

def _public_user(doc):
    doc = dict(doc)
    doc["_id"] = str(doc.get("_id", ""))
    doc.pop("password_hash", None)
    return doc


def list_users():
    db = get_mongo_db()
    _ensure_default_role(db)
    roles = {r["id"]: r.get("name", "") for r in db["roles"].find({})}
    rows = []
    for doc in db["users"].find({}).sort("id", 1):
        row = _public_user(doc)
        row["role_name"] = roles.get(row.get("role_id"), "")
        rows.append(row)
    return rows


def _prepare_user_payload(db, data, existing=None):
    payload = {k: ("" if v is None else v) for k, v in (data or {}).items() if k and not k.startswith("_")}
    if existing is not None:
        for key in ("username", "name", "role_id", "active"):
            payload.setdefault(key, existing.get(key))
    username = (payload.get("username") or "").strip()
    if not username:
        raise BadRequestError("Username is required.")
    dup = db["users"].find_one({"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}})
    if dup and (existing is None or dup.get("id") != existing.get("id")):
        raise BadRequestError("Username already exists.")
    payload["username"] = username
    payload["name"] = (payload.get("name") or "").strip() or username
    role_id = payload.get("role_id")
    if role_id not in (None, ""):
        try:
            role_id = int(role_id)
        except (TypeError, ValueError):
            role_id = None
        payload["role_id"] = role_id
    else:
        payload["role_id"] = None
    payload["active"] = bool(payload.get("active", True))
    return payload


def create_user(data):
    db = get_mongo_db()
    _ensure_default_role(db)
    payload = _prepare_user_payload(db, data)
    password = (data or {}).get("password") or ""
    if not password:
        raise BadRequestError("Password is required.")
    payload["password_hash"] = hash_password(password)
    payload.pop("password", None)
    payload["id"] = _next_id(db, "users")
    payload["created_at"] = _now()
    payload["updated_at"] = _now()
    db["users"].insert_one(payload)
    return {"status": "success", "message": f"User '{payload['username']}' created.", "id": payload["id"]}


def update_user(user_id, data):
    db = get_mongo_db()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        pass
    existing = db["users"].find_one({"id": user_id})
    if not existing:
        raise NotFoundError("User not found.")
    payload = _prepare_user_payload(db, data, existing)
    password = (data or {}).get("password")
    if password:
        payload["password_hash"] = hash_password(str(password))
    payload.pop("password", None)
    payload["updated_at"] = _now()
    db["users"].update_one({"_id": existing["_id"]}, {"$set": payload})
    return {"status": "success", "message": "User updated."}


def delete_user(user_id):
    db = get_mongo_db()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        pass
    existing = db["users"].find_one({"id": user_id})
    if not existing:
        raise NotFoundError("User not found.")
    db["users"].delete_one({"_id": existing["_id"]})
    return {"status": "success", "message": "User deleted."}