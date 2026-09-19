import sqlite3
import json
import os
import sys
import re
import threading
import pymongo
from datetime import datetime
from dotenv import load_dotenv

from .config import APP_DATA_DIR

load_dotenv()

# When running as a PyInstaller exe, store DB next to the .exe so data persists.
# In dev mode, keep it in the backend/ folder as before.
if getattr(sys, 'frozen', False):
    _data_dir = os.path.dirname(sys.executable)
else:
    _data_dir = str(APP_DATA_DIR)

DB_PATH = os.path.join(_data_dir, "ecosystem.db")
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")

_mongo_client = None

def get_mongo_client():
    global _mongo_client
    if _mongo_client is None:
        # Fail fast when MongoDB is unreachable instead of hanging for ~30s.
        _mongo_client = pymongo.MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
    return _mongo_client

def get_mongo_db():
    client = get_mongo_client()
    return client.get_database("ecosystem")

class MongoRow:
    def __init__(self, data, keys=None):
        if isinstance(data, MongoRow):
            self._data = dict(data._data)
            self._keys = list(data._keys)
        elif isinstance(data, dict):
            self._data = {k: v for k, v in data.items() if k != "_id"}
            if keys:
                self._keys = [k for k in keys if k != "_id"]
            else:
                self._keys = list(self._data.keys())
        else:
            self._data = {}
            self._keys = []
        
    def __getitem__(self, key):
        if isinstance(key, int):
            if 0 <= key < len(self._keys):
                return self._data.get(self._keys[key])
            vals = list(self._data.values())
            if 0 <= key < len(vals):
                return vals[key]
            return None
        return self._data.get(key)
        
    def get(self, key, default=None):
        return self._data.get(key, default)
        
    def keys(self):
        return self._keys
        
    def __iter__(self):
        return iter(self._data.keys())
        
    def items(self):
        return self._data.items()

def parse_simple_condition(cond_str, params):
    cond_str = cond_str.strip()
    if not cond_str:
        return {}
        
    # Check IS NOT NULL / IS NULL
    if "IS NOT NULL" in cond_str.upper():
        field = cond_str.upper().split("IS NOT NULL")[0].strip().lower()
        return {field: {"$ne": None}}
    if "IS NULL" in cond_str.upper():
        field = cond_str.upper().split("IS NULL")[0].strip().lower()
        return {field: None}
        
    # Check NOT IN subquery specifically for relationships duplicate cleanup
    if "NOT IN" in cond_str.upper():
        parts = re.split(r"\s+NOT\s+IN\s+", cond_str, flags=re.IGNORECASE)
        field = parts[0].strip().lower()
        right = parts[1].strip()
        if "SELECT" in right.upper() and "relationships" in right.lower():
            db = get_mongo_db()
            pipeline = [
                {"$group": {
                    "_id": {
                        "source_id": "$source_id",
                        "source_type": "$source_type",
                        "target_id": "$target_id",
                        "target_type": "$target_type",
                        "relationship_type": "$relationship_type"
                    },
                    "min_id": {"$min": "$id"}
                }}
            ]
            groups = list(db["relationships"].aggregate(pipeline))
            min_ids = [g["min_id"] for g in groups if g["min_id"] is not None]
            return {field: {"$nin": min_ids}}
        else:
            list_str = right.strip("() ")
            if "?" in list_str:
                values = params
            else:
                values = [v.strip().strip("'\"") for v in list_str.split(",")]
            return {field: {"$nin": values}}
            
    # Check IN
    if " IN " in cond_str.upper():
        parts = re.split(r"\s+IN\s+", cond_str, flags=re.IGNORECASE)
        field = parts[0].strip().lower()
        list_str = parts[1].strip("() ")
        if "?" in list_str:
            values = params
        else:
            values = [v.strip().strip("'\"") for v in list_str.split(",")]
        return {field: {"$in": values}}
        
    # Standard operators: !=, =, LIKE
    operator = None
    for op in ["!=", "=", "LIKE"]:
        if f" {op} " in cond_str.upper() or cond_str.upper().endswith(f" {op} ?") or f"{op}?" in cond_str:
            operator = op
            break
    if not operator and "=" in cond_str:
        operator = "="
        
    if operator:
        parts = cond_str.split(operator, 1)
        field = parts[0].strip().lower()
        val_str = parts[1].strip()
        
        if val_str == "?":
            value = params[0] if params else None
        else:
            value = val_str.strip("'\"")
            
        if operator == "=":
            return {field: value}
        elif operator == "!=":
            return {field: {"$ne": value}}
        elif operator == "LIKE":
            if isinstance(value, str):
                cleaned_val = value.replace("%", "")
                return {field: {"$regex": re.escape(cleaned_val), "$options": "i"}}
            return {field: value}
            
    return {}

def parse_where_clause(where_str, where_params):
    if not where_str:
        return {}
    where_str = where_str.strip()
    if where_str.upper() == "1=1":
        return {}
        
    filter_doc = {}
    param_idx = 0
    
    # Split by AND at the top level, respecting parenthesis
    clauses = []
    current_clause = []
    paren_depth = 0
    words = re.split(r"(\s+)", where_str)
    
    for w in words:
        if "(" in w:
            paren_depth += w.count("(")
        if ")" in w:
            paren_depth += w.count(")")
            
        if paren_depth == 0 and w.upper() == "AND":
            clauses.append("".join(current_clause).strip())
            current_clause = []
        else:
            current_clause.append(w)
    if current_clause:
        clauses.append("".join(current_clause).strip())
        
    for clause in clauses:
        clause = clause.strip()
        if not clause or clause.upper() == "1=1":
            continue
            
        if clause.startswith("(") and clause.endswith(")"):
            inner = clause[1:-1].strip()
            # Split by OR
            or_parts = re.split(r"\s+OR\s+", inner, flags=re.IGNORECASE)
            or_filters = []
            for part in or_parts:
                part_placeholder_count = part.count("?")
                part_params = where_params[param_idx : param_idx + part_placeholder_count]
                param_idx += part_placeholder_count
                
                sub_filter = parse_simple_condition(part, part_params)
                if sub_filter:
                    or_filters.append(sub_filter)
            if or_filters:
                if "$or" not in filter_doc:
                    filter_doc["$or"] = []
                filter_doc["$or"].extend(or_filters)
        else:
            if " OR " in clause.upper():
                or_parts = re.split(r"\s+OR\s+", clause, flags=re.IGNORECASE)
                or_filters = []
                for part in or_parts:
                    part_placeholder_count = part.count("?")
                    part_params = where_params[param_idx : param_idx + part_placeholder_count]
                    param_idx += part_placeholder_count
                    
                    sub_filter = parse_simple_condition(part, part_params)
                    if sub_filter:
                        or_filters.append(sub_filter)
                if or_filters:
                    if "$or" not in filter_doc:
                        filter_doc["$or"] = []
                    filter_doc["$or"].extend(or_filters)
            else:
                part_placeholder_count = clause.count("?")
                part_params = where_params[param_idx : param_idx + part_placeholder_count]
                param_idx += part_placeholder_count
                
                sub_filter = parse_simple_condition(clause, part_params)
                if sub_filter:
                    filter_doc.update(sub_filter)
                
    return filter_doc

class MongoCursor:
    def __init__(self, db):
        self.db = db
        self.results = []
        self.current_idx = 0
        self.description = None
        self.rowcount = -1
        
    def execute(self, sql, params=None):
        if params is None:
            params = []
        if not isinstance(params, (list, tuple)):
            params = [params]
            
        sql_clean = " ".join(sql.split()).strip()
        
        # Intercept GROUP BY queries generically for MongoDB
        group_match = re.search(r"SELECT\s+(.*?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*?))?\s+GROUP\s+BY\s+(\w+)", sql_clean, re.IGNORECASE)
        if group_match:
            table_name = group_match.group(2).strip()
            where_str = group_match.group(3).strip() if group_match.group(3) else ""
            group_field = group_match.group(4).strip().lower()
            
            filter_doc = parse_where_clause(where_str, params) if where_str else {}
            if group_field not in filter_doc:
                filter_doc[group_field] = {"$ne": None, "$not": {"$regex": "^$"}}
            
            limit_match = re.search(r"LIMIT\s+(\d+)", sql_clean, re.IGNORECASE)
            limit_val = int(limit_match.group(1)) if limit_match else None
            
            pipeline = [
                {"$match": filter_doc},
                {"$group": {"_id": f"${group_field}", "count": {"$sum": 1}}},
                {"$project": {group_field: "$_id", "count": 1, "_id": 0}},
                {"$sort": {"count": -1}}
            ]
            if limit_val:
                pipeline.append({"$limit": limit_val})
                
            raw_res = list(self.db[table_name].aggregate(pipeline))
            self.results = [MongoRow(r, [group_field, "count"]) for r in raw_res]
            self.current_idx = 0
            self.rowcount = len(self.results)
            return self

        if "LEFT JOIN outreach_leads" in sql_clean:
            pipeline = [
                {
                    "$lookup": {
                        "from": "outreach_leads",
                        "localField": "lead_id",
                        "foreignField": "id",
                        "as": "lead"
                    }
                },
                {
                    "$unwind": {
                        "path": "$lead",
                        "preserveNullAndEmptyArrays": True
                    }
                },
                {
                    "$project": {
                        "id": 1,
                        "lead_id": 1,
                        "incubator_name": 1,
                        "title": 1,
                        "date": 1,
                        "time": 1,
                        "calendar_event_id": 1,
                        "status": 1,
                        "meeting_link": "$lead.meeting_link",
                        "incubator_id": "$lead.incubator_id"
                    }
                }
            ]
            raw_res = list(self.db["scheduled_meetings"].aggregate(pipeline))
            keys = ["id", "lead_id", "incubator_name", "title", "date", "time", "calendar_event_id", "status", "meeting_link", "incubator_id"]
            self.results = [MongoRow(r, keys) for r in raw_res]
            self.current_idx = 0
            self.rowcount = len(self.results)
            return self

        if " UNION " in sql_clean.upper():
            subqueries = re.split(r"\s+UNION\s+", sql_clean, flags=re.IGNORECASE)
            all_raw = []
            for sub in subqueries:
                temp_cursor = MongoCursor(self.db)
                temp_cursor.execute(sub, params)
                all_raw.extend([r._data for r in temp_cursor.results])
            seen = set()
            unique_raw = []
            for r in all_raw:
                r_str = json.dumps(r, sort_keys=True)
                if r_str not in seen:
                    seen.add(r_str)
                    unique_raw.append(r)
            keys = list(unique_raw[0].keys()) if unique_raw else []
            self.results = [MongoRow(r, keys) for r in unique_raw]
            self.current_idx = 0
            self.rowcount = len(self.results)
            return self
            
        if sql_clean.upper().startswith("CREATE") or sql_clean.upper().startswith("ALTER") or sql_clean.upper().startswith("PRAGMA"):
            self.results = []
            self.current_idx = 0
            self.rowcount = 0
            return self
            
        elif sql_clean.upper().startswith("INSERT"):
            insert_match = re.match(r"INSERT\s+INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*?)\)", sql_clean, re.IGNORECASE)
            if insert_match:
                table_name = insert_match.group(1).strip()
                cols_str = insert_match.group(2)
                cols = [c.strip() for c in cols_str.split(",")]
                doc = {}
                for col, val in zip(cols, params):
                    if col in ["incubation_programs", "acceleration_programs", "lab_facilities", "focus_areas", "founders", "expertise", "investment_stage", "portfolio_startups"] and isinstance(val, str) and (val.startswith("[") or val.startswith("{")):
                        try:
                            val = json.loads(val)
                        except:
                            pass
                    doc[col] = val
                if table_name in ["pipeline_logs", "relationships"] and "id" not in doc:
                    max_doc = self.db[table_name].find_one(sort=[("id", -1)])
                    doc["id"] = (max_doc["id"] + 1) if max_doc else 1
                self.db[table_name].insert_one(doc)
            self.results = []
            self.current_idx = 0
            self.rowcount = 1
            return self
            
        elif sql_clean.upper().startswith("UPDATE"):
            update_match = re.match(r"UPDATE\s+(\w+)\s+SET\s+(.*?)(?:\s+WHERE\s+(.*))?$", sql_clean, re.IGNORECASE | re.DOTALL)
            if update_match:
                table_name = update_match.group(1).strip()
                set_str = update_match.group(2).strip()
                where_str = update_match.group(3).strip() if update_match.group(3) else ""
                
                set_placeholder_count = set_str.count('?')
                set_params = params[:set_placeholder_count]
                where_params = params[set_placeholder_count:]
                
                # Split by comma but respect parentheses
                set_clauses = []
                current_clause = []
                paren_depth = 0
                for char in set_str:
                    if char == '(':
                        paren_depth += 1
                    elif char == ')':
                        paren_depth -= 1
                    
                    if char == ',' and paren_depth == 0:
                        set_clauses.append("".join(current_clause).strip())
                        current_clause = []
                    else:
                        current_clause.append(char)
                if current_clause:
                    set_clauses.append("".join(current_clause).strip())

                update_doc = {}
                inc_doc = {}
                param_idx = 0
                for clause in set_clauses:
                    if "=" in clause:
                        k, v = clause.split("=", 1)
                        k = k.strip()
                        v = v.strip()
                        if "coalesce(" in v.lower() and "+ 1" in v.lower():
                            inc_doc[k] = 1
                        elif v == "?":
                            val = set_params[param_idx]
                            if k in ["incubation_programs", "acceleration_programs", "lab_facilities", "focus_areas", "founders", "expertise", "investment_stage", "portfolio_startups"] and isinstance(val, str) and (val.startswith("[") or val.startswith("{")):
                                try:
                                    val = json.loads(val)
                                except:
                                    pass
                            update_doc[k] = val
                            param_idx += 1
                        else:
                            update_doc[k] = v.strip("'").strip('"')
                            
                filter_doc = parse_where_clause(where_str, where_params)
                update_op = {}
                if update_doc:
                    update_op["$set"] = update_doc
                if inc_doc:
                    update_op["$inc"] = inc_doc
                if update_op:
                    self.db[table_name].update_many(filter_doc, update_op)
            self.results = []
            self.current_idx = 0
            self.rowcount = 1
            return self
            
        elif sql_clean.upper().startswith("DELETE"):
            delete_match = re.match(r"DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*))?$", sql_clean, re.IGNORECASE | re.DOTALL)
            if delete_match:
                table_name = delete_match.group(1).strip()
                where_str = delete_match.group(2).strip() if delete_match.group(2) else ""
                filter_doc = parse_where_clause(where_str, params)
                self.db[table_name].delete_many(filter_doc)
            self.results = []
            self.current_idx = 0
            self.rowcount = 1
            return self
            
        elif sql_clean.upper().startswith("SELECT"):
            limit_val = None
            limit_match = re.search(r"LIMIT\s+(\d+)", sql_clean, re.IGNORECASE)
            if limit_match:
                limit_val = int(limit_match.group(1))
                sql_clean = re.sub(r"LIMIT\s+\d+", "", sql_clean, flags=re.IGNORECASE)
                
            sort_clauses = []
            sort_match = re.search(r"ORDER\s+BY\s+(.*?)$", sql_clean, re.IGNORECASE | re.DOTALL)
            if sort_match:
                sort_str = sort_match.group(1).strip()
                for part in sort_str.split(","):
                    part = part.strip()
                    if not part:
                        continue
                    if " DESC" in part.upper():
                        field = re.sub(r"\s+DESC", "", part, flags=re.IGNORECASE).strip().lower()
                        sort_clauses.append((field, pymongo.DESCENDING))
                    else:
                        field = re.sub(r"\s+ASC", "", part, flags=re.IGNORECASE).strip().lower()
                        sort_clauses.append((field, pymongo.ASCENDING))
                sql_clean = re.sub(r"ORDER\s+BY\s+.*$", "", sql_clean, flags=re.IGNORECASE | re.DOTALL)
                
            select_match = re.match(r"SELECT\s+(.*?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*))?$", sql_clean, re.IGNORECASE | re.DOTALL)
            if select_match:
                fields_str = select_match.group(1).strip()
                table_name = select_match.group(2).strip()
                where_str = select_match.group(3).strip() if select_match.group(3) else ""
                
                filter_doc = parse_where_clause(where_str, params)
                
                if "COUNT" in fields_str.upper():
                    distinct_match = re.search(r"COUNT\(\s*DISTINCT\s+(\w+)\s*\)", fields_str, re.IGNORECASE)
                    if distinct_match:
                        field_name = distinct_match.group(1).strip().lower()
                        distinct_vals = self.db[table_name].distinct(field_name, filter_doc)
                        count = len(distinct_vals)
                    else:
                        count = self.db[table_name].count_documents(filter_doc)
                    self.results = [MongoRow({fields_str: count}, [fields_str])]
                    self.current_idx = 0
                    self.rowcount = 1
                    return self
                    
                is_distinct = False
                if fields_str.upper().startswith("DISTINCT "):
                    is_distinct = True
                    fields_str = fields_str[9:].strip()
                    
                if is_distinct:
                    vals = self.db[table_name].distinct(fields_str.lower(), filter_doc)
                    self.results = [MongoRow({fields_str.lower(): v}, [fields_str.lower()]) for v in vals]
                    self.current_idx = 0
                    self.rowcount = len(self.results)
                    return self
                    
                projection = None
                if fields_str != "*":
                    projection = {f.strip().lower(): 1 for f in fields_str.split(",")}
                    projection["_id"] = 0
                    
                cursor = self.db[table_name].find(filter_doc, projection)
                if sort_clauses:
                    cursor = cursor.sort(sort_clauses)
                if limit_val:
                    cursor = cursor.limit(limit_val)
                    
                raw_docs = list(cursor)
                if raw_docs:
                    keys = list(raw_docs[0].keys())
                else:
                    keys = [f.strip().lower() for f in fields_str.split(",")] if fields_str != "*" else []
                    
                # De-serialize arrays/dicts back to JSON strings for SQLite compatibility
                for doc in raw_docs:
                    for k, v in doc.items():
                        if isinstance(v, (list, dict)):
                            doc[k] = json.dumps(v)
                            
                self.results = [MongoRow(doc, keys) for doc in raw_docs]
                self.current_idx = 0
                self.rowcount = len(self.results)
                return self
                
        return self
        
    def fetchone(self):
        if self.current_idx < len(self.results):
            row = self.results[self.current_idx]
            self.current_idx += 1
            return row
        return None
        
    def fetchall(self):
        res = self.results[self.current_idx:]
        self.current_idx = len(self.results)
        return res
        
    def __iter__(self):
        return self
        
    def __next__(self):
        row = self.fetchone()
        if row is None:
            raise StopIteration
        return row

class MongoConnection:
    def __init__(self, db):
        self.db = db
        
    def cursor(self):
        return MongoCursor(self.db)
        
    def commit(self):
        pass
        
    def close(self):
        pass
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

def get_db_connection():
    db = get_mongo_db()
    return MongoConnection(db)

INDEXES = {
    # Outreach pipeline
    "outreach_leads": [
        [("id", 1), {"unique": True}],
        [("incubator_id", 1)],
        [("incubator_name", 1)],
        [("status", 1)],
        [("email", 1)],
        [("reply_detected_at", -1)],
        [("sent_at", -1)],
        [("last_followup_at", -1)],
    ],
    "outreach_activity": [
        [("lead_id", 1)],
        [("created_at", -1)],
        [("activity_type", 1)],
        [("meeting_id", 1)],
    ],
    "scheduled_meetings": [
        [("lead_id", 1)],
        [("date", -1)],
        [("status", 1)],
    ],
    # CRM core + execution
    "crm_startups": [
        [("id", 1), {"unique": True}],
        [("name", 1)],
        [("source_ref", 1)],
        [("sector", 1)],
        [("stage", 1)],
    ],
    "crm_action_plans": [
        [("id", 1), {"unique": True}],
        [("startup_id", 1)],
    ],
    "crm_actions": [
        [("id", 1)],
        [("startup_id", 1)],
        [("plan_id", 1)],
        [("deadline", 1)],
    ],
    "crm_milestones": [
        [("id", 1)],
        [("startup_id", 1)],
        [("plan_id", 1)],
        [("target_date", 1)],
    ],
    "crm_risks": [
        [("id", 1)],
        [("startup_id", 1)],
        [("plan_id", 1)],
        [("action_id", 1)],
    ],
    "crm_audits": [
        [("id", 1)],
        [("startup_id", 1)],
        [("audit_date", -1)],
    ],
    "crm_founders": [
        [("id", 1)],
        [("startup_id", 1)],
        [("name", 1)],
        [("source_ref", 1)],
    ],
    "crm_activity": [
        [("module", 1), ("record_id", 1)],
        [("created_at", -1)],
    ],
    "crm_students": [
        [("id", 1)],
        [("college_id", 1)],
        [("student_name", 1)],
        [("source_ref", 1)],
    ],
    "crm_colleges": [
        [("id", 1)],
        [("name", 1)],
        [("source_ref", 1)],
    ],
    "crm_funding": [
        [("id", 1)],
        [("startup_id", 1)],
    ],
    "crm_customers": [
        [("id", 1)],
        [("startup_id", 1)],
    ],
    "crm_deals": [
        [("id", 1)],
        [("startup_id", 1)],
    ],
    "crm_financials": [
        [("id", 1)],
        [("startup_id", 1)],
    ],
}


def ensure_indexes(db):
    """Idempotently build the indexes the hot query paths rely on."""
    for collection, specs in INDEXES.items():
        for spec in specs:
            # spec is either [("field", 1)] or [("field", 1), {"unique": True}]
            if len(spec) == 2 and isinstance(spec[-1], dict):
                keys, options = [spec[0]], spec[-1]
            else:
                keys, options = list(spec), {}
            try:
                db[collection].create_index(keys, **options)
            except Exception as e:
                print(f"Index build skipped for {collection}{keys}: {e}")


def init_db():
    client = get_mongo_client()
    db = client.get_database("ecosystem")

    # Build indexes in the background so the server binds immediately even when
    # a production collection is large and create_index is slow.
    def _build_indexes():
        ensure_indexes(db)
        log_pipeline_step("SYSTEM", "SUCCESS", "Ecosystem MongoDB indexes ensured.")

    threading.Thread(target=_build_indexes, daemon=True).start()
    
    log_pipeline_step("SYSTEM", "SUCCESS", "Ecosystem MongoDB collections initialized successfully.")

def log_pipeline_step(stage, status, message):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO pipeline_logs (timestamp, stage, status, message) VALUES (?, ?, ?, ?)",
        (datetime.now().isoformat(), stage, status, message)
    )

def get_pipeline_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pipeline_logs ORDER BY id DESC LIMIT 100")
    logs = [dict(row) for row in cursor.fetchall()]
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

init_db()
