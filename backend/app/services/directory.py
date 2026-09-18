import json
import math
import io
import csv
import uuid
from collections import Counter
from datetime import datetime
from typing import Optional

from ..core.database import get_db_connection, get_mongo_db
from ..core.exceptions import ServiceError
from .graph import generate_web_graph
from .evaluator import extract_dynamic_rows_and_headers, classify_startup_stage


def _clean(value) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        return str(value)
    return value.strip()


def get_region(state: str) -> str:
    if not state:
        return "Unknown"
    state_clean = state.strip().lower()
    mapping = {
        'delhi': 'North', 'haryana': 'North', 'himachal pradesh': 'North',
        'jammu and kashmir': 'North', 'jammu & kashmir': 'North',
        'punjab': 'North', 'rajasthan': 'North', 'uttarakhand': 'North', 'ladakh': 'North',
        'andhra pradesh': 'South', 'karnataka': 'South', 'kerala': 'South',
        'tamil nadu': 'South', 'telangana': 'South', 'lakshadweep': 'South',
        'puducherry': 'South', 'andaman and nicobar islands': 'South',
        'gujarat': 'West', 'maharashtra': 'West', 'goa': 'West',
        'daman & diu': 'West', 'dadra & nagar haveli': 'West',
        'bihar': 'East', 'odisha': 'East', 'west bengal': 'East', 'jharkhand': 'East',
        'chhattisgarh': 'Central', 'madhya pradesh': 'Central', 'uttar pradesh': 'Central',
        'assam': 'Northeast', 'tripura': 'Northeast', 'sikkim': 'Northeast',
        'meghalaya': 'Northeast', 'manipur': 'Northeast', 'mizoram': 'Northeast',
        'nagaland': 'Northeast', 'arunachal pradesh': 'Northeast'
    }
    return mapping.get(state_clean, "Unknown")


def get_incubators(
    q: Optional[str] = None,
    org_type: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    sector: Optional[str] = None,
    region: Optional[str] = None,
    page: Optional[int] = None,
    limit: Optional[int] = None
):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM incubators WHERE 1=1"
    params = []

    if q:
        query += " AND (name LIKE ? OR description LIKE ? OR founder_or_head LIKE ?)"
        q_wild = f"%{q}%"
        params.extend([q_wild, q_wild, q_wild])
    if org_type:
        query += " AND organization_type = ?"
        params.append(org_type)
    if state:
        query += " AND state = ?"
        params.append(state)
    if city:
        query += " AND city = ?"
        params.append(city)
    if sector:
        query += " AND focus_areas LIKE ?"
        params.append(f"%{sector}%")

    query += " ORDER BY startup_count DESC"

    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]

    # Decode JSON fields and add region mapping
    for row in rows:
        row["region"] = get_region(row.get("state"))
        for json_field in ["incubation_programs", "acceleration_programs", "lab_facilities", "focus_areas"]:
            val = row.get(json_field)
            if val:
                try:
                    row[json_field] = json.loads(val) if isinstance(val, str) else val
                except:
                    row[json_field] = []
            else:
                row[json_field] = []

    if region:
        rows = [r for r in rows if r["region"].lower() == region.lower()]

    conn.close()

    if page is not None and limit is not None and limit > 0:
        total = len(rows)
        start = (page - 1) * limit
        end = start + limit
        paginated_rows = rows[start:end]
        return {
            "items": paginated_rows,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": math.ceil(total / limit) if total > 0 else 1
        }

    return rows


def get_startups(
    q: Optional[str] = None,
    sector: Optional[str] = None,
    funding_stage: Optional[str] = None,
    hq_city: Optional[str] = None,
    incubator_id: Optional[str] = None,
    stage_category: Optional[str] = None,
    page: Optional[int] = None,
    limit: Optional[int] = None
):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM startups WHERE 1=1"
    params = []

    if q:
        query += " AND (startup_name LIKE ? OR sector LIKE ?)"
        q_wild = f"%{q}%"
        params.extend([q_wild, q_wild])
    if sector:
        query += " AND sector = ?"
        params.append(sector)
    if funding_stage:
        query += " AND funding_stage = ?"
        params.append(funding_stage)
    if hq_city:
        query += " AND hq_city = ?"
        params.append(hq_city)
    if incubator_id:
        query += " AND incubator_id = ?"
        params.append(incubator_id)

    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]

    # Decode JSON fields
    for row in rows:
        if row["founders"]:
            try:
                row["founders"] = json.loads(row["founders"]) if isinstance(row["founders"], str) else row["founders"]
            except:
                row["founders"] = []

    conn.close()

    # Filter by stage_category in-memory (since SQLite column may not exist for old data)
    if stage_category:
        rows = [r for r in rows if (r.get("stage_category") or "") == stage_category]

    if page is not None and limit is not None and limit > 0:
        total = len(rows)
        start = (page - 1) * limit
        end = start + limit
        paginated_rows = rows[start:end]
        return {
            "items": paginated_rows,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": math.ceil(total / limit) if total > 0 else 1
        }

    return rows


def _safe_str(val):
    if val is None:
        return ""
    if isinstance(val, float) and val.is_integer():
        return str(int(val))
    return str(val).strip()


def _pick(headers, mappings):
    for key, patterns in mappings.items():
        for i, h in enumerate(headers):
            h_str = _safe_str(h).lower()
            for pat in patterns:
                if pat in h_str:
                    return key, i
    return None, None


_STARTUP_COL_MAP = {
    "startup_name": ["startup name", "name of startup", "company name", "company", "startup", "organization", "org name", "entity name", "name", "title"],
    "sector": ["sector", "domain", "industry", "focus area", "vertical"],
    "founders": ["founder", "contact person", "representative", "applicant name", "founder name"],
    "website": ["website", "url", "web address"],
    "funding_stage": ["funding stage", "stage", "maturity", "type"],
    "hq_city": ["hq city", "city", "headquarters", "city & state", "location", "address"],
    "email": ["email", "e-mail", "mail id", "mail"],
    "description": ["description", "business summary", "about", "overview", "summary", "details"],
    "contact_email": ["contact email", "contact mail", "primary email"],
    "incubator_id": ["incubator id", "incubator"],
}

_INCUBATOR_COL_MAP = {
    "name": ["incubator name", "name of incubator", "hub name", "center name", "tbi name", "org name", "organization name", "name", "title"],
    "city": ["city", "hq city", "headquarters", "location"],
    "state": ["state", "region"],
    "email": ["email", "e-mail", "mail id", "mail", "contact email"],
    "website": ["website", "url", "web address"],
    "focus_areas": ["focus area", "sector", "domain", "industry", "vertical"],
    "description": ["description", "about", "overview", "summary", "details"],
    "founder_or_head": ["founder", "head", "director", "ceo", "contact person", "representative"],
    "organization_type": ["organization type", "org type", "type", "category"],
    "startup_count": ["startup count", "number of startups", "startups", "portfolio", "incubated"],
    "source_url": ["source", "source url", "data source", "reference"],
}

_STARTUP_COL_ORDER = [
    "startup_name", "sector", "founders", "website", "funding_stage",
    "hq_city", "email", "contact_email", "description", "incubator_id",
]

_INCUBATOR_COL_ORDER = [
    "name", "city", "state", "email", "website", "focus_areas",
    "description", "founder_or_head", "organization_type", "startup_count",
]


def _read_directory_rows(contents: bytes):
    """Return headers, rows, and a source label for CSV or XLSX content."""
    if contents.startswith(b"PK"):
        import openpyxl

        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        sheet = wb.active
        if sheet is None:
            raise ServiceError("Spreadsheet contains no sheets.")
        values = list(sheet.iter_rows(values_only=True))
        source_label = "Excel Upload"
    else:
        try:
            text = contents.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = contents.decode("cp1252")

        if not text.strip():
            raise ServiceError("CSV file is empty.")
        try:
            dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        values = list(csv.reader(io.StringIO(text), dialect))
        source_label = "CSV Upload"

    if not values:
        raise ServiceError("Spreadsheet contains no rows.")

    headers = [_safe_str(value) for value in values[0]]
    rows = [list(row) for row in values[1:] if any(_safe_str(value) for value in row)]
    return headers, rows, source_label


def import_directory_excel(contents: bytes, entity_type: str = "startup"):
    """Append CSV/XLSX rows to the startup or incubator directory.

    Rows without a name and records whose name already exists are skipped.
    """
    try:
        raw_headers, data_rows, source_label = _read_directory_rows(contents)

        is_startup = entity_type == "startup"
        col_map = _STARTUP_COL_MAP if is_startup else _INCUBATOR_COL_MAP
        col_order = _STARTUP_COL_ORDER if is_startup else _INCUBATOR_COL_ORDER

        header_idx = {}
        for field in col_order:
            for i, h in enumerate(raw_headers):
                h_lower = h.lower()
                if any(pat in h_lower for pat in col_map[field]):
                    header_idx[field] = i
                    break

        if not header_idx:
            return {"status": "error", "message": "Could not detect recognizable columns in the uploaded file."}

        collection = get_mongo_db()
        coll = collection["startups"] if is_startup else collection["incubators"]

        inserted_count = 0
        skipped_count = 0
        created_at = datetime.now().isoformat()

        for row_values in data_rows:
            def col_val(field):
                i = header_idx.get(field)
                if i is None or i >= len(row_values):
                    return ""
                return _safe_str(row_values[i])

            if is_startup:
                name = col_val("startup_name")
                if not name:
                    skipped_count += 1
                    continue
                dup = coll.find_one({"startup_name": name})
                if dup:
                    skipped_count += 1
                    continue

                max_id = 1
                try:
                    ids = []
                    for doc in coll.find({}, {"id": 1}):
                        v = doc.get("id")
                        if v:
                            if isinstance(v, int):
                                ids.append(v)
                            elif isinstance(v, str) and v.isdigit():
                                ids.append(int(v))
                    if ids:
                        max_id = max(ids) + 1
                except Exception:
                    pass

                record = {
                    "id": str(max_id),
                    "startup_name": name,
                    "sector": col_val("sector") or "General",
                    "founders": col_val("founders"),
                    "website": col_val("website"),
                    "funding_stage": col_val("funding_stage") or "Active",
                    "hq_city": col_val("hq_city"),
                    "email": col_val("email") or col_val("contact_email"),
                    "description": col_val("description"),
                    "incubator_id": col_val("incubator_id") or "excel_upload",
                    "confidence_score": None,
                    "status": "Imported",
                    "source_url": source_label,
                    "last_updated": created_at,
                }
                record["stage_category"] = classify_startup_stage({
                    "stage": record["funding_stage"],
                    "revenue": 0,
                    "team_size": 1,
                    "website": record["website"],
                    "dpiit": False,
                    "pitch_deck_url": "",
                    "business_summary": record["description"],
                })
            else:
                name = col_val("name")
                if not name:
                    skipped_count += 1
                    continue
                dup = coll.find_one({"name": name})
                if dup:
                    skipped_count += 1
                    continue

                startup_count = col_val("startup_count")
                try:
                    startup_count = int(float(startup_count))
                except Exception:
                    startup_count = 0

                record = {
                    "id": f"inc_{uuid.uuid4().hex[:8]}",
                    "name": name,
                    "city": col_val("city"),
                    "state": col_val("state"),
                    "email": col_val("email"),
                    "website": col_val("website"),
                    "focus_areas": col_val("focus_areas"),
                    "description": col_val("description"),
                    "founder_or_head": col_val("founder_or_head"),
                    "organization_type": col_val("organization_type"),
                    "startup_count": startup_count,
                    "confidence_score": None,
                    "status": "resolved",
                    "source_url": col_val("source_url") or source_label,
                    "last_updated": created_at,
                }

            coll.insert_one(record)
            inserted_count += 1

        if inserted_count == 0:
            return {"status": "error", "message": "No new records imported (all rows missing a name or already in the directory).", "skipped_count": skipped_count}

        return {
            "status": "success",
            "message": f"Successfully imported {inserted_count} {entity_type}(s) into the directory ({skipped_count} skipped).",
            "inserted_count": inserted_count,
            "skipped_count": skipped_count,
        }
    except ServiceError:
        raise
    except Exception as e:
        raise ServiceError(f"Failed to import file to directory: {str(e)}")


def get_graph():
    return generate_web_graph()


def get_analytics():
    db = get_mongo_db()

    incubators = list(db["incubators"].find({}))
    startups = list(db["startups"].find({}, {
        "sector": 1, "funding_stage": 1, "stage_category": 1,
        "hq_city": 1, "incubator_id": 1, "confidence_score": 1,
    }))
    leads = list(db["outreach_leads"].find({}, {
        "id": 1, "incubator_name": 1, "incubator_id": 1,
        "email": 1, "contact_count": 1, "status": 1,
    }))

    def _c(items, key):
        c = Counter()
        for it in items:
            v = it.get(key)
            if not isinstance(v, str):
                v = "" if v is None else str(v)
            v = v.strip()
            if v:
                c[v] += 1
        return c

    # --- Incubator Totals & Distributions ---
    total_incubators = len(incubators)
    states_covered = len({_clean(i.get("state")) for i in incubators} - {""})
    cities_covered = len({_clean(i.get("city")) for i in incubators} - {""})

    org_type_counter = _c(incubators, "organization_type")
    org_type_distribution = [{"organization_type": k, "count": v} for k, v in org_type_counter.most_common()]

    state_counter = _c(incubators, "state")
    state_distribution = [{"state": k, "count": v} for k, v in state_counter.most_common()]

    city_counter = _c(incubators, "city")
    top_hubs = [{"city": k, "count": v} for k, v in city_counter.most_common(8)]

    # Top Ranked Incubators Leaderboard
    top_incubators_raw = sorted(
        [i for i in incubators if i.get("name")],
        key=lambda x: x.get("startup_count") or 0, reverse=True
    )[:8]
    top_incubators = []
    for inc in top_incubators_raw:
        fa = inc.get("focus_areas")
        if isinstance(fa, str):
            try:
                fa = json.loads(fa)
            except:
                fa = []
        top_incubators.append({
            "name": inc.get("name"),
            "city": inc.get("city"),
            "state": inc.get("state"),
            "startups_count": inc.get("startup_count", 0),
            "focus_areas": fa if isinstance(fa, list) else []
        })

    # Sector distribution from focus areas of incubators
    sector_counts = Counter()
    for i in incubators:
        fa = i.get("focus_areas")
        if isinstance(fa, str):
            try:
                fa = json.loads(fa)
            except:
                fa = []
        if isinstance(fa, list):
            for area in fa:
                if area and isinstance(area, str) and area.strip():
                    sector_counts[area.strip()] += 1

    sector_distribution = [
        {"sector": k, "count": v}
        for k, v in sector_counts.most_common()
    ]
    sectors_supported = len(sector_distribution)

    # Region-wise distribution calculation
    region_counts = Counter()
    for i in incubators:
        region_counts[get_region(i.get("state"))] += 1

    region_distribution = [
        {"region": k, "count": v}
        for k, v in region_counts.most_common()
    ]

    # --- Startup Totals & Detailed Analysis ---
    total_startups = len(startups)

    startup_sector_distribution = [{"sector": k, "count": v} for k, v in _c(startups, "sector").most_common()]
    startup_stage_distribution = [{"funding_stage": k, "count": v} for k, v in _c(startups, "funding_stage").most_common()]
    startup_category_distribution = [{"stage_category": k, "count": v} for k, v in _c(startups, "stage_category").most_common()]
    startup_city_distribution = [{"hq_city": k, "count": v} for k, v in _c(startups, "hq_city").most_common(8)]

    # Incubated vs Standalone Startups
    incubated_startups_count = sum(1 for s in startups if _clean(s.get("incubator_id")))

    # Average Confidence Score for Evaluated Startups
    scores = []
    for s in startups:
        try:
            if s.get("confidence_score") is not None:
                scores.append(float(s["confidence_score"]))
        except:
            pass
    avg_confidence = round(sum(scores) / len(scores), 1) if scores else 0.0

    # Unique filters for dropdowns
    unique_states = sorted(state_counter.keys())
    unique_cities = sorted(city_counter.keys())
    unique_focus_areas = sorted(sector_counts.keys())

    # Collaboration Lifecycle & Progress Pipeline
    statuses = [(_clean(l.get("status"))) for l in leads]

    total_outreach_sent = sum(1 for l in leads
        if l.get("status") in ("Sent", "Follow-up Sent") or (l.get("contact_count") or 0) > 0)

    total_contacts_dispatched = sum(l.get("contact_count") or 0 for l in leads)

    replied_count = sum(1 for s in statuses if s in ("Replied", "In Loop", "Interviewed"))

    sm_count = db["scheduled_meetings"].count_documents({"status": {"$ne": "Cancelled"}}) or 0
    ol_count = statuses.count("Meeting Scheduled")
    meeting_scheduled_count = max(sm_count, ol_count)

    mou_signed_count = statuses.count("MOUs")
    active_incubation_count = statuses.count("Incubated")
    tbi_partnerships_count = statuses.count("TBI Partnership")

    collaboration_leads_raw = []
    for l in leads:
        cnt = l.get("contact_count")
        try:
            cnt = int(cnt) if cnt is not None else 0
        except:
            cnt = 0
        collaboration_leads_raw.append({
            "id": l.get("id"),
            "incubator_name": l.get("incubator_name"),
            "incubator_id": l.get("incubator_id"),
            "email": l.get("email"),
            "contact_count": cnt,
            "status": _clean(l.get("status"))
        })
    status_order = {"Incubated": 1, "TBI Partnership": 2, "MOUs": 3, "Meeting Scheduled": 4, "Replied": 5, "Sent": 6, "Follow-up Sent": 7, "Draft": 8}
    collaboration_leads_raw.sort(key=lambda x: status_order.get(x.get("status"), 99))

    return {
        "totals": {
            "incubators": total_incubators,
            "startups": total_startups,
            "states": states_covered,
            "cities": cities_covered,
            "sectors": sectors_supported,
            "incubated_startups": incubated_startups_count,
            "avg_confidence_score": avg_confidence
        },
        "state_distribution": state_distribution,
        "region_distribution": region_distribution,
        "org_type_distribution": org_type_distribution,
        "top_hubs": top_hubs,
        "sector_distribution": sector_distribution,
        "top_incubators": top_incubators,
        "startup_analytics": {
            "total_startups": total_startups,
            "sector_distribution": startup_sector_distribution,
            "stage_distribution": startup_stage_distribution,
            "stage_category_distribution": startup_category_distribution,
            "city_distribution": startup_city_distribution,
            "incubated_count": incubated_startups_count,
            "avg_confidence": avg_confidence
        },
        "collaboration_progress": {
            "pipeline_stages": [
                {"stage": "Ranked & Evaluated", "count": total_incubators + total_startups, "key": "ranked"},
                {"stage": "Outreach Dispatched", "count": total_outreach_sent, "key": "outreach_sent"},
                {"stage": "Interactions & Replies", "count": replied_count, "key": "replied"},
                {"stage": "Meetings Booked", "count": meeting_scheduled_count, "key": "meeting_scheduled"},
                {"stage": "MOUs Signed", "count": mou_signed_count, "key": "mou_signed"},
                {"stage": "Active Incubation", "count": active_incubation_count + incubated_startups_count, "key": "active_incubation"},
                {"stage": "TBI Partnerships", "count": tbi_partnerships_count, "key": "tbi_partnership"}
            ],
            "total_contacts_dispatched": total_contacts_dispatched,
            "leads": collaboration_leads_raw
        },
        "filters": {
            "states": unique_states,
            "cities": unique_cities,
            "focus_areas": unique_focus_areas,
            "regions": ["North", "South", "East", "West", "Central", "Northeast"]
        }
    }
