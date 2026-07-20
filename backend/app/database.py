import sqlite3
import json
import os
import re
import pymongo
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ecosystem.db")
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")

_mongo_client = None

def get_mongo_client():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = pymongo.MongoClient(MONGO_URI)
    return _mongo_client

def get_mongo_db():
    client = get_mongo_client()
    return client.get_database("ecosystem")

class MongoRow:
    def __init__(self, data, keys):
        self._data = {k: v for k, v in data.items() if k != "_id"}
        self._keys = [k for k in keys if k != "_id"]
        
    def __getitem__(self, key):
        if isinstance(key, int):
            if key < len(self._keys):
                return self._data.get(self._keys[key])
            raise IndexError("row index out of range")
        return self._data.get(key)
        
    def keys(self):
        return self._keys
        
    def __iter__(self):
        return iter(self._data.values())
        
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
        
        # Intercept custom aggregations / Joins
        if "GROUP BY state" in sql_clean:
            pipeline = [
                {"$match": {"state": {"$ne": None, "$not": {"$regex": "^$"}}}},
                {"$group": {"_id": "$state", "count": {"$sum": 1}}},
                {"$project": {"state": "$_id", "count": 1, "_id": 0}},
                {"$sort": {"count": -1}}
            ]
            raw_res = list(self.db["incubators"].aggregate(pipeline))
            self.results = [MongoRow(r, ["state", "count"]) for r in raw_res]
            self.current_idx = 0
            self.rowcount = len(self.results)
            return self
            
        if "GROUP BY city" in sql_clean:
            pipeline = [
                {"$match": {"city": {"$ne": None, "$not": {"$regex": "^$"}}}},
                {"$group": {"_id": "$city", "count": {"$sum": 1}}},
                {"$project": {"city": "$_id", "count": 1, "_id": 0}},
                {"$sort": {"count": -1}},
                {"$limit": 8}
            ]
            raw_res = list(self.db["incubators"].aggregate(pipeline))
            self.results = [MongoRow(r, ["city", "count"]) for r in raw_res]
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
                        "meeting_link": "$lead.meeting_link"
                    }
                }
            ]
            raw_res = list(self.db["scheduled_meetings"].aggregate(pipeline))
            keys = ["id", "lead_id", "incubator_name", "title", "date", "time", "calendar_event_id", "status", "meeting_link"]
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
                
                set_clauses = [s.strip() for s in set_str.split(",")]
                update_doc = {}
                param_idx = 0
                for clause in set_clauses:
                    if "=" in clause:
                        k, v = clause.split("=", 1)
                        k = k.strip()
                        v = v.strip()
                        if v == "?":
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
                self.db[table_name].update_many(filter_doc, {"$set": update_doc})
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

def init_db():
    client = get_mongo_client()
    db = client.get_database("ecosystem")
    
    # Automatic Migration from SQLite
    sqlite_db_exists = os.path.exists(DB_PATH)
    if sqlite_db_exists:
        if db["incubators"].count_documents({}) == 0:
            print("MongoDB is empty. Migrating data from SQLite...")
            sqlite_conn = sqlite3.connect(DB_PATH)
            sqlite_conn.row_factory = sqlite3.Row
            sqlite_cursor = sqlite_conn.cursor()
            
            tables = [
                "incubators", "startups", "mentors", "investors", 
                "relationships", "pipeline_logs", "outreach_leads", 
                "scheduled_meetings"
            ]
            for table in tables:
                try:
                    sqlite_cursor.execute(f"SELECT * FROM {table}")
                    rows = [dict(r) for r in sqlite_cursor.fetchall()]
                    if rows:
                        list_cols = ["incubation_programs", "acceleration_programs", "lab_facilities", "focus_areas", "founders", "expertise", "investment_stage", "portfolio_startups"]
                        for r in rows:
                            for c in list_cols:
                                if c in r and isinstance(r[c], str) and (r[c].startswith("[") or r[c].startswith("{")):
                                    try:
                                        r[c] = json.loads(r[c])
                                    except:
                                        pass
                        print(f"Migrating {len(rows)} records into MongoDB collection '{table}'...")
                        db[table].insert_many(rows)
                except sqlite3.OperationalError as e:
                    print(f"Table '{table}' does not exist in SQLite, skipping: {e}")
            sqlite_conn.close()
            print("Automatic migration to MongoDB complete!")
            
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
