import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ecosystem.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
    except:
        pass
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create Incubators table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incubators (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            organization_type TEXT,
            year_established INTEGER,
            website TEXT,
            email TEXT,
            phone TEXT,
            linkedin TEXT,
            twitter TEXT,
            founder_or_head TEXT,
            address TEXT,
            city TEXT,
            state TEXT,
            country TEXT DEFAULT 'India',
            postal_code TEXT,
            latitude REAL,
            longitude REAL,
            incubation_programs TEXT, -- JSON array
            acceleration_programs TEXT, -- JSON array
            funding_support TEXT,
            equity_model TEXT,
            grant_support TEXT,
            mentorship_available INTEGER DEFAULT 1, -- boolean 0/1
            coworking_available INTEGER DEFAULT 1, -- boolean 0/1
            lab_facilities TEXT, -- JSON array
            duration TEXT,
            focus_areas TEXT, -- JSON array
            startup_count INTEGER DEFAULT 0,
            active_startups INTEGER DEFAULT 0,
            confidence_score REAL DEFAULT 1.0,
            status TEXT DEFAULT 'raw', -- 'raw', 'cleaned', 'resolved', 'enriched'
            last_updated TEXT,
            source_url TEXT
        )
    ''')

    # Create Startups table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS startups (
            id TEXT PRIMARY KEY,
            startup_name TEXT NOT NULL,
            sector TEXT,
            founders TEXT, -- JSON array
            website TEXT,
            funding_stage TEXT,
            hq_city TEXT,
            incubated_at TEXT, -- incubator name reference
            incubator_id TEXT, -- incubator foreign key
            confidence_score REAL DEFAULT 1.0,
            status TEXT DEFAULT 'raw', -- 'raw', 'cleaned', 'resolved', 'enriched'
            last_updated TEXT,
            source_url TEXT,
            FOREIGN KEY (incubator_id) REFERENCES incubators(id)
        )
    ''')

    # Create Mentors table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mentors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            linkedin TEXT,
            expertise TEXT, -- JSON array
            incubator_id TEXT,
            FOREIGN KEY (incubator_id) REFERENCES incubators(id)
        )
    ''')

    # Create Investors table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS investors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT, -- 'Angel', 'VC', 'Government Scheme', etc.
            email TEXT,
            linkedin TEXT,
            investment_stage TEXT, -- JSON array
            portfolio_startups TEXT -- JSON array
        )
    ''')

    # Create Relationships table (Graph Edges)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id TEXT NOT NULL,
            source_type TEXT NOT NULL, -- 'Incubator', 'Startup', 'Founder', 'Investor', 'Mentor', etc.
            target_id TEXT NOT NULL,
            target_type TEXT NOT NULL,
            relationship_type TEXT NOT NULL, -- 'INCUBATED', 'FUNDED', 'MENTORED', 'AFFILIATED_WITH', etc.
            confidence_score REAL DEFAULT 1.0,
            metadata TEXT -- JSON object
        )
    ''')

    # Create Logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pipeline_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            stage TEXT NOT NULL, -- 'SCRAPE', 'CLEAN', 'RESOLVE', 'ENRICH'
            status TEXT NOT NULL, -- 'START', 'SUCCESS', 'ERROR'
            message TEXT
        )
    ''')

    # Create Outreach Leads table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS outreach_leads (
            id TEXT PRIMARY KEY,
            incubator_id TEXT,
            incubator_name TEXT NOT NULL,
            email TEXT,
            status TEXT DEFAULT 'Draft', -- 'Draft', 'Sent', 'Replied', 'Meeting Scheduled', 'Not Interested'
            sent_at TEXT,
            reply_text TEXT,
            reply_detected_at TEXT,
            intent_classification TEXT, -- 'Positive', 'Neutral', 'Negative', 'Information Request'
            lead_score INTEGER DEFAULT 0,
            meeting_link TEXT,
            meeting_scheduled_at TEXT,
            notes TEXT,
            FOREIGN KEY (incubator_id) REFERENCES incubators(id)
        )
    ''')

    # Create Scheduled Meetings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scheduled_meetings (
            id TEXT PRIMARY KEY,
            lead_id TEXT,
            incubator_name TEXT NOT NULL,
            title TEXT NOT NULL,
            date TEXT,
            time TEXT,
            calendar_event_id TEXT,
            status TEXT DEFAULT 'Scheduled',
            FOREIGN KEY (lead_id) REFERENCES outreach_leads(id)
        )
    ''')

    # Migration for existing databases: ensure notes column exists
    try:
        cursor.execute("ALTER TABLE outreach_leads ADD COLUMN notes TEXT")
    except sqlite3.OperationalError:
        pass # Column already exists

    conn.commit()
    conn.close()

def log_pipeline_step(stage, status, message):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO pipeline_logs (timestamp, stage, status, message) VALUES (?, ?, ?, ?)",
        (datetime.now().isoformat(), stage, status, message)
    )
    conn.commit()
    conn.close()

def get_pipeline_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pipeline_logs ORDER BY id DESC LIMIT 100")
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs

def clear_all_tables():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM incubators")
    cursor.execute("DELETE FROM startups")
    cursor.execute("DELETE FROM mentors")
    cursor.execute("DELETE FROM investors")
    cursor.execute("DELETE FROM relationships")
    cursor.execute("DELETE FROM pipeline_logs")
    cursor.execute("DELETE FROM outreach_leads")
    cursor.execute("DELETE FROM scheduled_meetings")
    conn.commit()
    conn.close()

# Initialize when imported
init_db()
