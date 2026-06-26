import json
from datetime import datetime
from .database import get_db_connection, log_pipeline_step

def get_tokens(text):
    if not text:
        return set()
    # Lowercase and clean special chars
    text_clean = "".join(c if c.isalnum() or c.isspace() else " " for c in text.lower())
    # Split tokens and filter stop words
    stop_words = {"for", "and", "the", "of", "in", "at", "on", "with", "a", "an"}
    return {w for w in text_clean.split() if w and w not in stop_words}

def jaccard_similarity(s1, s2):
    t1 = get_tokens(s1)
    t2 = get_tokens(s2)
    if not t1 or not t2:
        return 0.0
    return len(t1.intersection(t2)) / len(t1.union(t2))

def is_subsequence(sub, main):
    if not sub or not main:
        return False
    sub_idx = 0
    for char in main:
        if sub_idx < len(sub) and char == sub[sub_idx]:
            sub_idx += 1
    return sub_idx == len(sub)

def get_initials_sequence(text):
    if not text:
        return ""
    words = text.upper().split()
    seq = []
    for w in words:
        w_clean = "".join(c for c in w if c.isalpha())
        if not w_clean:
            continue
        seq.append(w_clean[0])
        if w_clean.lower() == "and":
            seq.append("N")
    return "".join(seq)

def clean_short_name(name):
    exclusions = {
        "CO", "COM", "IN", "IIT", "IIM", "NIT", "IIIT", "CELL", "RESEARCH", "PARK",
        "BOMBAY", "MUMBAI", "BANGALORE", "BENGALURU", "CHENNAI", "MADRAS", "AHMEDABAD",
        "PUNE", "DELHI", "NOIDA", "GURGAON", "GURUGRAM", "CAMPUS", "UNIVERSITY"
    }
    words = name.upper().split()
    cleaned_words = []
    for w in words:
        w_clean = "".join(c for c in w if c.isalpha())
        if w_clean in exclusions:
            continue
        if w_clean:
            cleaned_words.append(w_clean)
    return "".join(cleaned_words) if cleaned_words else "".join(c for c in name.upper() if c.isalpha())

def is_acronym_match(name1, name2):
    w1, w2 = name1.split(), name2.split()
    if len(w1) == len(w2):
        return False
    if len(w1) < len(w2):
        short_name, long_name = name1, name2
    else:
        short_name, long_name = name2, name1
        
    short_clean = clean_short_name(short_name)
    if len(short_clean) < 2 or len(short_clean) > 8:
        return False
        
    long_seq = get_initials_sequence(long_name)
    return is_subsequence(short_clean, long_seq)


def calculate_similarity(name1, name2):
    # If exact match after cleaning
    clean1 = "".join(c for c in name1.lower() if c.isalnum())
    clean2 = "".join(c for c in name2.lower() if c.isalnum())
    if clean1 == clean2:
        return 1.0
        
    jaccard = jaccard_similarity(name1, name2)
    acronym = 0.8 if is_acronym_match(name1, name2) else 0.0
    
    # We can also check if one is a substring of the other
    substring = 0.0
    if len(name1) > 4 and len(name2) > 4:
        if name1.lower() in name2.lower() or name2.lower() in name1.lower():
            substring = 0.6
            
    return max(jaccard, acronym, substring)

def merge_incubator_records(canon, dupe):
    """Combines two incubator records. Returns the merged dictionary."""
    merged = dict(canon)
    
    # Fill in missing fields from duplicate
    for key in canon.keys():
        if not merged[key] and dupe[key]:
            merged[key] = dupe[key]
            
    # Append alias or merge description
    aliases = []
    if "Also known as:" in str(canon["description"]):
        pass
    else:
        aliases.append(dupe["name"])
        
    if aliases:
        merged["description"] = merged["description"] + f" (Also known as: {', '.join(aliases)})"
        
    # Standardize focus areas
    try:
        f1 = set(json.loads(canon["focus_areas"]) if canon["focus_areas"] else [])
        f2 = set(json.loads(dupe["focus_areas"]) if dupe["focus_areas"] else [])
        merged["focus_areas"] = json.dumps(list(f1.union(f2)))
    except:
        pass
        
    try:
        p1 = set(json.loads(canon["incubation_programs"]) if canon["incubation_programs"] else [])
        p2 = set(json.loads(dupe["incubation_programs"]) if dupe["incubation_programs"] else [])
        merged["incubation_programs"] = json.dumps(list(p1.union(p2)))
    except:
        pass

    try:
        l1 = set(json.loads(canon["lab_facilities"]) if canon["lab_facilities"] else [])
        l2 = set(json.loads(dupe["lab_facilities"]) if dupe["lab_facilities"] else [])
        merged["lab_facilities"] = json.dumps(list(l1.union(l2)))
    except:
        pass
        
    merged["confidence_score"] = min(0.99, max(canon["confidence_score"], dupe["confidence_score"]) + 0.1)
    merged["status"] = "resolved"
    merged["last_updated"] = datetime.now().isoformat()
    return merged

def merge_startup_records(canon, dupe):
    merged = dict(canon)
    for key in canon.keys():
        if not merged[key] and dupe[key]:
            merged[key] = dupe[key]
    merged["confidence_score"] = min(0.99, max(canon["confidence_score"], dupe["confidence_score"]) + 0.05)
    merged["status"] = "resolved"
    merged["last_updated"] = datetime.now().isoformat()
    return merged

def run_resolution_pipeline():
    log_pipeline_step("RESOLVE", "START", "Starting entity resolution and deduplication...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Resolve Incubators
        cursor.execute("SELECT * FROM incubators")
        incubators = [dict(row) for row in cursor.fetchall()]
        
        inc_duplicates = []
        resolved_inc_ids = set()
        
        for i in range(len(incubators)):
            for j in range(i + 1, len(incubators)):
                inc1 = incubators[i]
                inc2 = incubators[j]
                
                if inc1["id"] in resolved_inc_ids or inc2["id"] in resolved_inc_ids:
                    continue
                    
                sim = calculate_similarity(inc1["name"], inc2["name"])
                
                # Prevent merging if they are in different cities/states or have different sources
                city1, city2 = (inc1["city"] or "").strip().lower(), (inc2["city"] or "").strip().lower()
                state1, state2 = (inc1["state"] or "").strip().lower(), (inc2["state"] or "").strip().lower()
                src1, src2 = (inc1["source_url"] or "").strip().lower(), (inc2["source_url"] or "").strip().lower()
                
                if city1 and city2 and city1 != city2:
                    if city1 not in city2 and city2 not in city1:
                        sim = 0.0
                if state1 and state2 and state1 != state2:
                    if state1 not in state2 and state2 not in state1:
                        sim = 0.0
                if src1 and src2 and src1 != src2:
                    if src1 not in src2 and src2 not in src1:
                        sim = 0.0
                        
                if sim >= 0.6: # High similarity threshold
                    # Determine canon vs duplicate: keep the one with longer/more descriptions or established year
                    len1 = len(inc1["description"] or "") + len(inc1["phone"] or "") + len(inc1["linkedin"] or "")
                    len2 = len(inc2["description"] or "") + len(inc2["phone"] or "") + len(inc2["linkedin"] or "")
                    
                    if len1 >= len2:
                        canon, dupe = inc1, inc2
                    else:
                        canon, dupe = inc2, inc1
                        
                    inc_duplicates.append((canon, dupe))
                    resolved_inc_ids.add(dupe["id"])

        # Process incubator merges
        for canon, dupe in inc_duplicates:
            merged_inc = merge_incubator_records(canon, dupe)
            
            # Update canonical record
            placeholders = ", ".join([f"{k} = ?" for k in merged_inc.keys() if k != "id"])
            values = [merged_inc[k] for k in merged_inc.keys() if k != "id"]
            values.append(merged_inc["id"])
            cursor.execute(f"UPDATE incubators SET {placeholders} WHERE id = ?", tuple(values))
            
            # Re-map relationships from duplicate ID to canonical ID
            cursor.execute("UPDATE startups SET incubator_id = ?, incubated_at = ? WHERE incubator_id = ?", (canon["id"], canon["name"], dupe["id"]))
            cursor.execute("UPDATE mentors SET incubator_id = ? WHERE incubator_id = ?", (canon["id"], dupe["id"]))
            
            # Update edges in relationships table
            cursor.execute("UPDATE relationships SET source_id = ? WHERE source_id = ? AND source_type = 'Incubator'", (canon["id"], dupe["id"]))
            cursor.execute("UPDATE relationships SET target_id = ? WHERE target_id = ? AND target_type = 'Incubator'", (canon["id"], dupe["id"]))
            
            # Delete duplicate incubator
            cursor.execute("DELETE FROM incubators WHERE id = ?", (dupe["id"],))
            
            # Log using the SAME transaction cursor to prevent SQLite deadlock
            cursor.execute(
                "INSERT INTO pipeline_logs (timestamp, stage, status, message) VALUES (?, ?, ?, ?)",
                (datetime.now().isoformat(), "RESOLVE", "SUCCESS", f"Merged incubator duplicates: '{dupe['name']}' merged into canonical '{canon['name']}'")
            )

        # 2. Resolve Startups
        cursor.execute("SELECT * FROM startups")
        startups = [dict(row) for row in cursor.fetchall()]
        
        start_duplicates = []
        resolved_start_ids = set()
        
        for i in range(len(startups)):
            for j in range(i + 1, len(startups)):
                s1 = startups[i]
                s2 = startups[j]
                
                if s1["id"] in resolved_start_ids or s2["id"] in resolved_start_ids:
                    continue
                    
                sim = calculate_similarity(s1["startup_name"], s2["startup_name"])
                if sim >= 0.7:
                    # Determine canon vs duplicate
                    len1 = len(s1["website"] or "") + len(s1["sector"] or "")
                    len2 = len(s2["website"] or "") + len(s2["sector"] or "")
                    
                    if len1 >= len2:
                        canon, dupe = s1, s2
                    else:
                        canon, dupe = s2, s1
                        
                    start_duplicates.append((canon, dupe))
                    resolved_start_ids.add(dupe["id"])
                    
        # Process startup merges
        for canon, dupe in start_duplicates:
            merged_start = merge_startup_records(canon, dupe)
            
            placeholders = ", ".join([f"{k} = ?" for k in merged_start.keys() if k != "id"])
            values = [merged_start[k] for k in merged_start.keys() if k != "id"]
            values.append(merged_start["id"])
            cursor.execute(f"UPDATE startups SET {placeholders} WHERE id = ?", tuple(values))
            
            # Update edges in relationships table
            cursor.execute("UPDATE relationships SET source_id = ? WHERE source_id = ? AND source_type = 'Startup'", (canon["id"], dupe["id"]))
            cursor.execute("UPDATE relationships SET target_id = ? WHERE target_id = ? AND target_type = 'Startup'", (canon["id"], dupe["id"]))
            
            # Delete duplicate startup
            cursor.execute("DELETE FROM startups WHERE id = ?", (dupe["id"],))
            
            # Log using the SAME transaction cursor to prevent SQLite deadlock
            cursor.execute(
                "INSERT INTO pipeline_logs (timestamp, stage, status, message) VALUES (?, ?, ?, ?)",
                (datetime.now().isoformat(), "RESOLVE", "SUCCESS", f"Merged startup duplicates: '{dupe['startup_name']}' merged into canonical '{canon['startup_name']}'")
            )

        # 3. Clean up any duplicate edges resulting from merges (e.g. multiple FUNDED edges between same Investor and Startup)
        cursor.execute('''
            DELETE FROM relationships
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM relationships
                GROUP BY source_id, source_type, target_id, target_type, relationship_type
            )
        ''')

        # 4. Mark all remaining clean entries as resolved
        cursor.execute("UPDATE incubators SET status = 'resolved' WHERE status = 'cleaned'")
        cursor.execute("UPDATE startups SET status = 'resolved' WHERE status = 'cleaned'")
        
        # 5. Compute incubator stats (startup count & active startup count)
        cursor.execute("SELECT id, name FROM incubators")
        incs = cursor.fetchall()
        for inc in incs:
            inc_id = inc[0]
            cursor.execute("SELECT COUNT(*) FROM startups WHERE incubator_id = ?", (inc_id,))
            total_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM startups WHERE incubator_id = ? AND funding_stage != 'Dead' AND funding_stage != 'Closed'", (inc_id,))
            active_count = cursor.fetchone()[0]
            
            cursor.execute("UPDATE incubators SET startup_count = ?, active_startups = ? WHERE id = ?", (total_count, active_count, inc_id))

        conn.commit()
        log_pipeline_step("RESOLVE", "SUCCESS", f"Entity Resolution completed. Resolved {len(inc_duplicates)} incubator duplicate sets, {len(start_duplicates)} startup duplicate sets, and updated all relationship linkages.")
        return {"status": "success", "merged_incubators": len(inc_duplicates), "merged_startups": len(start_duplicates)}
    except Exception as e:
        conn.rollback()
        log_pipeline_step("RESOLVE", "ERROR", f"Error during entity resolution: {str(e)}")
        raise e
    finally:
        conn.close()
