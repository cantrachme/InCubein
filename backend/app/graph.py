import json
import csv
import io
from .database import get_db_connection

def generate_web_graph():
    """Generates a node-link structure suitable for D3/Cytoscape visualizations."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    nodes = []
    edges = []
    node_ids = set()
    
    # 1. Fetch Incubators
    cursor.execute("SELECT id, name, city, state, organization_type, confidence_score FROM incubators")
    for row in cursor.fetchall():
        nid = row["id"]
        nodes.append({
            "id": nid,
            "label": row["name"],
            "type": "Incubator",
            "val": 15,  # Size node
            "details": {
                "Type": row["organization_type"],
                "City": row["city"],
                "State": row["state"],
                "Confidence": f"{row['confidence_score']:.2f}"
            }
        })
        node_ids.add(nid)
        
    # 2. Fetch Startups
    cursor.execute("SELECT id, startup_name, sector, funding_stage, hq_city FROM startups")
    for row in cursor.fetchall():
        nid = row["id"]
        nodes.append({
            "id": nid,
            "label": row["startup_name"],
            "type": "Startup",
            "val": 10,
            "details": {
                "Sector": row["sector"],
                "Funding": row["funding_stage"],
                "HQ City": row["hq_city"]
            }
        })
        node_ids.add(nid)

    # 3. Fetch Mentors
    cursor.execute("SELECT id, name, expertise FROM mentors")
    for row in cursor.fetchall():
        nid = row["id"]
        expertise = json.loads(row["expertise"]) if row["expertise"] else []
        nodes.append({
            "id": nid,
            "label": row["name"],
            "type": "Mentor",
            "val": 8,
            "details": {
                "Expertise": ", ".join(expertise)
            }
        })
        node_ids.add(nid)

    # 4. Fetch Investors
    cursor.execute("SELECT id, name, type, investment_stage FROM investors")
    for row in cursor.fetchall():
        nid = row["id"]
        stages = json.loads(row["investment_stage"]) if row["investment_stage"] else []
        nodes.append({
            "id": nid,
            "label": row["name"],
            "type": "Investor",
            "val": 12,
            "details": {
                "Type": row["type"],
                "Stages": ", ".join(stages)
            }
        })
        node_ids.add(nid)

    # 5. Fetch Edges from relationships
    cursor.execute("SELECT source_id, source_type, target_id, target_type, relationship_type, confidence_score FROM relationships")
    for row in cursor.fetchall():
        src = row["source_id"]
        tgt = row["target_id"]
        rel = row["relationship_type"]
        
        # If target node is a Sector and isn't represented as an independent node yet, add it
        if row["target_type"] == "Sector" and tgt not in node_ids:
            nodes.append({
                "id": tgt,
                "label": tgt,
                "type": "Sector",
                "val": 7,
                "details": {"Category": "Industry Vertical"}
            })
            node_ids.add(tgt)
            
        # Ensure both endpoints exist in node collection
        if src in node_ids and tgt in node_ids:
            edges.append({
                "source": src,
                "target": tgt,
                "type": rel,
                "confidence": row["confidence_score"]
            })
            
    conn.close()
    return {"nodes": nodes, "links": edges}

def generate_csv_exports():
    """Generates CSV files for all collections. Returns dict of CSV strings."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    outputs = {}
    
    # Incubators CSV
    cursor.execute("SELECT * FROM incubators")
    inc_rows = [dict(r) for r in cursor.fetchall()]
    if inc_rows:
        f = io.StringIO()
        w = csv.DictWriter(f, fieldnames=inc_rows[0].keys())
        w.writeheader()
        w.writerows(inc_rows)
        outputs["incubators.csv"] = f.getvalue()
        
    # Startups CSV
    cursor.execute("SELECT * FROM startups")
    start_rows = [dict(r) for r in cursor.fetchall()]
    if start_rows:
        f = io.StringIO()
        w = csv.DictWriter(f, fieldnames=start_rows[0].keys())
        w.writeheader()
        w.writerows(start_rows)
        outputs["startups.csv"] = f.getvalue()
        
    # Mentors CSV
    cursor.execute("SELECT * FROM mentors")
    mentor_rows = [dict(r) for r in cursor.fetchall()]
    if mentor_rows:
        f = io.StringIO()
        w = csv.DictWriter(f, fieldnames=mentor_rows[0].keys())
        w.writeheader()
        w.writerows(mentor_rows)
        outputs["mentors.csv"] = f.getvalue()
        
    # Investors CSV
    cursor.execute("SELECT * FROM investors")
    investor_rows = [dict(r) for r in cursor.fetchall()]
    if investor_rows:
        f = io.StringIO()
        w = csv.DictWriter(f, fieldnames=investor_rows[0].keys())
        w.writeheader()
        w.writerows(investor_rows)
        outputs["investors.csv"] = f.getvalue()
        
    # Relationships CSV
    cursor.execute("SELECT * FROM relationships")
    rel_rows = [dict(r) for r in cursor.fetchall()]
    if rel_rows:
        f = io.StringIO()
        w = csv.DictWriter(f, fieldnames=rel_rows[0].keys())
        w.writeheader()
        w.writerows(rel_rows)
        outputs["relationships.csv"] = f.getvalue()
        
    conn.close()
    return outputs

def generate_json_export():
    """Generates single ecosystem hierarchical JSON."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM incubators")
    incubators = [dict(row) for row in cursor.fetchall()]
    for inc in incubators:
        # Decode JSON strings
        for field in ["incubation_programs", "acceleration_programs", "lab_facilities", "focus_areas"]:
            if inc[field]:
                inc[field] = json.loads(inc[field])
                
    cursor.execute("SELECT * FROM startups")
    startups = [dict(row) for row in cursor.fetchall()]
    for start in startups:
        if start["founders"]:
            start["founders"] = json.loads(start["founders"])
            
    cursor.execute("SELECT * FROM mentors")
    mentors = [dict(row) for row in cursor.fetchall()]
    for m in mentors:
        if m["expertise"]:
            m["expertise"] = json.loads(m["expertise"])
            
    cursor.execute("SELECT * FROM investors")
    investors = [dict(row) for row in cursor.fetchall()]
    for inv in investors:
        for field in ["investment_stage", "portfolio_startups"]:
            if inv[field]:
                inv[field] = json.loads(inv[field])
                
    cursor.execute("SELECT * FROM relationships")
    relationships = [dict(row) for row in cursor.fetchall()]
    for rel in relationships:
        if rel["metadata"]:
            rel["metadata"] = json.loads(rel["metadata"])
            
    conn.close()
    return {
        "incubators": incubators,
        "startups": startups,
        "mentors": mentors,
        "investors": investors,
        "relationships": relationships
    }

def generate_mongodb_export():
    """Generates import script of MongoDB queries."""
    data = generate_json_export()
    script = []
    
    script.append("// MongoDB Import script for Indian Startup Ecosystem Intelligence Platform")
    script.append("// Execute in Mongosh or Mongo compass shell\n")
    script.append("use ecosystemDb;\n")
    script.append("db.incubators.drop();")
    script.append("db.startups.drop();")
    script.append("db.investors.drop();")
    script.append("db.mentors.drop();")
    script.append("db.relationships.drop();\n")
    
    # Incubators
    if data["incubators"]:
        script.append(f"db.incubators.insertMany({json.dumps(data['incubators'], indent=2)});")
    # Startups
    if data["startups"]:
        script.append(f"db.startups.insertMany({json.dumps(data['startups'], indent=2)});")
    # Investors
    if data["investors"]:
        script.append(f"db.investors.insertMany({json.dumps(data['investors'], indent=2)});")
    # Mentors
    if data["mentors"]:
        script.append(f"db.mentors.insertMany({json.dumps(data['mentors'], indent=2)});")
    # Relationships
    if data["relationships"]:
        script.append(f"db.relationships.insertMany({json.dumps(data['relationships'], indent=2)});")
        
    return "\n".join(script)

def generate_neo4j_export():
    """Generates import Cypher script for Neo4j database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cypher = []
    cypher.append("// Neo4j Graph Import Script - Indian Startup Ecosystem Intelligence")
    cypher.append("// Create constraints for unique nodes")
    cypher.append("CREATE CONSTRAINT unique_incubator IF NOT EXISTS FOR (i:Incubator) REQUIRE i.id IS UNIQUE;")
    cypher.append("CREATE CONSTRAINT unique_startup IF NOT EXISTS FOR (s:Startup) REQUIRE s.id IS UNIQUE;")
    cypher.append("CREATE CONSTRAINT unique_founder IF NOT EXISTS FOR (f:Founder) REQUIRE f.name IS UNIQUE;")
    cypher.append("CREATE CONSTRAINT unique_investor IF NOT EXISTS FOR (inv:Investor) REQUIRE inv.id IS UNIQUE;")
    cypher.append("CREATE CONSTRAINT unique_mentor IF NOT EXISTS FOR (m:Mentor) REQUIRE m.id IS UNIQUE;")
    cypher.append("CREATE CONSTRAINT unique_sector IF NOT EXISTS FOR (sec:Sector) REQUIRE sec.name IS UNIQUE;")
    cypher.append("CREATE CONSTRAINT unique_city IF NOT EXISTS FOR (c:City) REQUIRE c.name IS UNIQUE;")
    cypher.append("CREATE CONSTRAINT unique_state IF NOT EXISTS FOR (st:State) REQUIRE st.name IS UNIQUE;\n")
    
    # 1. Create States
    cursor.execute("SELECT DISTINCT state FROM incubators WHERE state IS NOT NULL UNION SELECT DISTINCT state FROM incubators WHERE state IS NOT NULL")
    states = [r[0] for r in cursor.fetchall() if r[0]]
    for st in states:
        cypher.append(f"MERGE (:State {{name: '{st}'}});")
        
    # 2. Create Cities and connect to States
    cursor.execute("SELECT DISTINCT city, state FROM incubators WHERE city IS NOT NULL AND state IS NOT NULL")
    cities = cursor.fetchall()
    for row in cities:
        cname, sname = row[0], row[1]
        cypher.append(f"MERGE (c:City {{name: '{cname}'}});")
        cypher.append(f"MATCH (c:City {{name: '{cname}'}}), (st:State {{name: '{sname}'}}) MERGE (c)-[:LOCATED_IN]->(st);")

    # 3. Create Incubators and connect to City
    cursor.execute("SELECT id, name, description, organization_type, year_established, website, city FROM incubators")
    for row in cursor.fetchall():
        desc_escaped = (row["description"] or "").replace("'", "\\'")
        cypher.append(
            f"MERGE (i:Incubator {{id: '{row['id']}'}}) "
            f"ON CREATE SET i.name = '{row['name']}', i.description = '{desc_escaped}', "
            f"i.type = '{row['organization_type']}', i.year_established = {row['year_established'] or 0}, "
            f"i.website = '{row['website'] or ''}';"
        )
        if row["city"]:
            cypher.append(f"MATCH (i:Incubator {{id: '{row['id']}'}}), (c:City {{name: '{row['city']}'}}) MERGE (i)-[:LOCATED_IN]->(c);")
            
    # 4. Create Startups
    cursor.execute("SELECT id, startup_name, sector, website, funding_stage, hq_city, founders FROM startups")
    startups = cursor.fetchall()
    for row in startups:
        cypher.append(
            f"MERGE (s:Startup {{id: '{row['id']}'}}) "
            f"ON CREATE SET s.name = '{row['startup_name']}', s.website = '{row['website'] or ''}', "
            f"s.funding_stage = '{row['funding_stage'] or ''}';"
        )
        if row["sector"]:
            cypher.append(f"MERGE (sec:Sector {{name: '{row['sector']}'}});")
            cypher.append(f"MATCH (s:Startup {{id: '{row['id']}'}}), (sec:Sector {{name: '{row['sector']}'}}) MERGE (s)-[:BELONGS_TO_SECTOR]->(sec);")
        if row["hq_city"]:
            cypher.append(f"MERGE (c:City {{name: '{row['hq_city']}'}});")
            cypher.append(f"MATCH (s:Startup {{id: '{row['id']}'}}), (c:City {{name: '{row['hq_city']}'}}) MERGE (s)-[:LOCATED_IN]->(c);")
            
        # Parse founders
        founders = json.loads(row["founders"]) if row["founders"] else []
        for f in founders:
            f_escaped = f.replace("'", "\\'")
            cypher.append(f"MERGE (f:Founder {{name: '{f_escaped}'}});")
            cypher.append(f"MATCH (s:Startup {{id: '{row['id']}'}}), (f:Founder {{name: '{f_escaped}'}}) MERGE (f)-[:FOUNDED]->(s);")

    # 5. Create Mentors and connect to Incubator
    cursor.execute("SELECT id, name, expertise, incubator_id FROM mentors")
    for row in cursor.fetchall():
        cypher.append(f"MERGE (m:Mentor {{id: '{row['id']}', name: '{row['name']}'}});")
        if row["incubator_id"]:
            cypher.append(f"MATCH (m:Mentor {{id: '{row['id']}'}}), (i:Incubator {{id: '{row['incubator_id']}'}}) MERGE (i)-[:HAS_MENTOR]->(m);")

    # 6. Create Investors
    cursor.execute("SELECT id, name, type, investment_stage FROM investors")
    for row in cursor.fetchall():
        cypher.append(f"MERGE (inv:Investor {{id: '{row['id']}', name: '{row['name']}', type: '{row['type']}'}});")

    # 7. Create Edges based on Relationships Table
    cursor.execute("SELECT source_id, source_type, target_id, target_type, relationship_type FROM relationships")
    for row in cursor.fetchall():
        src, src_type, tgt, tgt_type, rel = row[0], row[1], row[2], row[3], row[4]
        
        # Don't recreate edges already handled above (like LOCATED_IN, BELONGS_TO_SECTOR)
        if rel in ["LOCATED_IN", "BELONGS_TO_SECTOR", "HAS_MENTOR"]:
            continue
            
        # We need mapping rules for MATCH statement labels
        src_label = src_type
        tgt_label = tgt_type
        
        cypher.append(
            f"MATCH (a:{src_label} {{id: '{src}'}}), (b:{tgt_label} {{id: '{tgt}'}}) "
            f"MERGE (a)-[:{rel}]->(b);"
        )

    conn.close()
    return "\n".join(cypher)
