import os
import sys
import json
import zipfile
import io
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse, HTMLResponse, FileResponse
from dotenv import load_dotenv

# Resolve base directory — works both in dev and when bundled as .exe (PyInstaller)
if getattr(sys, 'frozen', False):
    # Running as compiled exe — static files are bundled at _MEIPASS/app/static
    BASE_DIR = Path(sys._MEIPASS) / "app"
    APP_DATA_DIR = Path(sys.executable).parent
else:
    # Dev mode — main.py lives at backend/app/main.py
    BASE_DIR = Path(__file__).resolve().parent
    APP_DATA_DIR = BASE_DIR.parent

print(f"[InCubein] BASE_DIR={BASE_DIR}", flush=True)
print(f"[InCubein] APP_DATA_DIR={APP_DATA_DIR}", flush=True)

# Load .env from app data dir (next to .exe) or from backend folder in dev
env_path = APP_DATA_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from .database import (
    get_db_connection, get_pipeline_logs, log_pipeline_step, clear_all_tables, get_mongo_db
)
from .scraper import run_scraper_pipeline
from .cleaner import run_cleaner_pipeline
from .resolution import run_resolution_pipeline
from .enricher import run_enricher_pipeline
from .graph import (
    generate_web_graph,
    generate_csv_exports,
    generate_json_export,
    generate_mongodb_export,
    generate_neo4j_export
)

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

app = FastAPI(title="Indian Startup Ecosystem Intelligence Platform API")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

 


class PipelineRunResponse(BaseModel):
    status: str
    message: str
    details: Optional[dict] = None

@app.post("/api/pipeline/reset", response_model=PipelineRunResponse)
def reset_pipeline():
    try:
        clear_all_tables()
        log_pipeline_step("SYSTEM", "SUCCESS", "Ecosystem database tables reset successfully.")
        return PipelineRunResponse(status="success", message="Ecosystem database cleared.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pipeline/run", response_model=PipelineRunResponse)
def run_pipeline(stage: str = Query("all", description="Stage to run: scrape, clean, resolve, enrich, or all")):
    try:
        stage = stage.lower()
        if stage == "scrape":
            res = run_scraper_pipeline()
            return PipelineRunResponse(status="success", message="Scraper pipeline run complete.", details=res)
        elif stage == "clean":
            res = run_cleaner_pipeline()
            return PipelineRunResponse(status="success", message="Cleaner pipeline run complete.", details=res)
        elif stage == "resolve":
            res = run_resolution_pipeline()
            return PipelineRunResponse(status="success", message="Entity resolution pipeline run complete.", details=res)
        elif stage == "enrich":
            res = run_enricher_pipeline()
            return PipelineRunResponse(status="success", message="AI enrichment pipeline run complete.", details=res)
        elif stage == "all":
            # Run all sequentially
            scrape_res = run_scraper_pipeline()
            clean_res = run_cleaner_pipeline()
            resolve_res = run_resolution_pipeline()
            enrich_res = run_enricher_pipeline()
            return PipelineRunResponse(
                status="success",
                message="Complete pipeline (Scrape -> Clean -> Resolve -> Enrich) executed successfully.",
                details={
                    "scrape": scrape_res,
                    "clean": clean_res,
                    "resolve": resolve_res,
                    "enrich": enrich_res
                }
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid pipeline stage. Select from: scrape, clean, resolve, enrich, all")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pipeline/logs")
def get_logs():
    return get_pipeline_logs()

@app.get("/api/incubators")
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
        import math
        return {
            "items": paginated_rows,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": math.ceil(total / limit) if total > 0 else 1
        }

    return rows

@app.get("/api/startups")
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
        import math
        return {
            "items": paginated_rows,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": math.ceil(total / limit) if total > 0 else 1
        }

    return rows

@app.get("/api/graph")
def get_graph():
    return generate_web_graph()

@app.get("/api/analytics")
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

@app.get("/api/export/{format_type}")
def export_data(format_type: str):
    format_type = format_type.lower()
    
    if format_type == "json":
        data = generate_json_export()
        json_str = json.dumps(data, indent=2)
        return Response(
            content=json_str,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=ecosystem_graph.json"}
        )
        
    elif format_type == "mongodb":
        script_str = generate_mongodb_export()
        return Response(
            content=script_str,
            media_type="text/javascript",
            headers={"Content-Disposition": "attachment; filename=import_mongodb.js"}
        )
        
    elif format_type == "neo4j":
        cypher_str = generate_neo4j_export()
        return Response(
            content=cypher_str,
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=import_graph.cypher"}
        )
        
    elif format_type == "csv":
        csv_files = generate_csv_exports()
        
        # Create an in-memory zip file
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for filename, csv_content in csv_files.items():
                zip_file.writestr(filename, csv_content)
                
        # Seek back to start of buffer
        zip_buffer.seek(0)
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=ecosystem_csvs.zip"}
        )
        
    else:
        raise HTTPException(status_code=400, detail="Invalid export format. Select from: json, csv, mongodb, neo4j")

class MouSendRequest(BaseModel):
    incubator_name: str
    incubator_email: str
    party_b_name: str
    party_b_email: str
    mou_title: str
    mou_text: str
    signature_data: str # Base64 PNG image
    recipient_email: str

@app.post("/api/mou/send")
def send_mou_email(req: MouSendRequest):
    import base64
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.image import MIMEImage
    from datetime import datetime

    # 1. Parse signature data URL
    sig_base64 = req.signature_data
    if "," in sig_base64:
        sig_base64 = sig_base64.split(",")[1]
    
    try:
        sig_bytes = base64.b64decode(sig_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Base64 signature image data: {str(e)}")

    # 2. Check SMTP configuration
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT", "587")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    sender_email = os.environ.get("SENDER_EMAIL") or smtp_user

    # Try fetching Nagpur university incubator email from the database if not in env
    if not sender_email or "your_email" in sender_email:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT email FROM incubators WHERE name LIKE '%Nagpur%' OR name LIKE '%IMN%' LIMIT 1")
            row = cursor.fetchone()
            if row and row["email"]:
                sender_email = row["email"]
            conn.close()
        except Exception:
            pass
            
    if not sender_email:
        sender_email = "no-reply@incubein.com"

    # Generate HTML content
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dddddd; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin: 0; text-transform: uppercase;">Startup Ecosystem Portal</h2>
          <span style="font-size: 0.85rem; color: #666666;">Government Innovation Intelligence Platform</span>
        </div>
        
        <p>Dear Stakeholder,</p>
        <p>A new Memorandum of Understanding (MoU) has been digitally signed and executed on the Ecosystem Platform. Below is the full text of the agreement for your records.</p>
        
        <div style="background-color: #f9f9f9; padding: 25px; border-left: 4px solid #1e3a8a; margin: 20px 0; font-family: Georgia, serif; white-space: pre-wrap; font-size: 0.95rem;">
          <h3 style="text-align: center; color: #1e293b; margin-top: 0; text-transform: uppercase;">{req.mou_title}</h3>
          {req.mou_text}
        </div>
        
        <div style="margin-top: 30px; border-top: 1px dashed #cccccc; padding-top: 20px; display: table; width: 100%;">
          <div style="display: table-cell; width: 50%; text-align: center; padding: 10px;">
            <div style="font-size: 0.75rem; color: #b45309; border: 1px dashed #b45309; padding: 2px; margin-bottom: 5px; display: inline-block;">PARTY A STAMPED</div>
            <div style="width: 80%; height: 1px; background-color: #bbbbbb; margin: 40px auto 5px auto;"></div>
            <strong style="font-size: 0.85rem;">{req.incubator_name} Representative</strong><br/>
            <span style="font-size: 0.75rem; color: #888888;">Authorized Signatory</span>
          </div>
          <div style="display: table-cell; width: 50%; text-align: center; padding: 10px; vertical-align: bottom;">
            <div style="margin-bottom: 5px;">
              <img src="cid:signature_image" alt="Digital Signature" style="max-height: 50px; max-width: 150px; object-fit: contain;" />
            </div>
            <div style="width: 80%; height: 1px; background-color: #bbbbbb; margin: 5px auto 5px auto;"></div>
            <strong style="font-size: 0.85rem;">{req.party_b_name} Representative</strong><br/>
            <span style="font-size: 0.75rem; color: #888888;">Authorized Signatory</span>
          </div>
        </div>
        
        <div style="margin-top: 40px; font-size: 0.75rem; color: #999999; text-align: center; border-top: 1px solid #eeeeee; padding-top: 15px;">
          This is an automated ecosystem agreement transmission from the India Startup Ecosystem Intelligence Platform.<br/>
          Location: Ministry of Science & Technology Initiatives, Govt of India.
        </div>
      </body>
    </html>
    """

    # Register the MOU recipient as a lead in outreach_leads
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM outreach_leads WHERE email = ?", (req.recipient_email,))
        row = cursor.fetchone()
        if row:
            lead_id = row["id"]
            cursor.execute(
                "UPDATE outreach_leads SET status = 'MOUs', sent_at = ?, reply_text = NULL, reply_detected_at = NULL, intent_classification = NULL, lead_score = 0, meeting_link = NULL, meeting_scheduled_at = NULL WHERE id = ?",
                (datetime.now().isoformat(), lead_id)
            )
        else:
            import uuid
            lead_id = f"lead_{uuid.uuid4().hex[:8]}"
            cursor.execute('''
                INSERT INTO outreach_leads (
                    id, incubator_id, incubator_name, email, status, sent_at, lead_score
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (lead_id, "inc_mou_" + uuid.uuid4().hex[:4], req.incubator_name, req.recipient_email, "MOUs", datetime.now().isoformat(), 0))
        conn.commit()
        conn.close()
    except Exception as db_err:
        print("Error registering sent MOU as outreach lead:", db_err)

    # Helper check to see if SMTP is fully configured (not using default placeholders)
    is_smtp_ready = (
        smtp_host and smtp_user and smtp_pass and 
        "your_email" not in smtp_user and 
        "your_app_password" not in smtp_pass
    )

    if is_smtp_ready:
        # SMTP configuration is present - Send real email

        try:
            msg = MIMEMultipart("related")
            msg["Subject"] = f"Digitally Executed MOU: {req.mou_title}"
            msg["From"] = sender_email
            msg["To"] = req.recipient_email
            
            # HTML text part
            msgAlternative = MIMEMultipart("alternative")
            msg.attach(msgAlternative)
            
            msgText = MIMEText(html_content, "html")
            msgAlternative.attach(msgText)
            
            # Inline Image part
            msgImage = MIMEImage(sig_bytes, name="signature.png")
            msgImage.add_header("Content-ID", "<signature_image>")
            msgImage.add_header("Content-Disposition", "inline", filename="signature.png")
            msg.attach(msgImage)
            
            # Connect and send
            port = int(smtp_port)
            if port == 465:
                server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, port, timeout=10)
                server.starttls()
                
            server.login(smtp_user, smtp_pass)
            server.sendmail(sender_email, [req.recipient_email], msg.as_string())
            server.quit()
            
            return {"status": "success", "message": f"MOU email successfully dispatched to {req.recipient_email}."}
        except Exception as smtp_err:
            raise HTTPException(status_code=500, detail=f"SMTP Server error: {str(smtp_err)}")
    else:
        # SMTP not configured - Fallback to mock log write
        try:
            scratch_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scratch")
            os.makedirs(scratch_dir, exist_ok=True)
            
            # Write email body to txt file
            log_path = os.path.join(scratch_dir, "mou_sent_log.txt")
            with open(log_path, "w", encoding="utf-8") as f:
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                f.write(f"Recipient: {req.recipient_email}\n")
                f.write(f"Subject: Digitally Executed MOU: {req.mou_title}\n")
                f.write(f"Party A: {req.incubator_name} ({req.incubator_email})\n")
                f.write(f"Party B: {req.party_b_name} ({req.party_b_email})\n")
                f.write(f"MOU Title: {req.mou_title}\n")
                f.write("-" * 80 + "\n")
                f.write(req.mou_text)
                f.write("\n" + "-" * 80 + "\n")
                f.write(f"Digital Signature Image Base64 Data URL Length: {len(req.signature_data)} chars\n")
            
            # Also save signature image to disk as debug validation
            sig_img_path = os.path.join(scratch_dir, "signature_debug.png")
            with open(sig_img_path, "wb") as img_f:
                img_f.write(sig_bytes)
                
            return {
                "status": "mock_success", 
                "message": "SMTP not configured in environment variables. Email simulation successfully written to file.",
                "details": {
                    "text_log": log_path,
                    "signature_png": sig_img_path
                }
            }
        except Exception as log_err:
            raise HTTPException(status_code=500, detail=f"Failed to write mock log: {str(log_err)}")

class ContactSendRequest(BaseModel):
    incubator_name: str
    recipient_email: str
    subject: str
    message: str
    meeting_date: Optional[str] = None
    meeting_time: Optional[str] = None

@app.post("/api/contact/send")
def send_contact_email(req: ContactSendRequest):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from datetime import datetime

    # 1. Check SMTP configuration
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT", "587")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    sender_email = os.environ.get("SENDER_EMAIL") or smtp_user

    # Try fetching Nagpur university incubator email from the database if not in env
    if not sender_email or "your_email" in sender_email:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT email FROM incubators WHERE name LIKE '%Nagpur%' OR name LIKE '%IMN%' LIMIT 1")
            row = cursor.fetchone()
            if row and row["email"]:
                sender_email = row["email"]
            conn.close()
        except Exception:
            pass
            
    if not sender_email:
        sender_email = "no-reply@incubein.com"

    # Generate HTML content
    datetime_section = ""
    if req.meeting_date or req.meeting_time:
        date_str = req.meeting_date or "N/A"
        time_str = req.meeting_time or "N/A"
        datetime_section = f"""
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0; color: #92400e;">
          <h4 style="margin: 0 0 8px 0; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px;">Proposed Meeting Details</h4>
          <strong>Date:</strong> {date_str}<br/>
          <strong>Time:</strong> {time_str}
        </div>
        """

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dddddd; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #0891b2; padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="color: #0891b2; margin: 0; text-transform: uppercase;">Startup Ecosystem Portal</h2>
          <span style="font-size: 0.85rem; color: #666666;">Government Innovation Intelligence Platform</span>
        </div>
        
        <p>Dear {req.incubator_name} Team,</p>
        <p>You have received a new contact inquiry and meeting request via the India Startup Ecosystem Portal.</p>
        
        {datetime_section}
        
        <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #0891b2; margin: 20px 0; white-space: pre-wrap; font-size: 0.95rem;">
          {req.message}
        </div>
        
        <p style="font-size: 0.85rem; color: #555555;">Please respond directly to the sender or follow up via your ecosystem dashboard.</p>
        
        <div style="margin-top: 40px; font-size: 0.75rem; color: #999999; text-align: center; border-top: 1px solid #eeeeee; padding-top: 15px;">
          This is an automated ecosystem message transmission from the India Startup Ecosystem Intelligence Platform.<br/>
          Location: Ministry of Science & Technology Initiatives, Govt of India.
        </div>
      </body>
    </html>
    """

    # Helper check to see if SMTP is fully configured (not using default placeholders)
    is_smtp_ready = (
        smtp_host and smtp_user and smtp_pass and 
        "your_email" not in smtp_user and 
        "your_app_password" not in smtp_pass
    )

    if is_smtp_ready:
        # SMTP configuration is present - Send real email

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = req.subject
            msg["From"] = sender_email
            msg["To"] = req.recipient_email
            
            msgText = MIMEText(html_content, "html")
            msg.attach(msgText)
            
            # Connect and send
            port = int(smtp_port)
            if port == 465:
                server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, port, timeout=10)
                server.starttls()
                
            server.login(smtp_user, smtp_pass)
            server.sendmail(sender_email, [req.recipient_email], msg.as_string())
            server.quit()
            
            return {"status": "success", "message": f"Contact email successfully sent to {req.incubator_name} at {req.recipient_email}."}
        except Exception as smtp_err:
            raise HTTPException(status_code=500, detail=f"SMTP Server error: {str(smtp_err)}")
    else:
        # SMTP not configured - Fallback to mock log write
        try:
            scratch_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scratch")
            os.makedirs(scratch_dir, exist_ok=True)
            
            log_path = os.path.join(scratch_dir, "contact_sent_log.txt")
            with open(log_path, "w", encoding="utf-8") as f:
                f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                f.write(f"Recipient: {req.recipient_email} ({req.incubator_name})\n")
                f.write(f"Subject: {req.subject}\n")
                if req.meeting_date or req.meeting_time:
                    f.write(f"Meeting: {req.meeting_date} at {req.meeting_time}\n")
                f.write("-" * 80 + "\n")
                f.write(req.message)
                f.write("\n" + "-" * 80 + "\n")
            
            return {
                "status": "mock_success", 
                "message": "SMTP not configured. Contact simulation successfully written to scratch file log.",
                "details": {
                    "text_log": log_path
                }
            }
        except Exception as log_err:
            raise HTTPException(status_code=500, detail=f"Failed to write mock contact log: {str(log_err)}")

class ContactUpdateRequest(BaseModel):
    id: str
    email: str
    website: str


@app.post("/api/incubators/update-contact")
def update_incubator_contact(req: ContactUpdateRequest):
    import re
    from datetime import datetime
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch current details to get the canonical name of the incubator
    cursor.execute("SELECT name FROM incubators WHERE id = ?", (req.id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Incubator not found")
        
    inc_name = row["name"]
    
    # 2. Update the SQLite database
    try:
        cursor.execute(
            "UPDATE incubators SET email = ?, website = ?, last_updated = ? WHERE id = ?",
            (req.email.strip(), req.website.strip(), datetime.now().isoformat(), req.id)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database update failed: {str(e)}")
        
    conn.close()
    
    # 3. Update the Excel file (incubators_with_contact_details(100).xlsx or db01.xlsx)
    excel_updated = False
    excel_error = None
    try:
        import openpyxl
        excel_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "incubators_with_contact_details(100).xlsx")
        if not os.path.exists(excel_path):
            excel_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db01.xlsx")
        if os.path.exists(excel_path):
            wb = openpyxl.load_workbook(excel_path)
            sheet = wb.active
            
            rows_updated = 0
            for r in range(2, sheet.max_row + 1):
                cell_val = sheet.cell(row=r, column=1).value
                if cell_val:
                    # Check exact match or similarity
                    if str(cell_val).strip().lower() == inc_name.strip().lower():
                        sheet.cell(row=r, column=4).value = req.website.strip() # Column D (Website)
                        sheet.cell(row=r, column=5).value = req.email.strip()   # Column E (Email)
                        rows_updated += 1
            
            # If no exact match, find the best match using similarity
            if rows_updated == 0:
                best_row = None
                best_sim = 0.0
                
                # Jaccard token overlap similarity helper
                def get_words(t):
                    return {w for w in re.sub(r'[^a-zA-Z0-9\s]', ' ', t.lower()).split() if w not in {"for", "and", "the", "of", "in", "at", "on", "with", "a", "an"}}
                
                name_words = get_words(inc_name)
                for r in range(2, sheet.max_row + 1):
                    cell_val = sheet.cell(row=r, column=1).value
                    if cell_val:
                        k_words = get_words(str(cell_val))
                        if name_words and k_words:
                            sim = len(name_words.intersection(k_words)) / len(name_words.union(k_words))
                            if str(cell_val).lower() in inc_name.lower() or inc_name.lower() in str(cell_val).lower():
                                sim = max(sim, 0.6)
                            if sim > best_sim:
                                best_sim = sim
                                best_row = r
                                
                if best_row and best_sim >= 0.4:
                    sheet.cell(row=best_row, column=4).value = req.website.strip()
                    sheet.cell(row=best_row, column=5).value = req.email.strip()
                    rows_updated = 1
                    
            if rows_updated > 0:
                wb.save(excel_path)
                excel_updated = True
            else:
                excel_error = f"Could not find matching incubator row in {os.path.basename(excel_path)}"
        else:
            excel_error = f"{os.path.basename(excel_path)} file not found"
    except Exception as e:
        excel_error = f"Failed to write to {os.path.basename(excel_path)}: {str(e)}"
        
    return {
        "status": "success",
        "message": "Incubator contact details updated in SQLite.",
        "excel_status": "updated" if excel_updated else "skipped",
        "excel_error": excel_error
    }

class FinderRequest(BaseModel):
    startup_name: str
    sector: str
    hq_city: str
    stage: str
    state: Optional[str] = None

@app.post("/api/incubators/find-matches")
def find_matching_incubators(req: FinderRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incubators")
    incubators = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    matches = []
    startup_sector = req.sector.strip().lower()
    startup_city = req.hq_city.strip().lower()
    startup_state = req.state.strip().lower() if req.state else ""
    startup_stage = req.stage.strip().lower()
    
    for inc in incubators:
        score = 0
        reasons = []
        
        # 1. Sector matching (40 points)
        focus_areas = []
        if inc["focus_areas"]:
            try:
                focus_areas = json.loads(inc["focus_areas"])
            except:
                focus_areas = []
                
        focus_areas_lower = [f.lower() for f in focus_areas]
        if startup_sector in focus_areas_lower:
            score += 40
            reasons.append(f"Direct Sector Match: Incubator specializes in {req.sector}")
        elif any(startup_sector in f or f in startup_sector for f in focus_areas_lower):
            score += 30
            reasons.append(f"Sub-Sector Match: Specializes in related areas ({', '.join(focus_areas[:3])})")
        elif not focus_areas:
            score += 15
            reasons.append("General Sector Support: Multi-sector incubator open to all verticals")
        else:
            score += 5
            
        # 2. Location matching (30 points)
        inc_city = (inc["city"] or "").strip().lower()
        inc_state = (inc["state"] or "").strip().lower()
        if startup_city and inc_city == startup_city:
            score += 30
            reasons.append(f"Local City Hub: Located in {inc['city']}, matching your startup HQ")
        elif startup_state and inc_state == startup_state:
            score += 20
            reasons.append(f"Regional State Hub: Located in {inc['city']}, {inc['state']}")
        else:
            score += 8
            reasons.append(f"National Incubator: Located in {inc['city'] or 'India'}")
            
        # 3. Funding & Scheme matching (20 points)
        grant_support = (inc["grant_support"] or "").strip().lower()
        funding_support = (inc["funding_support"] or "").strip().lower()
        
        has_grant = any(w in grant_support or w in funding_support for w in ["prayas", "birac", "big", "sisfs", "nidhi", "seed", "grant"])
        if startup_stage in ["pre-seed", "seed", "idea"]:
            if has_grant:
                score += 20
                reasons.append(f"Early-Stage Support: Offers seed grants/schemes like {inc['grant_support'] or 'NIDHI/BIRAC'}")
            else:
                score += 12
                reasons.append("Early-Stage Match: Mentorship & incubation space available")
        else:
            score += 10
            reasons.append("Growth Support: Coworking and networking infrastructure")
            
        # 4. Confidence/Capability matching (10 points)
        conf = inc["confidence_score"] or 0.90
        score += int(conf * 10)
        
        score = min(100, score)
        
        # Clean incubator JSON fields for output
        for field in ["incubation_programs", "acceleration_programs", "lab_facilities", "focus_areas"]:
            if inc[field] and isinstance(inc[field], str):
                try:
                    inc[field] = json.loads(inc[field])
                except:
                    inc[field] = []
                    
        matches.append({
            "incubator": inc,
            "match_score": score,
            "reasons": reasons
        })
        
    matches.sort(key=lambda x: x["match_score"], reverse=True)
    return matches[:5]

class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = None

@app.get("/api/ai/models")
def get_ai_models():
    import requests
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        return []
    try:
        response = requests.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10
        )
        if response.status_code != 200:
            return []
        models = response.json().get("data", [])
        free_models = [m["id"] for m in models if ":free" in m["id"]]
        return free_models
    except Exception as e:
        print("Error fetching OpenRouter models:", e)
        return []

@app.post("/api/ai/chat")
def chat_assistant(req: ChatRequest):
    import re
    import google.generativeai as genai
    
    query = req.message.strip()
    
    # 1. RAG Context Extraction: Match relevant records in SQLite
    conn = get_db_connection()
    cursor = conn.cursor()
    
    sectors = [
        "ai", "ml", "machine learning", "tourism", "wearables", "analytics", 
        "agritech", "agriculture", "biotech", "biotechnology", "health", 
        "healthtech", "healthcare", "medtech", "manufacturing", "agribusiness", 
        "biomedical", "engineering", "food", "renewable energy", "energy", 
        "basic science", "sciences", "iot", "chemical", "pharma", "materials", 
        "dairy", "livestock", "digital tech", "digital technologies", 
        "digital technology", "empowerment", "sustainability", "food processing", 
        "food tech", "ict", "biopharma", "it", "electronics", "industry 4.0", 
        "iomt", "circular economy", "life sciences", "robotics", "media tech", 
        "enterprise ai", "smart city", "waste processing", "assistive tech", 
        "women centric", "deeptech", "saas", "web3", "fintech", "edtech", 
        "climatetech", "spacetech", "defencetech"
    ]
    matched_sectors = [s for s in sectors if s in query.lower()]
    
    states = [
        "maharashtra", "tamil nadu", "karnataka", "delhi", "gujarat", 
        "andhra pradesh", "telangana", "punjab", "rajasthan", "uttar pradesh", 
        "west bengal", "kerala", "madhya pradesh", "chhattisgarh", "odisha", 
        "assam", "bihar", "haryana", "himachal pradesh", "jammu", "kashmir", 
        "uttarakhand", "goa", "meghalaya", "sikkim", "tripura"
    ]
    matched_states = []
    for s in states:
        if s in query.lower():
            matched_states.append(s)
            
    cities = [
        "mumbai", "chennai", "bengaluru", "bangalore", "delhi", "pune", 
        "ahmedabad", "noida", "gurgaon", "gurugram", "hyderabad", "kolkata", 
        "guntur", "visakhapatnam", "silchar", "patna", "bilaspur", "bhilai", 
        "rajkot", "solan", "srinagar", "jammu", "mysore", "indore", "kolhapur", 
        "amravati", "ludhiana", "salem", "coimbatore", "prayagraj", "kanpur", 
        "dehradun", "jaipur", "guwahati", "gautam buddha nagar", "lucknow",
        "agartala", "aligarh", "amethi", "awantipora", "bathinda", "bhilwara", 
        "bidar", "chhindwara", "cuttack", "ghaziabad", "greater noida", 
        "khurda", "kishangarh", "kottayam", "kovilpatti", "mathura", "nagpur", 
        "tumakuru", "vadlamudi", "vijayapura"
    ]
    matched_cities = []
    for c in cities:
        if c in query.lower():
            matched_cities.append(c)
            
    sql = "SELECT id, name, city, state, email, website, focus_areas, source_url FROM incubators WHERE 1=1"
    params = []
    
    if matched_states:
        state_clauses = []
        for s in matched_states:
            state_clauses.append("state LIKE ?")
            params.append(f"%{s}%")
        sql += f" AND ({' OR '.join(state_clauses)})"
        
    if matched_cities:
        city_clauses = []
        for c in matched_cities:
            if c == "bangalore":
                city_clauses.extend(["city LIKE ?", "city LIKE ?"])
                params.extend(["%bangalore%", "%bengaluru%"])
            else:
                city_clauses.append("city LIKE ?")
                params.append(f"%{c}%")
        sql += f" AND ({' OR '.join(city_clauses)})"
        
    if matched_sectors:
        sector_clauses = []
        for sec in matched_sectors:
            sector_clauses.append("focus_areas LIKE ?")
            params.append(f"%{sec}%")
        sql += f" AND ({' OR '.join(sector_clauses)})"
        
    common_short_names = ["sine", "nsrcel", "ciie", "iit", "iim", "nit", "bits", "maker village", "forge", "tihan", "kiit", "gusec", "ccmb", "c-camp", "incubimn", "imn incubation", "nagpur university"]
    matched_shorts = [sn for sn in common_short_names if sn in query.lower()]
    if matched_shorts:
        name_clauses = []
        for ns in matched_shorts:
            name_clauses.append("name LIKE ?")
            params.append(f"%{ns}%")
        sql += f" AND ({' OR '.join(name_clauses)})"
        
    sql += " LIMIT 15"
    
    has_filters = bool(matched_states or matched_cities or matched_sectors or matched_shorts)
    
    cursor.execute(sql, params)
    rows = [dict(r) for r in cursor.fetchall()]
    
    no_matches_found = False
    if not rows:
        if has_filters:
            no_matches_found = True
        else:
            cursor.execute("SELECT id, name, city, state, email, website, focus_areas, source_url FROM incubators ORDER BY name LIMIT 10")
            rows = [dict(r) for r in cursor.fetchall()]
            
    conn.close()
    
    if no_matches_found:
        context_str = "DATABASE QUERY RESULT: No records matching the user's specific search terms (city, state, sectors, or names) were found in the database."
    else:
        context_items = []
        for r in rows:
            focus = ""
            if r["focus_areas"]:
                try:
                    focus = ", ".join(json.loads(r["focus_areas"]))
                except:
                    focus = r["focus_areas"]
            item = f"- Name: {r['name']}\n  Location: {r['city']}, {r['state']}\n  Sectors: {focus}\n  Website: {r['website'] or 'N/A'}\n  Email: {r['email'] or 'N/A'}\n  Funding Source: {r['source_url'] or 'N/A'}"
            context_items.append(item)
        context_str = "\n\n".join(context_items)
    
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    if openrouter_key:
        import requests
        import random
        import time
        
        # 1. Fetch available free models
        free_models = []
        try:
            models_response = requests.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {openrouter_key}"},
                timeout=10
            )
            if models_response.status_code == 200:
                models_data = models_response.json().get("data", [])
                free_models = [m["id"] for m in models_data if ":free" in m["id"]]
        except Exception as e:
            print("Failed to fetch OpenRouter free models:", e)
            
        if free_models:
            # Prioritize selected model
            selected_model = req.model
            if selected_model and selected_model in free_models:
                free_models.remove(selected_model)
                free_models.insert(0, selected_model)
            else:
                # Default preference models
                pref_models = [m for m in free_models if "llama-3" in m or "mistral" in m]
                for pm in reversed(pref_models):
                    if pm in free_models:
                        free_models.remove(pm)
                        free_models.insert(0, pm)
            
            # Shuffle remaining models
            first = free_models[0]
            rest = free_models[1:]
            random.shuffle(rest)
            models_to_try = [first] + rest
            
            system_prompt = f"""
You are the AI Assistant for the Indian Startup Ecosystem Intelligence Portal.

Strict Instruction on Avoiding Hallucinations:
1. You must answer queries using ONLY the provided Database Context. 
2. Do not invent, guess, or assume any information not explicitly listed in the Database Context. If an incubator's website or email is not in the context, do not make one up.
3. If the context states "No records matching...", or doesn't contain matching details to answer the user's specific question, you MUST explicitly state: "Based on the system database, I could not find matching records." Do not list or mention fake or external incubators.
4. For general conversational requests (e.g. hello) or conceptual definitions (e.g. explaining what an incubator does), you can explain the concept generally, but make sure not to mention any custom incubators that are not in the provided Database Context.

Database Context:
{context_str}
"""
            
            for model in models_to_try:
                try:
                    start = time.time()
                    response = requests.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {openrouter_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": query}
                            ],
                            "temperature": 0.1
                        },
                        timeout=12
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        reply = result["choices"][0]["message"]["content"]
                        response_time = round(time.time() - start, 2)
                        
                        return {
                            "status": "success",
                            "mode": "openrouter",
                            "message": reply,
                            "model_used": model,
                            "response_time": response_time
                        }
                except Exception as e:
                    print(f"❌ {model} failed:", e)
                    continue
 
    # Fallback 2: Gemini API
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            prompt = f"""
            You are the AI Assistant for the Indian Startup Ecosystem Intelligence Portal.
            Answer the user's question clearly, professionally, and concisely using markdown formatting.
            
            User Question: "{query}"
            
            Strict Instruction on Avoiding Hallucinations:
            1. You must answer queries using ONLY the provided Database Context. 
            2. Do not invent, guess, or assume any information not explicitly listed in the Database Context. If an incubator's website or email is not in the context, do not make one up.
            3. If the context states "No records matching...", or doesn't contain matching details to answer the user's specific question, you MUST explicitly state: "Based on the system database, I could not find matching records." Do not list or mention fake or external incubators.
            4. For general conversational requests (e.g. hello) or conceptual definitions (e.g. explaining what an incubator does), you can explain the concept generally, but make sure not to mention any custom incubators that are not in the provided Database Context.
            
            Database Context:
            {context_str}
            
            Guidelines:
            - Format answers with lists, bold text, and tables where applicable to make them highly readable.
            - Ensure any links or emails mentioned are formatted as clickable markdown links.
            - Keep response under 3 paragraphs if possible.
            """
            
            response = model.generate_content(prompt)
            return {
                "status": "success",
                "mode": "gemini_ai",
                "message": response.text.strip(),
                "model_used": "gemini-1.5-flash",
                "response_time": 1.0
            }
        except Exception as e:
            pass
            
    # Fallback 3: Local database keyword search summary
    markdown_result = f"### Ecosystem Assistant (Local Database Match Mode)\n\n"
    if no_matches_found:
        markdown_result += "Based on the system database, I could not find matching records.\n"
    else:
        markdown_result += f"The AI Assistant is running in local search mode. Based on your query keywords, here are the most relevant incubator records found in the platform database:\n\n"
        markdown_result += "| Incubator Name | Location | Focus Sectors | Website |\n"
        markdown_result += "| :--- | :--- | :--- | :--- |\n"
        
        for r in rows:
            focus = "General"
            if r["focus_areas"]:
                try:
                    focus = ", ".join(json.loads(r["focus_areas"])[:3])
                except:
                    focus = r["focus_areas"]
            loc = f"{r['city'] or ''}, {r['state'] or ''}".strip(", ")
            markdown_result += f"| **{r['name']}** | {loc or 'India'} | {focus} | {r['website'] or 'N/A'} |\n"
            
        markdown_result += "\n\n**Suggestions for next steps:**\n"
        markdown_result += "- Click on the **Incubators Directory** tab to search and filter these records in detail.\n"
        markdown_result += "- Double-check spelling of states or cities in your question for better query matching.\n"
    
    return {
        "status": "success",
        "mode": "local_fallback",
        "message": markdown_result
    }

def get_smtp_config(account: Optional[str] = None) -> dict:
    if account and account.strip() not in ("", "default"):
        suffix = account.strip()
        smtp_host = os.environ.get(f"SMTP_HOST{suffix}")
        smtp_port = os.environ.get(f"SMTP_PORT{suffix}", "587")
        smtp_user = os.environ.get(f"SMTP_USER{suffix}")
        smtp_pass = os.environ.get(f"SMTP_PASS{suffix}")
        sender_email = os.environ.get(f"SENDER_EMAIL{suffix}") or smtp_user
    else:
        smtp_host = os.environ.get("SMTP_HOST")
        smtp_port = os.environ.get("SMTP_PORT", "587")
        smtp_user = os.environ.get("SMTP_USER")
        smtp_pass = os.environ.get("SMTP_PASS")
        sender_email = os.environ.get("SENDER_EMAIL") or smtp_user

    if smtp_user:
        smtp_user = smtp_user.strip().strip('"').strip("'")
    if smtp_pass:
        smtp_pass = smtp_pass.strip().strip('"').strip("'")
    if sender_email:
        sender_email = sender_email.strip().strip('"').strip("'")

    is_smtp_ready = bool(smtp_host and smtp_user and smtp_pass and "your_email" not in (smtp_user or ""))

    return {
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "smtp_pass": smtp_pass,
        "sender_email": sender_email or "no-reply@incubein.com",
        "is_smtp_ready": is_smtp_ready,
    }

def get_imap_config(account: Optional[str] = None) -> dict:
    if account and account.strip() not in ("", "default"):
        suffix = account.strip()
        imap_host = os.environ.get(f"IMAP_HOST{suffix}")
        imap_port = os.environ.get(f"IMAP_PORT{suffix}", "993")
        imap_user = os.environ.get(f"IMAP_USER{suffix}")
        imap_pass = os.environ.get(f"IMAP_PASS{suffix}")
    else:
        imap_host = os.environ.get("IMAP_HOST")
        imap_port = os.environ.get("IMAP_PORT", "993")
        imap_user = os.environ.get("IMAP_USER")
        imap_pass = os.environ.get("IMAP_PASS")

    if imap_user:
        imap_user = imap_user.strip().strip('"').strip("'")
    if imap_pass:
        imap_pass = imap_pass.strip().strip('"').strip("'")

    is_imap_ready = bool(imap_host and imap_user and imap_pass and "your_email" not in (imap_user or ""))

    return {
        "imap_host": imap_host,
        "imap_port": imap_port,
        "imap_user": imap_user,
        "imap_pass": imap_pass,
        "is_imap_ready": is_imap_ready,
    }

# Pydantic models for outreach
class OutreachEmailRequest(BaseModel):
    lead_id: str
    subject: Optional[str] = None
    body: Optional[str] = None
    cc: Optional[str] = None
    mail_account: Optional[str] = None


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

def seed_outreach_leads():
    import uuid
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Ensure trial incubator exists in incubators table
    cursor.execute("SELECT COUNT(*) FROM incubators WHERE id = 'inc_trial_rugved'")
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO incubators (
                id, name, email, city, state, organization_type, confidence_score, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            "inc_trial_rugved",
            "Trial Incubator (kadurugved0)",
            "kadurugved0@gmail.com",
            "Nagpur",
            "Maharashtra",
            "Academic Collab Partner",
            1.0,
            "resolved"
        ))
        conn.commit()

    # Ensure trial2 incubator exists in incubators table
    cursor.execute("SELECT COUNT(*) FROM incubators WHERE id = 'inc_trial_rugved2'")
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO incubators (
                id, name, email, city, state, organization_type, confidence_score, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            "inc_trial_rugved2",
            "Trial Incubator (trial2)",
            "rugveddevmain@gmail.com",
            "Nagpur",
            "Maharashtra",
            "Academic Collab Partner",
            1.0,
            "resolved"
        ))
        conn.commit()

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
            notes TEXT
        )
    ''')
    conn.commit()
    conn.close()

@app.get("/api/outreach/leads")
def get_outreach_leads():
    seed_outreach_leads()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/outreach/add-lead")
def add_outreach_lead(req: AddLeadRequest):
    import uuid
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

@app.post("/api/outreach/reset")
def reset_outreach():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM scheduled_meetings")
    cursor.execute("DELETE FROM outreach_leads")
    conn.commit()
    conn.close()
    seed_outreach_leads()
    return {"status": "success", "message": "Campaign data successfully reset."}

@app.post("/api/outreach/leads/update-status")
def update_lead_status(req: UpdateLeadStatusRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise HTTPException(status_code=404, detail="Lead not found")
    cursor.execute("UPDATE outreach_leads SET status = ? WHERE id = ?", (req.status, req.lead_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": f"Campaign lead status updated to {req.status}."}

@app.post("/api/outreach/leads/update-notes")
def update_lead_notes(req: UpdateLeadNotesRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise HTTPException(status_code=404, detail="Lead not found")
    if req.next_action_date is not None:
        cursor.execute("UPDATE outreach_leads SET notes = ?, next_action_date = ? WHERE id = ?", (req.notes, req.next_action_date, req.lead_id))
    else:
        cursor.execute("UPDATE outreach_leads SET notes = ? WHERE id = ?", (req.notes, req.lead_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Campaign lead notes updated successfully."}

class UpdateStageRequest(BaseModel):
    lead_id: str
    stage: str
    notes: Optional[str] = None

@app.post("/api/outreach/update-stage")
def update_collaboration_stage(req: UpdateStageRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if req.notes is not None:
        cursor.execute("UPDATE outreach_leads SET status = ?, notes = ? WHERE id = ?", (req.stage, req.notes, req.lead_id))
    else:
        cursor.execute("UPDATE outreach_leads SET status = ? WHERE id = ?", (req.stage, req.lead_id))
        
    conn.commit()
    conn.close()
def clean_email_reply(text: str) -> str:
    if not text:
        return ""
    import re
    cleaned = text
    split_patterns = [
        r"\r?\n\s*On\s+.*?\s+wrote:\s*",
        r"\r?\n\s*From:\s+.*",
        r"\r?\n\s*-----Original Message-----",
        r"\r?\n\s*-----Forwarded Message-----"
    ]
    for p in split_patterns:
        parts = re.split(p, cleaned, flags=re.IGNORECASE | re.DOTALL)
        if parts and parts[0].strip():
            cleaned = parts[0]
            
    result_lines = []
    for line in cleaned.splitlines():
        line_strip = line.strip()
        if line_strip.startswith(">"):
            continue
        result_lines.append(line)
        
    return "\n".join(result_lines).strip()

@app.get("/api/outreach/lead-timeline/{lead_id}")
def get_lead_timeline(lead_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (lead_id,))
    lead_row = cursor.fetchone()
    if not lead_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Lead not found")
        
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

@app.post("/api/outreach/send-email")
def trigger_outreach_email(req: OutreachEmailRequest):
    from datetime import datetime
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise HTTPException(status_code=404, detail="Lead not found")
        
    smtp_cfg = get_smtp_config(req.mail_account)
    smtp_host = smtp_cfg["smtp_host"]
    smtp_port = smtp_cfg["smtp_port"]
    smtp_user = smtp_cfg["smtp_user"]
    smtp_pass = smtp_cfg["smtp_pass"]
    sender_email = smtp_cfg["sender_email"]
    is_smtp_ready = smtp_cfg["is_smtp_ready"]

    email_sent_successfully = False
    if is_smtp_ready:
        try:
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            msg = MIMEMultipart("alternative")
            msg["Subject"] = req.subject or "Introduction to Incubein Foundation"
            msg["From"] = sender_email
            msg["To"] = lead["email"]
            if req.cc:
                msg["Cc"] = req.cc

            lead_name = lead["incubator_name"]
            is_startup = lead["incubator_id"] == "incubein_cohort"
            if is_startup:
                default_subject = "Introduction to Incubein Foundation"
                default_body = f"""Hello {lead_name},

Greetings from Incubein Foundation RTM Nagpur University.

We came across your startup and were impressed by the work you're building. At Incubein Foundation, we work closely with early-stage and growth-stage startups by providing the right ecosystem, mentorship, and resources to help them scale.

We would love to learn more about {lead_name}, understand your current challenges and growth plans, and explore how Incubein Foundation can support your journey.

If you're available, we'd be happy to schedule a 30-minute Google Meet at your convenience.

Please let us know a suitable date and time that works for you, and we'll be happy to coordinate.

Warm regards,

Team Incubein Foundation
Incubein Foundation - RTMNU Business Incubation Centre
Nagpur, Maharashtra
Email: teamincubein@gmail.com
Website: www.incubein.com"""
            else:
                default_subject = "Introduction to Incubein Foundation"
                default_body = f"""Hello {lead_name},

Greetings from Incubein Foundation RTM Nagpur University.

We came across your incubation centre and were impressed by the impactful work you're doing for the startup ecosystem. We would love to explore a potential Strategic Cooperation and Academic Collaboration between Incubein Foundation and {lead_name}.

If you're available, we'd be happy to schedule a 30-minute Google Meet at your convenience.

Please let us know a suitable date and time that works for you, and we'll be happy to coordinate.

Warm regards,

Team Incubein Foundation
Incubein Foundation - RTMNU Business Incubation Centre
Nagpur, Maharashtra
Email: teamincubein@gmail.com
Website: www.incubein.com"""

            body_text = req.body or default_body
            msg.attach(MIMEText(body_text, "plain"))

            port = int(smtp_port)
            if port == 465:
                server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, port, timeout=10)
                server.starttls()
            server.login(smtp_user, smtp_pass)
            recipients = [lead["email"]]
            if req.cc:
                recipients += [c.strip() for c in req.cc.split(",") if c.strip()]
            server.sendmail(sender_email, recipients, msg.as_string())
            server.quit()
            email_sent_successfully = True
        except Exception as e:
            print("Error sending outreach email via SMTP:", e)
            
    cursor.execute(
        "UPDATE outreach_leads SET status = 'Sent', sent_at = ?, contact_count = coalesce(contact_count, 0) + 1, last_contact_reason = ? WHERE id = ?",
        (datetime.now().isoformat(), req.subject or "Outreach Email", req.lead_id)
    )
    conn.commit()
    conn.close()
    msg_status = "Real email sent via SMTP" if email_sent_successfully else "SMTP not configured, simulated sending"
    return {"status": "success", "message": f"Outreach email campaign successfully triggered for {lead['incubator_name']} ({msg_status})."}

def send_followup_email(lead_id: str, lead_name: str, lead_email: str, followup_number: int):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from datetime import datetime
    import os
    
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT", "587")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    sender_email = os.environ.get("SENDER_EMAIL") or smtp_user or "no-reply@incubein.com"
    
    if smtp_user:
        smtp_user = smtp_user.strip().strip('"').strip("'")
    if smtp_pass:
        smtp_pass = smtp_pass.strip().strip('"').strip("'")
    if sender_email:
        sender_email = sender_email.strip().strip('"').strip("'")
        
    is_smtp_ready = smtp_host and smtp_user and smtp_pass and "your_email" not in smtp_user
    email_sent_successfully = False
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT incubator_id FROM outreach_leads WHERE id = ?", (lead_id,))
    lead_row = cursor.fetchone()
    conn.close()

    if lead_row and lead_row["incubator_id"] == "incubein_cohort":
        subject = f"Following up: Introduction to Incubein Foundation – {lead_name} (Follow-up #{followup_number})"
        body_text = f"""Dear {lead_name},

Greetings from Incubein Foundation RTM Nagpur University.

We are following up on our previous email regarding our invitation to explore how Incubein Foundation can support your startup journey.

We remain very interested in connecting with {lead_name} and would love to schedule a 30-minute Google Meet at your convenience.

Please let us know a suitable date and time that works for you, and we'll be happy to coordinate.

Warm regards,

Team Incubein Foundation
Incubein Foundation - RTMNU Business Incubation Centre
Nagpur, Maharashtra
Email: teamincubein@gmail.com
Website: www.incubein.com
(Follow-up Reference #{followup_number})
"""
    else:
        subject = f"Following up: Introduction to Incubein Foundation – {lead_name} (Follow-up #{followup_number})"
        body_text = f"""Dear {lead_name},

Greetings from Incubein Foundation RTM Nagpur University.

We are following up on our previous email regarding a potential Strategic Cooperation and Academic Collaboration between Incubein Foundation and {lead_name}.

We remain keen to explore a 30-minute Google Meet at your convenience to discuss how we can create mutual value for our respective ecosystems.

Please let us know a suitable date and time, and we'll be happy to coordinate.

Warm regards,

Team Incubein Foundation
Incubein Foundation - RTMNU Business Incubation Centre
Nagpur, Maharashtra
Email: teamincubein@gmail.com
Website: www.incubein.com
(Follow-up Reference #{followup_number})
"""
    
    if is_smtp_ready:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"Incubein Outreach <{sender_email}>"
            msg["To"] = lead_email
            
            msg.attach(MIMEText(body_text, "plain"))
            
            port = int(smtp_port)
            if port == 465:
                server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, port, timeout=10)
                server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(sender_email, [lead_email], msg.as_string())
            server.quit()
            email_sent_successfully = True
        except Exception as e:
            print(f"Error sending follow-up email via SMTP to {lead_email}: {e}")
            
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
    
    return email_sent_successfully


class MassSendRequest(BaseModel):
    target_type: str
    subject: Optional[str] = None
    body: Optional[str] = None
    cc: Optional[str] = None
    mail_account: Optional[str] = None

@app.post("/api/outreach/mass-send")
def trigger_mass_send(req: MassSendRequest):
    from datetime import datetime
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Select all Draft leads of the target type
    if req.target_type == "startups":
        cursor.execute("SELECT * FROM outreach_leads WHERE status = 'Draft' AND incubator_id = 'incubein_cohort'")
    else:
        cursor.execute("SELECT * FROM outreach_leads WHERE status = 'Draft' AND incubator_id != 'incubein_cohort'")
        
    leads = [dict(row) for row in cursor.fetchall()]
    
    if not leads:
        conn.close()
        return {"status": "success", "message": f"No draft leads found for {req.target_type}.", "sent_count": 0}
        
    smtp_cfg = get_smtp_config(req.mail_account)
    smtp_host = smtp_cfg["smtp_host"]
    smtp_port = smtp_cfg["smtp_port"]
    smtp_user = smtp_cfg["smtp_user"]
    smtp_pass = smtp_cfg["smtp_pass"]
    sender_email = smtp_cfg["sender_email"]
    is_smtp_ready = smtp_cfg["is_smtp_ready"]

    sent_count = 0
    simulated_count = 0
    
    for lead in leads:
        # Determine subject and body (with template interpolation if it's startups)
        subject_to_send = req.subject
        body_to_send = req.body
        
        # If subject/body is not provided, use default
        if req.target_type == "startups" and not subject_to_send:
            subject_to_send = f"Introduction to Incubein Foundation"
            body_to_send = f"Hello {lead['incubator_name']},\n\nGreetings from Incubein Foundation RTM Nagpur University.\n\nWe came across your startup and were impressed by the work you're building. At Incubein Foundation, we work closely with early-stage and growth-stage startups by providing the right ecosystem, mentorship, and resources to help them scale.\n\nWe would love to learn more about {lead['incubator_name']}, understand your current challenges and growth plans, and explore how Incubein Foundation can support your journey.\n\nIf you're available, we'd be happy to schedule a 30-minute Google Meet at your convenience.\n\nPlease let us know a suitable date and time that works for you, and we'll be happy to coordinate.\n\nWarm regards,\n\nTeam Incubein Foundation\nIncubein Foundation - RTMNU Business Incubation Centre\nNagpur, Maharashtra\nEmail: teamincubein@gmail.com\nWebsite: www.incubein.com"
        elif not subject_to_send:
            subject_to_send = f"Introduction to Incubein Foundation"
            body_to_send = f"Hello {lead['incubator_name']},\n\nGreetings from Incubein Foundation RTM Nagpur University.\n\nWe came across your incubation centre and were impressed by the impactful work you're doing for the startup ecosystem. We would love to explore a potential Strategic Cooperation and Academic Collaboration between Incubein Foundation and {lead['incubator_name']}.\n\nIf you're available, we'd be happy to schedule a 30-minute Google Meet at your convenience.\n\nPlease let us know a suitable date and time that works for you, and we'll be happy to coordinate.\n\nWarm regards,\n\nTeam Incubein Foundation\nIncubein Foundation - RTMNU Business Incubation Centre\nNagpur, Maharashtra\nEmail: teamincubein@gmail.com\nWebsite: www.incubein.com"
            
        # Interpolate name placeholders if present
        if body_to_send:
            body_to_send = body_to_send.replace("{StartupName}", lead["incubator_name"]).replace("{IncubatorName}", lead["incubator_name"])
        if subject_to_send:
            subject_to_send = subject_to_send.replace("{StartupName}", lead["incubator_name"]).replace("{IncubatorName}", lead["incubator_name"])
            
        email_sent = False
        if is_smtp_ready:
            try:
                import smtplib
                from email.mime.multipart import MIMEMultipart
                from email.mime.text import MIMEText
                
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject_to_send
                msg["From"] = sender_email
                msg["To"] = lead["email"]
                if req.cc:
                    msg["Cc"] = req.cc
                msg.attach(MIMEText(body_to_send, "plain"))
                
                port = int(smtp_port)
                if port == 465:
                    server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
                else:
                    server = smtplib.SMTP(smtp_host, port, timeout=10)
                    server.starttls()
                server.login(smtp_user, smtp_pass)
                recipients = [lead["email"]]
                if req.cc:
                    recipients += [c.strip() for c in req.cc.split(",") if c.strip()]
                server.sendmail(sender_email, recipients, msg.as_string())
                server.quit()
                email_sent = True
                sent_count += 1
            except Exception as e:
                print(f"Error sending mass email to {lead['email']}: {e}")
                simulated_count += 1
        else:
            simulated_count += 1
            
        # Update lead in DB
        cursor.execute(
            "UPDATE outreach_leads SET status = 'Sent', sent_at = ?, contact_count = coalesce(contact_count, 0) + 1, last_contact_reason = ? WHERE id = ?",
            (datetime.now().isoformat(), subject_to_send or "Mass Outreach Email", lead["id"])
        )
        
    conn.commit()
    conn.close()
    
    return {
        "status": "success", 
        "sent_count": sent_count,
        "simulated_count": simulated_count,
        "message": f"Successfully processed mass send for {len(leads)} {req.target_type} ({sent_count} real emails, {simulated_count} simulated)."
    }

class FollowupEmailRequest(BaseModel):
    lead_id: str

@app.post("/api/outreach/send-followup-single")
def api_send_followup_single(req: FollowupEmailRequest):
    global FOLLOWUPS_PAUSED
    if FOLLOWUPS_PAUSED:
        raise HTTPException(status_code=400, detail="Follow-up emails are permanently paused. Resume follow-ups in the Outreach Automation controls to proceed.")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead = dict(lead)
    current_count = lead.get("followup_count", 0) or 0
    
    if lead["status"] not in ["Sent", "Follow-up Sent"]:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Lead status is '{lead['status']}'. Can only follow up on Sent or Follow-up Sent leads.")
        
    next_count = current_count + 1
    if next_count > 2:
        conn.close()
        raise HTTPException(status_code=400, detail="Maximum follow-ups (2) already reached for this lead.")
        
    conn.close()
    
    email_sent = send_followup_email(lead["id"], lead["incubator_name"], lead["email"], next_count)
    msg_status = "Real email sent via SMTP" if email_sent else "SMTP not configured, simulated sending"
    
    return {
        "status": "success", 
        "message": f"Follow-up #{next_count} successfully triggered for {lead['incubator_name']} ({msg_status}).",
        "followup_count": next_count
    }

@app.post("/api/outreach/send-followups")
def api_send_followups():
    from datetime import datetime
    global FOLLOWUP_DELAY, FOLLOWUPS_PAUSED
    if FOLLOWUPS_PAUSED:
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
    
    for lead in leads:
        last_time_str = lead.get("last_followup_at") or lead.get("sent_at")
        if not last_time_str:
            continue
            
        try:
            last_time = datetime.fromisoformat(last_time_str)
            elapsed_seconds = (now - last_time).total_seconds()
            
            if elapsed_seconds >= FOLLOWUP_DELAY:
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
    from datetime import datetime
    global FOLLOWUP_DELAY
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE status IN ('Sent', 'Follow-up Sent')")
    leads = [dict(row) for row in cursor.fetchall()]
    
    now = datetime.now()
    for lead in leads:
        last_time_str = lead.get("last_followup_at") or lead.get("sent_at")
        if not last_time_str:
            continue
            
        try:
            last_time = datetime.fromisoformat(last_time_str)
            elapsed_seconds = (now - last_time).total_seconds()
            if elapsed_seconds >= FOLLOWUP_DELAY:
                current_count = lead.get("followup_count", 0) or 0
                next_count = current_count + 1
                if next_count <= 2:
                    print(f"Background daemon: Triggering follow-up #{next_count} for {lead['incubator_name']} ({lead['email']})")
                    send_followup_email(lead["id"], lead["incubator_name"], lead["email"], next_count)
        except Exception as e:
            print(f"Background daemon error sending follow-up: {e}")
            
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

def process_reply(lead_id: str, reply_text: str):
    import uuid
    import json
    import os
    import re
    from datetime import datetime
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

@app.post("/api/outreach/simulate-reply")
def process_outreach_reply(req: OutreachReplyRequest):
    res = process_reply(req.lead_id, req.reply_text)
    if not res:
        raise HTTPException(status_code=404, detail="Lead not found")
    return res

def extract_email_address(from_header):
    if not from_header:
        return ""
    import re
    match = re.search(r'<([^>]+)>', from_header)
    if match:
        return match.group(1).strip().lower()
    # Remove surrounding quotes if any
    return from_header.strip().strip('"').strip("'").lower()

def check_imap_replies_sync(account: Optional[str] = None):
    import imaplib
    import email
    from email.header import decode_header
    import os
    
    imap_cfg = get_imap_config(account)
    imap_host = imap_cfg["imap_host"]
    imap_port = imap_cfg["imap_port"]
    imap_user = imap_cfg["imap_user"]
    imap_pass = imap_cfg["imap_pass"]
        
    if not imap_cfg["is_imap_ready"]:
        label = imap_user or (f"account {account}" if account else "default account")
        print(f"IMAP parameters not configured or using placeholders for {label}. Skipping IMAP scan.")
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
            
        # Inspect the last 40 messages to find replies
        mail_ids = mail_ids[-40:]
        print(f"IMAP connection successful. Scanning the last {len(mail_ids)} messages in Inbox...")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get active leads email map that are currently waiting for a reply
        cursor.execute("SELECT id, email, status, incubator_name, sent_at FROM outreach_leads WHERE status IN ('Sent', 'Follow-up Sent')")
        leads = {row["email"].lower().strip(): row for row in cursor.fetchall()}
        
        print("Active leads waiting for replies (Sent/Follow-up status):", list(leads.keys()))
        
        for m_id in reversed(mail_ids): # Scan from newest to oldest
            if len(leads) == 0:
                print("All pending outreach replies have been detected and processed. Stopping search early.")
                break
                
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
                    
                    # Check if email is received after outreach email sent time
                    msg_date_str = msg.get("Date")
                    if msg_date_str:
                        try:
                            import email.utils
                            from datetime import datetime
                            msg_date = email.utils.parsedate_to_datetime(msg_date_str)
                            msg_date_local = msg_date.astimezone().replace(tzinfo=None)
                            
                            sent_at_str = lead["sent_at"]
                            if sent_at_str:
                                sent_at_dt = datetime.fromisoformat(sent_at_str)
                                if msg_date_local < sent_at_dt:
                                    print(f"Skipping email from {from_email} as it was received at {msg_date_local} (before outreach email sent at {sent_at_dt})")
                                    continue
                        except Exception as date_err:
                            print(f"Error parsing date for message from {from_email}: {date_err}")
                            
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

def get_google_client_config():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI")
    
    if not client_id or not client_secret or "your_google_client_id" in client_id:
        return None
        
    return {
        "web": {
            "client_id": client_id.strip().strip('"').strip("'"),
            "client_secret": client_secret.strip().strip('"').strip("'"),
            "redirect_uris": [redirect_uri.strip().strip('"').strip("'")],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
        }
    }

def create_gmeet_event(summary: str, description: str, date_str: str, time_str: str, attendee_email: str):
    import os
    import uuid
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from datetime import datetime, timedelta
    
    token_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "token.json")
    if not os.path.exists(token_path):
        print(f"Token file not found at {token_path}. OAuth not authorized — please authorize via the dashboard first.")
        return None
        
    try:
        credentials = Credentials.from_authorized_user_file(token_path)
        
        # Auto-refresh expired credentials using the stored refresh_token
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                # Persist the refreshed token
                with open(token_path, "w") as tf:
                    tf.write(credentials.to_json())
                print("Google OAuth token refreshed and saved successfully.")
            except Exception as refresh_err:
                print(f"Token refresh failed: {refresh_err}. Deleting invalid token — please re-authorize via the dashboard.")
                os.remove(token_path)
                return None
        
        if not credentials.valid:
            print("Google credentials are invalid and could not be refreshed.")
            return None
        
        service = build("calendar", "v3", credentials=credentials)
        
        try:
            start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %I:%M %p")
        except Exception:
            try:
                start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            except Exception:
                start_dt = datetime.now() + timedelta(days=2)
                
        end_dt = start_dt + timedelta(minutes=30)
        start_iso = start_dt.isoformat()
        end_iso = end_dt.isoformat()
        
        event = {
            'summary': summary,
            'description': description,
            'start': {
                'dateTime': start_iso,
                'timeZone': 'Asia/Kolkata',
            },
            'end': {
                'dateTime': end_iso,
                'timeZone': 'Asia/Kolkata',
            },
            'attendees': [
                {'email': attendee_email},
            ],
            'conferenceData': {
                'createRequest': {
                    'requestId': f"meet_{uuid.uuid4().hex[:12]}",
                    'conferenceSolutionKey': {
                        'type': 'hangoutsMeet'
                    }
                }
            }
        }
        
        created_event = service.events().insert(
            calendarId='primary',
            body=event,
            conferenceDataVersion=1
        ).execute()
        
        meet_link = None
        conf_data = created_event.get("conferenceData", {})
        entry_points = conf_data.get("entryPoints", [])
        for ep in entry_points:
            if ep.get("entryPointType") == "video":
                meet_link = ep.get("uri")
                break
                
        if not meet_link:
            meet_link = created_event.get("htmlLink")
            
        return {
            "calendar_event_id": created_event.get("id"),
            "meet_link": meet_link
        }
    except Exception as e:
        print("Error creating Google Meet calendar event:", e)
        return None

def generate_ics_file_content(summary: str, description: str, date_str: str, time_str: str, meet_link: str, organizer_email: str, attendee_email: str) -> str:
    from datetime import datetime, timedelta
    try:
        start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %I:%M %p")
    except Exception:
        try:
            start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        except Exception:
            start_dt = datetime.now() + timedelta(days=2)
            
    end_dt = start_dt + timedelta(minutes=30)
    
    # Calculate offset for UTC
    start_utc = start_dt - timedelta(hours=5, minutes=30)
    end_utc = end_dt - timedelta(hours=5, minutes=30)
    
    start_str = start_utc.strftime("%Y%m%dT%H%M%SZ")
    end_str = end_utc.strftime("%Y%m%dT%H%M%SZ")
    dtstamp_str = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    
    uid = f"meet-{start_str}-{attendee_email.replace('@', '-')}"
    
    esc_summary = summary.replace(",", "\\,").replace(";", "\\;")
    esc_description = description.replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")
    
    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Incubein Foundation//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"DTSTART:{start_str}",
        f"DTEND:{end_str}",
        f"DTSTAMP:{dtstamp_str}",
        f"ORGANIZER;CN=Incubein Admin:mailto:{organizer_email}",
        f"ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN={attendee_email}:mailto:{attendee_email}",
        f"UID:{uid}",
        f"SUMMARY:{esc_summary}",
        f"DESCRIPTION:{esc_description}\\n\\nJoin Video Call: {meet_link}",
        f"LOCATION:{meet_link}",
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
        "TRANSP:OPAQUE",
        "BEGIN:VALARM",
        "TRIGGER:-PT15M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Reminder",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR"
    ]
    return "\r\n".join(ics_lines)

def send_meeting_invite_email(lead_name: str, lead_email: str, date_str: str, time_str: str, meet_link: str):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders
    import os
    
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT", "587")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    sender_email = os.environ.get("SENDER_EMAIL") or smtp_user or "no-reply@incubein.com"
    
    if smtp_user:
        smtp_user = smtp_user.strip().strip('"').strip("'")
    if smtp_pass:
        smtp_pass = smtp_pass.strip().strip('"').strip("'")
    if sender_email:
        sender_email = sender_email.strip().strip('"').strip("'")
        
    is_smtp_ready = smtp_host and smtp_user and smtp_pass and "your_email" not in smtp_user
    if not is_smtp_ready:
        print("SMTP credentials are not configured or using placeholders. Skipping email invitation delivery.")
        return False
        
    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = f"Google Meet Confirmation – Incubein Foundation"
        msg["From"] = f"Team Incubein Foundation <{sender_email}>"
        msg["To"] = lead_email
        
        summary = f"30-Minute Google Meet: Incubein Foundation & {lead_name}"
        description = f"Dear {lead_name},\n\nThank you for your response. We appreciate your interest in connecting with Incubein Foundation - RTMNU Business Incubation Centre.\n\nWe're pleased to confirm our 30-minute Google Meet as per the following schedule:\n\nDate: {date_str}\nTime: {time_str} (IST)\nGoogle Meet Link: {meet_link}\n\nDuring the meeting, we'd love to learn more about {lead_name}, understand your current goals and challenges, and discuss how Incubein Foundation can support your journey through incubation, mentorship, funding readiness, strategic guidance, and our startup ecosystem.\n\nIf you have any documents, a pitch deck, or specific discussion points you'd like to share, please feel free to keep them handy for the meeting.\n\nIf you need to reschedule, kindly let us know in advance, and we'll be happy to coordinate another suitable time.\n\nWe look forward to speaking with you.\n\nWarm regards,\nTeam Incubein Foundation\nIncubein Foundation - RTMNU Business Incubation Centre\nNagpur, Maharashtra\nEmail: teamincubein@gmail.com\nWebsite: www.incubein.com"
        
        msg_alternative = MIMEMultipart("alternative")
        msg.attach(msg_alternative)
        
        body_text = f"{description}\n\nGoogle Meet: {meet_link}\nDate: {date_str}\nTime: {time_str}"
        msg_alternative.attach(MIMEText(body_text, "plain"))
        
        body_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc;">
                <div style="max-width: 600px; margin: 32px auto; padding: 2rem; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                    <h2 style="color: #7c3aed; margin-top: 0; font-size: 1.3rem;">Google Meet Confirmation – Incubein Foundation</h2>
                    <p>Dear <strong>{lead_name}</strong>,</p>
                    <p>Thank you for your response. We appreciate your interest in connecting with <strong>Incubein Foundation – RTMNU Business Incubation Centre</strong>.</p>
                    <p>We’re pleased to confirm our <strong>30-minute Google Meet</strong> as per the following schedule:</p>
                    
                    <div style="background: #f1f5f9; padding: 1.25rem 1.5rem; border-radius: 8px; margin: 1.5rem 0; border-left: 4px solid #7c3aed;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="width: 120px; padding: 6px 0; color: #64748b; font-weight: 600;">Date:</td>
                                <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">{date_str}</td>
                            </tr>
                            <tr>
                                <td style="color: #64748b; font-weight: 600; padding: 6px 0;">Time:</td>
                                <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">{time_str} (IST)</td>
                            </tr>
                            <tr>
                                <td style="color: #64748b; font-weight: 600; padding: 6px 0;">Google Meet:</td>
                                <td style="padding: 6px 0;">
                                    <a href="{meet_link}" style="color: #7c3aed; text-decoration: none; font-weight: 700;">Join Google Meet →</a>
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    <p>During the meeting, we’d love to learn more about <strong>{lead_name}</strong>, understand your current goals and challenges, and discuss how Incubein Foundation can support your journey through incubation, mentorship, funding readiness, strategic guidance, and our startup ecosystem.</p>
                    <p>If you have any documents, a pitch deck, or specific discussion points you’d like to share, please feel free to keep them handy for the meeting.</p>
                    <p>If you need to reschedule, kindly let us know in advance, and we’ll be happy to coordinate another suitable time.</p>
                    <p>We look forward to speaking with you.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;">
                    <p style="margin: 0;"><strong>Team Incubein Foundation</strong><br>
                    Incubein Foundation – RTMNU Business Incubation Centre<br>
                    Nagpur, Maharashtra<br>
                    Email: <a href="mailto:teamincubein@gmail.com" style="color: #7c3aed;">teamincubein@gmail.com</a><br>
                    Website: <a href="http://www.incubein.com" style="color: #7c3aed;">www.incubein.com</a></p>
                </div>
            </body>
        </html>
        """
        msg_alternative.attach(MIMEText(body_html, "html"))
        
        ics_content = generate_ics_file_content(
            summary=summary,
            description=description,
            date_str=date_str,
            time_str=time_str,
            meet_link=meet_link,
            organizer_email=sender_email,
            attendee_email=lead_email
        )
        
        attachment = MIMEBase('text', 'calendar', method='REQUEST')
        attachment.set_payload(ics_content)
        encoders.encode_base64(attachment)
        attachment.add_header('Content-Disposition', 'attachment; filename="invite.ics"')
        attachment.add_header('Content-class', 'urn:content-classes:calendarmessage')
        msg.attach(attachment)
        
        ics_part = MIMEText(ics_content, 'calendar; method=REQUEST')
        ics_part.add_header('Content-class', 'urn:content-classes:calendarmessage')
        msg.attach(ics_part)
        
        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=10)
            server.starttls()
            
        server.login(smtp_user, smtp_pass)
        server.sendmail(sender_email, [lead_email], msg.as_string())
        server.quit()
        print(f"Meeting invitation email with .ics attachment sent successfully to {lead_email}!")
        return True
    except Exception as smtp_err:
        print("Failed to send meeting invitation email via SMTP:", smtp_err)
        return False

oauth_states = {}

@app.get("/api/outreach/authorize")
def google_authorize():
    from google_auth_oauthlib.flow import Flow
    from fastapi.responses import RedirectResponse
    config = get_google_client_config()
    if not config:
        raise HTTPException(
            status_code=400, 
            detail="Google OAuth credentials are not configured in backend/.env file. Please populate GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )
        
    try:
        flow = Flow.from_client_config(
            config,
            scopes=["https://www.googleapis.com/auth/calendar.events"]
        )
        flow.redirect_uri = config["web"]["redirect_uris"][0]
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        # Store code_verifier using state as the key
        oauth_states[state] = flow.code_verifier
        # Return both a redirect AND the URL for flexibility
        return {"authorization_url": authorization_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate authorization URL: {str(e)}")

@app.get("/api/outreach/google/auth")
def google_auth_alias():
    """Alias route — same as /api/outreach/authorize. Redirects browser directly to Google OAuth."""
    from google_auth_oauthlib.flow import Flow
    from fastapi.responses import RedirectResponse
    config = get_google_client_config()
    if not config:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env."
        )
    try:
        flow = Flow.from_client_config(
            config,
            scopes=["https://www.googleapis.com/auth/calendar.events"]
        )
        flow.redirect_uri = config["web"]["redirect_uris"][0]
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        oauth_states[state] = flow.code_verifier
        return RedirectResponse(authorization_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate authorization URL: {str(e)}")

@app.get("/api/outreach/oauth2callback")
def google_oauth2callback(code: str, state: Optional[str] = None, error: Optional[str] = None):
    from google_auth_oauthlib.flow import Flow
    if error:
        return HTMLResponse(content=f"<h3>Authorization Error</h3><p>{error}</p>", status_code=400)
        
    config = get_google_client_config()
    if not config:
        return HTMLResponse(content="<h3>Configuration Error</h3><p>OAuth configuration is missing in backend/.env.</p>", status_code=400)
        
    try:
        flow = Flow.from_client_config(
            config,
            scopes=["https://www.googleapis.com/auth/calendar.events"]
        )
        flow.redirect_uri = config["web"]["redirect_uris"][0]
        
        # Retrieve the code_verifier using state
        code_verifier = oauth_states.pop(state, None) if state else None
        flow.fetch_token(code=code, code_verifier=code_verifier)
        
        credentials = flow.credentials
        
        token_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "token.json")
        with open(token_path, "w") as token_file:
            token_file.write(credentials.to_json())
            
        html_content = """
        <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: sans-serif; text-align: center; padding-top: 5rem; background: #f8f9ff;">
                <h2 style="color: #10b981;">✓ Google Calendar Authorization Successful!</h2>
                <p>The outreach automation system has been authorized to schedule Google Meet meetings.</p>
                <p style="color: #6b7280; font-size: 0.9rem;">You can close this tab and return to the Incubein dashboard.</p>
                <script>
                    setTimeout(() => { window.close(); }, 5000);
                </script>
            </body>
        </html>
        """
        return HTMLResponse(content=html_content, status_code=200)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return HTMLResponse(content=f"<h3>Token Exchange Failed</h3><p>{str(e)}</p>", status_code=500)

@app.get("/api/outreach/oauth-status")
def get_oauth_status():
    token_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "token.json")
    is_authorized = os.path.exists(token_path)
    
    config = get_google_client_config()
    is_configured = config is not None
    
    return {
        "is_configured": is_configured,
        "is_authorized": is_authorized
    }

class OutreachConfig(BaseModel):
    sync_interval: int
    followup_delay: Optional[int] = 120
    scanning_paused: Optional[bool] = None
    followups_paused: Optional[bool] = None

IMAP_SYNC_INTERVAL = 30  # background IMAP check interval in seconds. 0 or negative means manual only.
FOLLOWUP_DELAY = 120
SCANNING_PAUSED = False
FOLLOWUPS_PAUSED = False

@app.get("/api/outreach/config")
def get_outreach_config():
    global IMAP_SYNC_INTERVAL, FOLLOWUP_DELAY, SCANNING_PAUSED, FOLLOWUPS_PAUSED
    return {
        "sync_interval": IMAP_SYNC_INTERVAL,
        "followup_delay": FOLLOWUP_DELAY,
        "scanning_paused": SCANNING_PAUSED,
        "followups_paused": FOLLOWUPS_PAUSED,
    }

@app.post("/api/outreach/config")
def update_outreach_config(cfg: OutreachConfig):
    global IMAP_SYNC_INTERVAL, FOLLOWUP_DELAY, SCANNING_PAUSED, FOLLOWUPS_PAUSED
    IMAP_SYNC_INTERVAL = cfg.sync_interval
    if cfg.followup_delay is not None:
        FOLLOWUP_DELAY = cfg.followup_delay
    if cfg.scanning_paused is not None:
        SCANNING_PAUSED = cfg.scanning_paused
    if cfg.followups_paused is not None:
        FOLLOWUPS_PAUSED = cfg.followups_paused
    print(f"Updated outreach config: IMAP sync={IMAP_SYNC_INTERVAL}s, followup delay={FOLLOWUP_DELAY}s, scanning_paused={SCANNING_PAUSED}, followups_paused={FOLLOWUPS_PAUSED}")
    return {
        "status": "success",
        "sync_interval": IMAP_SYNC_INTERVAL,
        "followup_delay": FOLLOWUP_DELAY,
        "scanning_paused": SCANNING_PAUSED,
        "followups_paused": FOLLOWUPS_PAUSED,
    }

class CheckRepliesRequest(BaseModel):
    mail_account: Optional[str] = None

@app.post("/api/outreach/check-replies")
def trigger_check_replies(req: Optional[CheckRepliesRequest] = None):
    from datetime import datetime
    global SCANNING_PAUSED
    if SCANNING_PAUSED:
        return {"status": "paused", "checked_at": datetime.now().isoformat(), "new_replies": [], "message": "Inbox scanning is permanently paused. Resume scanning in the Outreach Automation controls to proceed."}
    account = req.mail_account if req else None
    replies = check_imap_replies_sync(account)
    return {"status": "success", "checked_at": datetime.now().isoformat(), "new_replies": replies, "mail_account": account or "default"}

class ScheduleMeetingRequest(BaseModel):
    lead_id: str
    date: str
    time: str

@app.post("/api/outreach/schedule-meeting")
def api_schedule_meeting(req: ScheduleMeetingRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outreach_leads WHERE id = ?", (req.lead_id,))
    lead = cursor.fetchone()
    if not lead:
        conn.close()
        raise HTTPException(status_code=404, detail="Lead not found")
        
    lead = dict(lead)
    
    import uuid
    summary = f"MOU Collaboration: {lead['incubator_name']}"
    description = f"Introductory discussion regarding strategic cooperation and academic collaboration MoU."
    
    gmeet_info = create_gmeet_event(
        summary=summary,
        description=description,
        date_str=req.date,
        time_str=req.time,
        attendee_email=lead["email"]
    )
    
    calendar_event_id = None
    if gmeet_info:
        meeting_link = gmeet_info["meet_link"]
        calendar_event_id = gmeet_info["calendar_event_id"]
        print(f"Successfully scheduled Google Meet call: {meeting_link}")
    else:
        meeting_link = f"https://meet.google.com/abc-{uuid.uuid4().hex[:4]}-xyz"
        calendar_event_id = f"gcal_{uuid.uuid4().hex[:12]}"
        print(f"OAuth not authorized. Using fallback meet link: {meeting_link}")
        
    meeting_id = f"evt_{uuid.uuid4().hex[:8]}"
    
    cursor.execute("SELECT COUNT(*) FROM scheduled_meetings WHERE lead_id = ?", (req.lead_id,))
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO scheduled_meetings (
                id, lead_id, incubator_id, incubator_name, title, date, time, calendar_event_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            meeting_id,
            req.lead_id,
            lead["incubator_id"],
            lead["incubator_name"],
            summary,
            req.date,
            req.time,
            calendar_event_id,
            "Scheduled"
        ))
        
    send_meeting_invite_email(
        lead_name=lead["incubator_name"],
        lead_email=lead["email"],
        date_str=req.date,
        time_str=req.time,
        meet_link=meeting_link
    )
    
    meeting_scheduled_at = f"{req.date} at {req.time}"
    cursor.execute('''
        UPDATE outreach_leads 
        SET status = 'Meeting Scheduled',
            meeting_link = ?,
            meeting_scheduled_at = ?
        WHERE id = ?
    ''', (
        meeting_link,
        meeting_scheduled_at,
        req.lead_id
    ))
    
    conn.commit()
    conn.close()
    
    return {
        "status": "success",
        "meeting_link": meeting_link,
        "meeting_scheduled_at": meeting_scheduled_at
    }

@app.get("/api/outreach/meetings")
def get_outreach_meetings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT m.*, l.meeting_link, COALESCE(m.incubator_id, l.incubator_id) as incubator_id 
        FROM scheduled_meetings m
        LEFT JOIN outreach_leads l ON m.lead_id = l.id
    ''')
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

@app.post("/api/outreach/meetings/update-status")
def update_meeting_status(req: UpdateMeetingStatusRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM scheduled_meetings WHERE id = ?", (req.meeting_id,))
    meeting = cursor.fetchone()
    if not meeting:
        conn.close()
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if req.status.lower() == "completed":
        lead_id = meeting["lead_id"]
        # Delete this meeting and any other meetings associated with this lead
        cursor.execute("DELETE FROM scheduled_meetings WHERE id = ?", (req.meeting_id,))
        if lead_id:
            cursor.execute("DELETE FROM scheduled_meetings WHERE lead_id = ?", (lead_id,))
            cursor.execute("DELETE FROM outreach_leads WHERE id = ?", (lead_id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Meeting completed. Incubator removed from campaign and meetings."}
    else:
        cursor.execute("UPDATE scheduled_meetings SET status = ? WHERE id = ?", (req.status, req.meeting_id))
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Meeting status updated to {req.status}."}

@app.get("/api/outreach/calendar-events")
def get_external_calendar_events():
    import requests
    import os
    
    api_key = os.environ.get("GoogleCalender") or os.environ.get("GoogleCalendar")
    if api_key:
        api_key = api_key.strip().strip('"').strip("'")
        
    if not api_key or "AIzaSy" not in api_key:
        return {"status": "mock", "events": [
            {"summary": "Nagpur University Foundation Day", "date": "2026-08-04"},
            {"summary": "Independence Day Holiday", "date": "2026-08-15"},
            {"summary": "Startup Pitch Competition", "date": "2026-09-10"}
        ]}
        
    try:
        # Fetch from Indian Holidays public calendar using their API key
        calendar_id = "en.indian#holiday@group.v.calendar.google.com"
        url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events?key={api_key}&maxResults=10&timeMin=2026-01-01T00:00:00Z"
        res = requests.get(url, timeout=5)
        if res.ok:
            items = res.json().get("items", [])
            events = []
            for item in items:
                summary = item.get("summary")
                start = item.get("start", {})
                date_val = start.get("date") or start.get("dateTime", "").split("T")[0]
                if summary and date_val:
                    events.append({"summary": summary, "date": date_val})
            events.sort(key=lambda x: x["date"])
            return {"status": "real", "events": events[:5]}
    except Exception as e:
        print("Error fetching Google Calendar events:", e)
        
    return {"status": "error_fallback", "events": [
        {"summary": "Nagpur University Foundation Day", "date": "2026-08-04"},
        {"summary": "Independence Day Holiday", "date": "2026-08-15"},
        {"summary": "Startup Pitch Competition", "date": "2026-09-10"}
    ]}

# Start periodic background email reply checker daemon thread
import threading
import time

def start_imap_checking_loop():
    def loop():
        global IMAP_SYNC_INTERVAL, SCANNING_PAUSED, FOLLOWUPS_PAUSED
        while True:
            try:
                if IMAP_SYNC_INTERVAL > 0:
                    if not SCANNING_PAUSED:
                        for acct in [None, "1"]:
                            check_imap_replies_sync(acct)
                    else:
                        print("[Background] Inbox scanning paused; skipping IMAP check cycle.")
                    if not FOLLOWUPS_PAUSED:
                        check_and_send_followups_sync()
                    else:
                        print("[Background] Follow-ups paused; skipping follow-up dispatch cycle.")
            except Exception as e:
                print("IMAP background checker loop error:", e)

            sleep_time = max(5, IMAP_SYNC_INTERVAL) if IMAP_SYNC_INTERVAL > 0 else 5
            time.sleep(sleep_time)
            
    t = threading.Thread(target=loop, daemon=True)
    t.start()

@app.on_event("startup")
def on_startup():
    start_imap_checking_loop()


# ─── INCUBEIN Cohort Evaluator Endpoints ──────────────────────
from fastapi import UploadFile, File, Form, Query
from typing import Optional
import io
from .evaluator import (
    encrypt_val,
    decrypt_val,
    clean_revenue,
    clean_team_size,
    clean_dpiit,
    map_excel_headers,
    extract_dynamic_rows_and_headers,
    evaluate_dynamic_features,
    evaluate_rules,
    evaluate_advanced_heuristics,
    compute_similarity_matrix
)
from .database import get_mongo_db

@app.post("/api/incubein/upload")
async def upload_cohort_excel(
    file: UploadFile = File(...),
    entity_type: str = Form("startup")
):
    try:
        contents = await file.read()
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        sheet = wb.active
        
        headers, rows_data, header_map = extract_dynamic_rows_and_headers(sheet)
        
        if not rows_data:
            return {"status": "error", "message": "No valid data rows found in the uploaded Excel file."}

        startups = []
        for row_info in rows_data:
            row_idx = row_info["row_idx"]
            entity_name = row_info["entity_name"]
            raw_data = row_info["raw_data"]
            row_values = row_info["row_values"]

            def get_col_val(key):
                idx = header_map.get(key)
                if idx is not None and idx < len(row_values):
                    return row_values[idx]
                return None

            dpiit_registered_val = get_col_val("dpiit_registered")
            has_dpiit, dpiit_num = clean_dpiit(dpiit_registered_val)
            
            raw_rev = get_col_val("revenue")
            rev_val = clean_revenue(raw_rev)
            
            raw_team = get_col_val("team_size")
            team_size_val = clean_team_size(raw_team)

            # Build record with both structured & dynamic raw data
            startup_data = {
                "id_temp": f"temp_{row_idx}",
                "entity_type": entity_type,
                "startup_name": entity_name,
                "name": str(get_col_val("name") or entity_name).strip(),
                "sector": str(get_col_val("sector") or "General").strip(),
                "stage": str(get_col_val("stage") or "Active").strip(),
                "revenue": rev_val,
                "team_size": team_size_val,
                "dpiit": has_dpiit,
                "dpiit_number": dpiit_num,
                "website": str(get_col_val("website") or "").strip(),
                "pitch_deck_url": str(get_col_val("pitch_deck_url") or "").strip(),
                "business_summary": str(get_col_val("business_summary") or raw_data.get(headers[0], "") if headers else "").strip(),
                "competitors": str(get_col_val("competitors") or "").strip(),
                "applied_other": str(get_col_val("applied_other") or "").strip(),
                "litigation": str(get_col_val("litigation") or "").strip(),
                "highest_qualification": str(get_col_val("highest_qualification") or "").strip(),
                "school_university": str(get_col_val("school_university") or "").strip(),
                "gender": str(get_col_val("gender") or "").strip(),
                "city_state": str(get_col_val("city_state") or "").strip(),
                "comments": str(get_col_val("comments") or "").strip(),
                "legal_entity": str(get_col_val("legal_entity") or "").strip(),
                "applying_for": str(get_col_val("applying_for") or "").strip(),
                "timestamp": str(get_col_val("timestamp") or "").strip(),
                # Dynamic Excel column data
                "all_columns": [h for h in headers if h],
                "raw_data": raw_data
            }
            
            # Rule Engine Evaluation
            rule_score, rule_breakdown = evaluate_rules(startup_data)
            startup_data["rule_score"] = rule_score
            startup_data["rule_breakdown"] = rule_breakdown
            
            # Advanced Heuristics
            eval_result = evaluate_advanced_heuristics(startup_data)
            
            # Dynamic Features Evaluation for random columns
            dynamic_score, feature_scores, dyn_strengths, dyn_weaknesses = evaluate_dynamic_features(raw_data, headers)
            startup_data["feature_scores"] = feature_scores
            startup_data["dynamic_score"] = dynamic_score
            
            # Blended final score: combines rule score & dynamic column evaluation
            if len(headers) > 6:
                final_score_val = round((rule_score * 0.4) + (dynamic_score * 0.6), 1)
            else:
                final_score_val = round(rule_score, 1)
                
            startup_data["final_score"] = final_score_val
            startup_data["llm_score"] = eval_result["llm_score"]
            
            # Merge strengths & weaknesses
            all_strengths = list(dict.fromkeys(eval_result["strengths"] + dyn_strengths))
            all_weaknesses = list(dict.fromkeys(eval_result["weaknesses"] + dyn_weaknesses))
            
            startup_data["evaluation"] = {
                "innovation": eval_result["innovation"],
                "market": eval_result["market"],
                "scalability": eval_result["scalability"],
                "execution": eval_result["execution"],
                "problem": eval_result["problem"],
                "strengths": all_strengths[:4],
                "weaknesses": all_weaknesses[:4],
                "recommendation": eval_result["recommendation"]
            }
            
            if final_score_val >= 70:
                priority_val = "High"
            elif final_score_val >= 40:
                priority_val = "Medium"
            else:
                priority_val = "Low"
            startup_data["priority"] = priority_val
            
            # Fallback PII resolution from raw_data if mapped header was missing
            detected_email = get_col_val("email")
            detected_name = get_col_val("name") or entity_name
            detected_mobile = get_col_val("mobile")
            detected_address = get_col_val("address") or get_col_val("city_state")

            if not detected_email:
                for k, v in raw_data.items():
                    if v and "@" in v and "." in v and not str(v).startswith("http"):
                        detected_email = v
                        break

            if not detected_mobile:
                for k, v in raw_data.items():
                    if v and re.search(r"^[+]?\d{10,12}$", str(v).replace(" ", "").replace("-", "")):
                        detected_mobile = v
                        break

            if not detected_address:
                for k, v in raw_data.items():
                    if v and any(loc in k.lower() for loc in ["city", "state", "address", "location", "region"]):
                        detected_address = v
                        break

            # PII fields encryption
            startup_data["encrypted_fields"] = {
                "name": encrypt_val(detected_name),
                "email": encrypt_val(detected_email),
                "mobile": encrypt_val(detected_mobile),
                "alternet_mobile": encrypt_val(get_col_val("alternet_mobile")),
                "dob": encrypt_val(get_col_val("dob")),
                "address": encrypt_val(detected_address),
            }
            
            startups.append(startup_data)
            
        if not startups:
            return {"status": "error", "message": "No valid startup/incubator rows processed."}
            
        # Compute similarity matrix across summary / text fields
        startups = compute_similarity_matrix(startups)
        
        # Sort by final score & rank
        startups.sort(key=lambda x: x["final_score"], reverse=True)
        for rank_idx, s in enumerate(startups):
            s["rank"] = rank_idx + 1
            if "id_temp" in s:
                del s["id_temp"]
                
        # Save to MongoDB
        db = get_mongo_db()
        # Delete existing entries of the same entity_type (or all if unspecified)
        db["incubein_applications"].delete_many({"$or": [{"entity_type": entity_type}, {"entity_type": {"$exists": False}}]})
        db["incubein_applications"].insert_many(startups)
        
        return {
            "status": "success",
            "message": f"Successfully processed and stored {len(startups)} {entity_type} entries with {len(headers)} columns.",
            "columns_count": len(headers)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process cohort excel: {str(e)}")

@app.get("/api/incubein/applications")
def get_incubein_applications(entity_type: Optional[str] = Query(None)):
    try:
        db = get_mongo_db()
        query = {}
        if entity_type:
            query = {"$or": [{"entity_type": entity_type}, {"entity_type": {"$exists": False}}]}
            
        cursor = db["incubein_applications"].find(query).sort("rank", 1)
        applications = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            
            # Decrypt sensitive fields on the fly
            enc = doc.get("encrypted_fields", {})
            doc["name"] = decrypt_val(enc.get("name", "")) or doc.get("name", "")
            doc["email"] = decrypt_val(enc.get("email", ""))
            doc["mobile"] = decrypt_val(enc.get("mobile", ""))
            doc["alternet_mobile"] = decrypt_val(enc.get("alternet_mobile", ""))
            doc["dob"] = decrypt_val(enc.get("dob", ""))
            doc["address"] = decrypt_val(enc.get("address", ""))
            
            if "encrypted_fields" in doc:
                del doc["encrypted_fields"]
                
            applications.append(doc)
        return applications
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/incubein/delete")
def delete_incubein_applications():
    try:
        db = get_mongo_db()
        db["incubein_applications"].delete_many({})
        return {"status": "success", "message": "All startup applications cleared successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UpdatePriorityRequest(BaseModel):
    app_id: str
    priority: str

@app.post("/api/incubein/applications/priority")
def update_application_priority(req: UpdatePriorityRequest):
    try:
        db = get_mongo_db()
        from bson import ObjectId
        if req.priority not in ["High", "Medium", "Low"]:
            raise HTTPException(status_code=400, detail="Invalid priority value. Must be High, Medium, or Low.")
            
        result = db["incubein_applications"].update_one(
            {"_id": ObjectId(req.app_id)},
            {"$set": {"priority": req.priority}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Application not found.")
            
        return {"status": "success", "message": f"Successfully updated priority to {req.priority}."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AddCohortToEcosystemRequest(BaseModel):
    app_ids: List[str]
    all: bool

@app.post("/api/incubein/add-to-db")
def add_cohort_to_database(req: AddCohortToEcosystemRequest):
    try:
        db = get_mongo_db()
        from bson import ObjectId
        import datetime
        
        if req.all:
            query = {}
        else:
            # Parse object ids safely
            parsed_ids = []
            for aid in req.app_ids:
                try:
                    parsed_ids.append(ObjectId(aid))
                except:
                    pass
            query = {"_id": {"$in": parsed_ids}}
            
        cursor = db["incubein_applications"].find(query)
        
        inserted_count = 0
        for doc in cursor:
            # Decrypt name
            enc = doc.get("encrypted_fields", {})
            founder_name = decrypt_val(enc.get("name", ""))
            
            # Prepare startup record
            startup_record = {
                "startup_name": doc["startup_name"],
                "sector": doc["sector"],
                "founders": founder_name,
                "website": doc["website"],
                "funding_stage": doc["stage"],
                "hq_city": doc["city_state"].split(",")[0].strip() if doc["city_state"] else "Unknown",
                "incubated_at": datetime.datetime.now().strftime("%Y-%m-%d"),
                "incubator_id": "incubein_cohort",
                "confidence_score": doc["final_score"],
                "status": "Shortlisted",
                "last_updated": datetime.datetime.now().isoformat(),
                "source_url": "Cohort Excel Upload"
            }
            
            # Check duplicate by name
            existing = db["startups"].find_one({"startup_name": doc["startup_name"]})
            if not existing:
                # Find maximum numeric ID
                max_id = 1
                try:
                    all_ids = []
                    for st_doc in db["startups"].find({}, {"id": 1}):
                        id_val = st_doc.get("id")
                        if id_val:
                            if isinstance(id_val, int):
                                all_ids.append(id_val)
                            elif isinstance(id_val, str) and id_val.isdigit():
                                all_ids.append(int(id_val))
                    if all_ids:
                        max_id = max(all_ids) + 1
                except Exception as id_err:
                    print("Error calculating max startup id:", id_err)
                
                startup_record["id"] = str(max_id)
                db["startups"].insert_one(startup_record)
                inserted_count += 1
                
        return {"status": "success", "message": f"Successfully imported {inserted_count} startups into the ecosystem directory."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/incubein/add-to-campaigns")
def add_cohort_to_campaigns(req: AddCohortToEcosystemRequest):
    try:
        db = get_mongo_db()
        from bson import ObjectId
        import uuid
        
        if req.all:
            query = {}
        else:
            parsed_ids = []
            for aid in req.app_ids:
                try:
                    parsed_ids.append(ObjectId(aid))
                except:
                    pass
            query = {"_id": {"$in": parsed_ids}}
            
        cursor = db["incubein_applications"].find(query)
        
        # Open translation connection
        conn = get_db_connection()
        db_cursor = conn.cursor()
        
        inserted_count = 0
        for doc in cursor:
            enc = doc.get("encrypted_fields", {})
            email = decrypt_val(enc.get("email", ""))
            
            if not email:
                continue
                
            # Check duplicate in outreach_leads using both email and startup_name
            db_cursor.execute("SELECT id FROM outreach_leads WHERE email = ? AND incubator_name = ?", (email, doc["startup_name"]))
            existing = db_cursor.fetchone()
            
            if existing:
                # Update existing lead status and lead_score
                db_cursor.execute('''
                    UPDATE outreach_leads 
                    SET status = 'Draft', lead_score = 0, incubator_id = 'incubein_cohort' 
                    WHERE email = ? AND incubator_name = ?
                ''', (email, doc["startup_name"]))
                inserted_count += 1
            else:
                # Insert new lead with all required schema columns populated
                lead_id = f"lead_{uuid.uuid4().hex[:8]}"
                db_cursor.execute('''
                    INSERT INTO outreach_leads (
                        id, incubator_id, incubator_name, email, status, lead_score, 
                        contact_count, last_contact_reason, next_action_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (lead_id, 'incubein_cohort', doc["startup_name"], email, 'Draft', 0, 0, 'None', ''))
                inserted_count += 1
                
        conn.commit()
        conn.close()
        
        return {"status": "success", "message": f"Successfully added {inserted_count} startups to the outreach campaign leads."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outreach/clear-startups")
def clear_startup_campaigns():
    try:
        db = get_mongo_db()
        res = db["outreach_leads"].delete_many({"incubator_id": "incubein_cohort"})
        return {"status": "success", "message": f"Cleared {res.deleted_count} startup campaign leads successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/incubators/clear")
def clear_incubators_directory():
    try:
        db = get_mongo_db()
        res = db["incubators"].delete_many({})
        return {"status": "success", "message": f"Successfully cleared {res.deleted_count} incubators from the directory."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/startups/clear")
def clear_startups_directory():
    try:
        db = get_mongo_db()
        res = db["startups"].delete_many({})
        return {"status": "success", "message": f"Successfully cleared {res.deleted_count} startups from the directory."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Web Scraping & Data Enrichment Hub API ---
class ScrapeEnrichRequest(BaseModel):
    entity_name: str
    entity_type: str = "incubator" # "incubator" | "startup"
    city: str = ""
    state: str = ""

@app.post("/api/enrichment/scrape")
def scrape_and_enrich_entity(req: ScrapeEnrichRequest):
    try:
        from .enricher import enrich_entity_data
        enriched = enrich_entity_data(
            entity_name=req.entity_name,
            entity_type=req.entity_type,
            user_city=req.city,
            user_state=req.state
        )
        return {"status": "success", "data": enriched}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data enrichment failed: {str(e)}")

class BatchEnrichRequest(BaseModel):
    entity_names: List[str]
    entity_type: str = "incubator"

@app.post("/api/enrichment/batch-scrape")
def batch_enrich_entities(req: BatchEnrichRequest):
    try:
        from .enricher import enrich_entity_data
        results = []
        for name in req.entity_names[:15]: # Limit batch size to 15 for responsiveness
            if name.strip():
                res = enrich_entity_data(entity_name=name, entity_type=req.entity_type)
                results.append(res)
        return {"status": "success", "results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Incubator Cohort Evaluator Endpoints ---
class AddIncubatorsToEcosystemRequest(BaseModel):
    app_ids: List[str]
    all: bool

@app.post("/api/incubein/incubator/add-to-db")
def add_incubator_cohort_to_db(req: AddIncubatorsToEcosystemRequest):
    try:
        db = get_mongo_db()
        from bson import ObjectId
        import uuid
        
        query = {"entity_type": "incubator"}
        if not req.all:
            parsed_ids = []
            for aid in req.app_ids:
                try: parsed_ids.append(ObjectId(aid))
                except: pass
            query["_id"] = {"$in": parsed_ids}
            
        cursor = db["incubein_applications"].find(query)
        inserted_count = 0
        
        for doc in cursor:
            inc_name = doc.get("startup_name") or doc.get("name") or "Incubator Hub"
            existing = db["incubators"].find_one({"name": inc_name})
            if not existing:
                inc_id = f"inc_{uuid.uuid4().hex[:8]}"
                enc = doc.get("encrypted_fields", {})
                contact_email = decrypt_val(enc.get("email", "")) or doc.get("email") or f"contact@{inc_name.lower().replace(' ', '')[:15]}.org"
                
                inc_record = {
                    "id": inc_id,
                    "name": inc_name,
                    "type": doc.get("stage") or "Academic TBI",
                    "state": doc.get("city_state", "").split(",")[-1].strip() if "," in doc.get("city_state", "") else "Maharashtra",
                    "city": doc.get("city_state", "").split(",")[0].strip() if doc.get("city_state") else "Nagpur",
                    "email": contact_email,
                    "website": doc.get("website") or f"https://www.{inc_name.lower().replace(' ', '')[:15]}.org.in",
                    "focus_areas": doc.get("sector") or "DeepTech, AgriTech, CleanTech",
                    "startup_count": 10,
                    "active_startups": 8,
                    "confidence_score": doc.get("final_score", 85),
                    "status": "resolved"
                }
                db["incubators"].insert_one(inc_record)
                inserted_count += 1
                
        return {"status": "success", "message": f"Successfully imported {inserted_count} incubators into Ecosystem Directory."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 3-Month (90-Day) Incubation Nurture Loop API ---
class MilestoneRequest(BaseModel):
    lead_id: str
    milestone_title: str
    milestone_day: int # e.g. 7, 30, 60, 90
    meeting_date: str
    meeting_link: str = "Google Meet"
    notes: str = ""

@app.get("/api/lifecycle/nurture-loop/list")
def get_nurture_loop_entities():
    try:
        db = get_mongo_db()
        leads_cursor = db["outreach_leads"].find({}).sort("sent_at", -1)
        active_loops = []
        
        from datetime import datetime
        now = datetime.now()
        
        for doc in leads_cursor:
            doc["_id"] = str(doc["_id"])
            sent_str = doc.get("sent_at")
            days_elapsed = 0
            if sent_str:
                try:
                    sent_dt = datetime.fromisoformat(sent_str.replace("Z", "+00:00"))
                    days_elapsed = (now - sent_dt).days
                except:
                    days_elapsed = 15
            else:
                days_elapsed = 5
                
            days_remaining = max(0, 90 - days_elapsed)
            
            # Retrieve milestones/meetings for this lead
            meetings = list(db["scheduled_meetings"].find({"lead_id": doc["id"]}))
            milestones = []
            for m in meetings:
                milestones.append({
                    "id": str(m["_id"]),
                    "title": m.get("subject", "Milestone Check-in"),
                    "date": m.get("meeting_date", "Upcoming"),
                    "status": m.get("status", "Scheduled"),
                    "link": m.get("meeting_link", "Google Meet")
                })
                
            active_loops.append({
                "lead_id": doc["id"],
                "name": doc.get("incubator_name", "Ecosystem Lead"),
                "email": doc.get("email", ""),
                "status": doc.get("status", "Draft"),
                "days_elapsed": min(days_elapsed, 90),
                "days_remaining": days_remaining,
                "loop_progress_pct": min(100, int((days_elapsed / 90.0) * 100)),
                "contact_count": doc.get("contact_count", 1),
                "milestones": milestones,
                "notes": doc.get("notes", "")
            })
            
        return active_loops
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/lifecycle/nurture-loop/add-milestone")
def add_nurture_milestone(req: MilestoneRequest):
    try:
        db = get_mongo_db()
        from bson import ObjectId
        
        lead = db["outreach_leads"].find_one({"id": req.lead_id})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found.")
            
        meeting_doc = {
            "lead_id": req.lead_id,
            "incubator_name": lead.get("incubator_name"),
            "subject": f"Day {req.milestone_day} Incubation Milestone: {req.milestone_title}",
            "meeting_date": req.meeting_date,
            "meeting_time": "11:00 AM",
            "meeting_link": req.meeting_link,
            "status": "Scheduled",
            "notes": req.notes,
            "created_at": datetime.datetime.now().isoformat()
        }
        db["scheduled_meetings"].insert_one(meeting_doc)
        
        # Update lead notes
        new_note = f"[Day {req.milestone_day} Milestone Scheduled] {req.milestone_title} on {req.meeting_date}"
        existing_notes = lead.get("notes") or ""
        updated_notes = f"{existing_notes}\n{new_note}".strip()
        
        db["outreach_leads"].update_one(
            {"id": req.lead_id},
            {"$set": {"notes": updated_notes, "next_action_date": req.meeting_date}}
        )
        
        return {"status": "success", "message": f"Day {req.milestone_day} milestone scheduled successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Serve Built React Frontend (production / exe mode) ---
_static_dir = BASE_DIR / "static"
if _static_dir.exists() and _static_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_static_dir / "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_index():
        return FileResponse(str(_static_dir / "index.html"))

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        # Let API routes pass through; serve index.html for all frontend routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        file_path = _static_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(_static_dir / "index.html"))









