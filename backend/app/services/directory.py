import json
import math
import io
import uuid
from datetime import datetime
from typing import Optional

from ..core.database import get_db_connection, get_mongo_db
from ..core.exceptions import ServiceError
from .graph import generate_web_graph
from .outreach import seed_outreach_leads
from .evaluator import extract_dynamic_rows_and_headers


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


def import_directory_excel(contents: bytes, entity_type: str = "startup"):
    """Import rows from an uploaded Excel file directly into the startups /
    incubators directory collection. Skips rows without a name and rows that
    duplicate an existing record (matched by name)."""
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        sheet = wb.active
        if sheet is None:
            raise ServiceError("Excel file contains no sheets.")

        raw_headers = []
        for cell in sheet[1]:
            raw_headers.append(_safe_str(cell.value))

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
            return {"status": "error", "message": "Could not detect recognizable columns in the uploaded Excel file."}

        collection = get_mongo_db()
        coll = collection["startups"] if is_startup else collection["incubators"]

        inserted_count = 0
        skipped_count = 0
        created_at = datetime.now().isoformat()

        for row_idx in range(2, sheet.max_row + 1):
            def col_val(field):
                i = header_idx.get(field)
                if i is None or i >= len(raw_headers):
                    return ""
                return _safe_str(sheet.cell(row=row_idx, column=i + 1).value)

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
                    "source_url": "Excel Upload",
                    "last_updated": created_at,
                }
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
                    "source_url": col_val("source_url") or "Excel Upload",
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
        raise ServiceError(f"Failed to import excel to directory: {str(e)}")


def get_graph():
    return generate_web_graph()


def get_analytics():
    conn = get_db_connection()
    cursor = conn.cursor()

    # --- Incubator Totals & Distributions ---
    cursor.execute("SELECT COUNT(*) FROM incubators")
    total_incubators = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT state) FROM incubators WHERE state IS NOT NULL AND state != ''")
    states_covered = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT city) FROM incubators WHERE city IS NOT NULL AND city != ''")
    cities_covered = cursor.fetchone()[0]

    # Organization type distribution (Academic, Private, Government, PPP)
    cursor.execute("SELECT organization_type, COUNT(*) as count FROM incubators WHERE organization_type IS NOT NULL AND organization_type != '' GROUP BY organization_type ORDER BY count DESC")
    org_type_distribution = [dict(row) for row in cursor.fetchall()]

    # State-wise distribution
    cursor.execute("SELECT state, COUNT(*) as count FROM incubators WHERE state IS NOT NULL AND state != '' GROUP BY state ORDER BY count DESC")
    state_distribution = [dict(row) for row in cursor.fetchall()]

    # City-wise distribution (Top hubs)
    cursor.execute("SELECT city, COUNT(*) as count FROM incubators WHERE city IS NOT NULL AND city != '' GROUP BY city ORDER BY count DESC LIMIT 8")
    top_hubs = [dict(row) for row in cursor.fetchall()]

    # Top Ranked Incubators Leaderboard
    cursor.execute("SELECT name, city, state, startup_count, focus_areas FROM incubators WHERE name IS NOT NULL ORDER BY startup_count DESC LIMIT 8")
    top_incubators_raw = [dict(row) for row in cursor.fetchall()]
    top_incubators = []
    for inc in top_incubators_raw:
        fa = inc.get("focus_areas")
        if fa and isinstance(fa, str):
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
    sector_counts = {}
    cursor.execute("SELECT focus_areas FROM incubators")
    for row in cursor.fetchall():
        if row[0]:
            try:
                areas = json.loads(row[0]) if isinstance(row[0], str) else row[0]
                if isinstance(areas, list):
                    for area in areas:
                        if area:
                            sector_counts[area] = sector_counts.get(area, 0) + 1
            except:
                pass

    sector_distribution = [
        {"sector": k, "count": v}
        for k, v in sector_counts.items()
    ]
    sector_distribution.sort(key=lambda x: x["count"], reverse=True)
    sectors_supported = len(sector_distribution)

    # Region-wise distribution calculation
    cursor.execute("SELECT state FROM incubators")
    region_counts = {}
    for r in cursor.fetchall():
        st = r[0]
        reg = get_region(st)
        region_counts[reg] = region_counts.get(reg, 0) + 1

    region_distribution = [
        {"region": k, "count": v}
        for k, v in region_counts.items()
    ]
    region_distribution.sort(key=lambda x: x["count"], reverse=True)

    # --- Startup Totals & Detailed Analysis ---
    cursor.execute("SELECT COUNT(*) FROM startups")
    total_startups = cursor.fetchone()[0]

    # Startup Sector Distribution
    cursor.execute("SELECT sector, COUNT(*) as count FROM startups WHERE sector IS NOT NULL AND sector != '' GROUP BY sector ORDER BY count DESC")
    startup_sector_distribution = [dict(row) for row in cursor.fetchall()]

    # Startup Funding Stage Distribution
    cursor.execute("SELECT funding_stage, COUNT(*) as count FROM startups WHERE funding_stage IS NOT NULL AND funding_stage != '' GROUP BY funding_stage ORDER BY count DESC")
    startup_stage_distribution = [dict(row) for row in cursor.fetchall()]

    # Startup HQ City Distribution
    cursor.execute("SELECT hq_city, COUNT(*) as count FROM startups WHERE hq_city IS NOT NULL AND hq_city != '' GROUP BY hq_city ORDER BY count DESC LIMIT 8")
    startup_city_distribution = [dict(row) for row in cursor.fetchall()]

    # Incubated vs Standalone Startups
    cursor.execute("SELECT COUNT(*) FROM startups WHERE incubator_id IS NOT NULL AND incubator_id != ''")
    incubated_startups_count = cursor.fetchone()[0]

    # Average Confidence Score for Evaluated Startups
    cursor.execute("SELECT confidence_score FROM startups WHERE confidence_score IS NOT NULL")
    scores = []
    for r in cursor.fetchall():
        try:
            val = float(r[0])
            scores.append(val)
        except:
            pass
    avg_confidence = round(sum(scores) / len(scores), 1) if scores else 0.0

    # Unique filters for dropdowns
    cursor.execute("SELECT DISTINCT state FROM incubators WHERE state IS NOT NULL AND state != '' ORDER BY state")
    unique_states = [r[0] for r in cursor.fetchall()]

    cursor.execute("SELECT DISTINCT city FROM incubators WHERE city IS NOT NULL AND city != '' ORDER BY city")
    unique_cities = [r[0] for r in cursor.fetchall()]

    cursor.execute("SELECT focus_areas FROM incubators")
    all_areas = set()
    for row in cursor.fetchall():
        if row[0]:
            try:
                areas = json.loads(row[0]) if isinstance(row[0], str) else row[0]
                if isinstance(areas, list):
                    all_areas.update(areas)
            except:
                pass
    unique_focus_areas = sorted(list(all_areas))

    # Collaboration Lifecycle & Progress Pipeline
    seed_outreach_leads()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM outreach_leads WHERE status = 'Sent' OR status = 'Follow-up Sent' OR contact_count > 0")
    total_outreach_sent = cursor.fetchone()[0]

    cursor.execute("SELECT SUM(coalesce(contact_count, 0)) FROM outreach_leads")
    total_contacts_dispatched = cursor.fetchone()[0] or 0

    cursor.execute("SELECT COUNT(*) FROM outreach_leads WHERE status IN ('Replied', 'In Loop', 'Interviewed')")
    replied_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM scheduled_meetings WHERE status != 'Cancelled'")
    sm_count = cursor.fetchone()[0] or 0
    cursor.execute("SELECT COUNT(*) FROM outreach_leads WHERE status = 'Meeting Scheduled'")
    ol_count = cursor.fetchone()[0] or 0
    meeting_scheduled_count = max(sm_count, ol_count)

    cursor.execute("SELECT COUNT(*) FROM outreach_leads WHERE status = 'MOUs'")
    mou_signed_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM outreach_leads WHERE status = 'Incubated'")
    active_incubation_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM outreach_leads WHERE status = 'TBI Partnership'")
    tbi_partnerships_count = cursor.fetchone()[0]

    cursor.execute("SELECT * FROM outreach_leads")
    collaboration_leads_raw = [dict(row) for row in cursor.fetchall()]
    status_order = {"Incubated": 1, "TBI Partnership": 2, "MOUs": 3, "Meeting Scheduled": 4, "Replied": 5, "Sent": 6, "Follow-up Sent": 7, "Draft": 8}
    collaboration_leads_raw.sort(key=lambda x: status_order.get(x.get("status"), 99))

    conn.close()

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
