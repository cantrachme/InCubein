import os
import json
import logging
from datetime import datetime
from .database import get_db_connection, log_pipeline_step

# Configure logger
logger = logging.getLogger(__name__)

# Fallback geocoding database for major Indian startup hubs
CITY_COORDINATES = {
    "Mumbai": (19.0760, 72.8777),
    "Bengaluru": (12.9716, 77.5946),
    "New Delhi": (28.6139, 77.2090),
    "Delhi": (28.6139, 77.2090),
    "Chennai": (13.0827, 80.2707),
    "Pune": (18.5204, 73.8567),
    "Ahmedabad": (23.0225, 72.5714),
    "Noida": (28.5355, 77.3910),
    "Gurgaon": (28.4595, 77.0266),
    "Gurugram": (28.4595, 77.0266),
    "Hyderabad": (17.3850, 78.4867),
    "Kolkata": (22.5726, 88.3639)
}

# Rule-based sector classifiers based on description keywords
SECTOR_KEYWORDS = {
    "AI": ["ai", "artificial intelligence", "ml", "machine learning", "deep learning", "nlp", "computer vision", "generative ai"],
    "ML": ["ml", "machine learning", "neural networks", "predictive analytics"],
    "Web3": ["web3", "blockchain", "crypto", "ethereum", "bitcoin", "nft", "smart contract", "decentralized"],
    "FinTech": ["fintech", "finance", "payment", "lending", "credit", "banking", "wealthtech", "insurtech", "transaction"],
    "HealthTech": ["healthtech", "health", "medical", "healthcare", "telemedicine", "patient", "clinic", "medtech"],
    "AgriTech": ["agritech", "agriculture", "farming", "crop", "soil", "harvest", "farmer", "irrigation"],
    "EdTech": ["edtech", "education", "learning", "classroom", "course", "tutor", "upskilling", "student"],
    "ClimateTech": ["climatetech", "climate", "carbon", "sustainability", "emission", "greenhouse", "environment"],
    "DeepTech": ["deeptech", "robotics", "drone", "quantum", "semiconductor", "material science", "nanotech", "sensors"],
    "SaaS": ["saas", "software as a service", "b2b software", "cloud software", "crm", "workflow automation"],
    "IoT": ["iot", "internet of things", "smart device", "embedded system", "sensors", "hardware integration"],
    "SpaceTech": ["spacetech", "space", "satellite", "rocket", "propulsion", "orbit", "aerospace"],
    "DefenceTech": ["defencetech", "defence", "military", "tactical", "security forces", "uav", "aerospace & defence"],
    "Manufacturing": ["manufacturing", "factory", "hardware", "machinery", "industrial", "3d printing", "assembly"],
    "Biotech": ["biotech", "biotechnology", "genomics", "pharma", "clinical trial", "laboratory", "synthetic biology"],
    "Clean Energy": ["clean energy", "renewable", "solar", "wind", "biofuel", "electric vehicle", "ev", "battery", "energy storage"]
}

def rule_based_enrichment(text):
    """Identifies matching sectors based on keyword matching."""
    if not text:
        return []
    text_lower = text.lower()
    matched_sectors = []
    for sector, keywords in SECTOR_KEYWORDS.items():
        for kw in keywords:
            # Check for word boundary
            if re_search_word(kw, text_lower):
                matched_sectors.append(sector)
                break
    return list(set(matched_sectors))

def re_search_word(word, text):
    # Safe word search
    pattern = r'\b' + re_escape_special(word) + r'\b'
    import re
    try:
        return bool(re.search(pattern, text))
    except:
        return word in text

def re_escape_special(word):
    # Basic regex escape
    return "".join(f"\\{c}" if c in ".+*?^$()[]{}|\\" else c for c in word)

def call_gemini_enrichment(api_key, text_content, context_type="incubator"):
    """Enriches data using the Gemini Pro API model."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        You are a Startup Ecosystem Analyst. Analyze the following {context_type} text content and extract/infer:
        1. Primary focus sectors (Select from: AI, ML, Web3, FinTech, HealthTech, AgriTech, EdTech, ClimateTech, DeepTech, SaaS, IoT, SpaceTech, DefenceTech, Manufacturing, Biotech, Clean Energy)
        2. A concise 2-sentence summary.
        3. Confidence level (0.0 to 1.0) of this inference.

        Text Content: "{text_content}"

        Respond ONLY with a valid JSON object matching this schema:
        {{
            "sectors": ["Sector1", "Sector2"],
            "summary": "Concise summary...",
            "confidence": 0.95
        }}
        """
        response = model.generate_content(prompt)
        # Parse the JSON response
        text = response.text.strip()
        # Clean json backticks if present
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        return json.loads(text.strip())
    except Exception as e:
        logger.warning(f"Failed to query Gemini API: {str(e)}. Falling back to local model.")
        return None

def run_enricher_pipeline():
    log_pipeline_step("ENRICH", "START", "Starting AI data enrichment phase...")
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if api_key:
        log_pipeline_step("ENRICH", "START", "Gemini API key detected. Initiating LLM-powered semantic tagging and categorization.")
    else:
        log_pipeline_step("ENRICH", "START", "Gemini API key not found. Proceeding with local keyword classifier & geocoding maps.")

    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Enrich Incubators
        cursor.execute("SELECT * FROM incubators")
        incubators = [dict(row) for row in cursor.fetchall()]
        enriched_incubators_count = 0
        
        for inc in incubators:
            inc_id = inc["id"]
            description = inc["description"] or ""
            name = inc["name"]
            
            # Geocoding resolution
            lat, lon = inc["latitude"], inc["longitude"]
            if (not lat or not lon) and inc["city"] in CITY_COORDINATES:
                lat, lon = CITY_COORDINATES[inc["city"]]
            
            # Sector and tag enrichment
            existing_focus = set(json.loads(inc["focus_areas"]) if inc["focus_areas"] else [])
            inferred_focus = []
            confidence_score = inc["confidence_score"]
            
            # Try Gemini API if available
            gemini_result = None
            if api_key and (description or name) and enriched_incubators_count < 20:
                gemini_result = call_gemini_enrichment(api_key, f"{name}: {description}", "incubator")
                
            if gemini_result:
                inferred_focus = gemini_result.get("sectors", [])
                if gemini_result.get("summary"):
                    description = gemini_result["summary"]
                confidence_score = min(0.99, (confidence_score + gemini_result.get("confidence", 0.90)) / 2)
            else:
                # Fallback to local rule-based model
                inferred_focus = rule_based_enrichment(description + " " + name)
                confidence_score = min(0.98, confidence_score + 0.05)
                
            merged_focus = list(existing_focus.union(set(inferred_focus)))
            
            cursor.execute('''
                UPDATE incubators
                SET latitude = ?, longitude = ?, focus_areas = ?, description = ?, confidence_score = ?, status = 'enriched', last_updated = ?
                WHERE id = ?
            ''', (lat, lon, json.dumps(merged_focus), description, confidence_score, datetime.now().isoformat(), inc_id))
            enriched_incubators_count += 1

        # 2. Enrich Startups
        cursor.execute("SELECT * FROM startups")
        startups = [dict(row) for row in cursor.fetchall()]
        enriched_startups_count = 0
        
        for start in startups:
            start_id = start["id"]
            sector = start["sector"] or ""
            startup_name = start["startup_name"]
            
            inferred_sectors = []
            confidence_score = start["confidence_score"]
            
            gemini_result = None
            if api_key and (sector or startup_name) and enriched_startups_count < 20:
                gemini_result = call_gemini_enrichment(api_key, f"Startup Name: {startup_name}, Raw Sector Tag: {sector}", "startup")
                
            if gemini_result:
                inferred_sectors = gemini_result.get("sectors", [])
                confidence_score = min(0.99, (confidence_score + gemini_result.get("confidence", 0.90)) / 2)
            else:
                inferred_sectors = rule_based_enrichment(sector + " " + startup_name)
                confidence_score = min(0.98, confidence_score + 0.05)
                
            # If standard sector tags found, use the first matching tag as the primary cleaned sector
            # If no matches, fallback to current sector capitalization
            new_sector = sector
            if inferred_sectors:
                # Find which of standard tags matches inferred
                new_sector = inferred_sectors[0]
            else:
                # Capitalize nicely
                new_sector = sector.title() if sector else "General Startup"
                
            cursor.execute('''
                UPDATE startups
                SET sector = ?, confidence_score = ?, status = 'enriched', last_updated = ?
                WHERE id = ?
            ''', (new_sector, confidence_score, datetime.now().isoformat(), start_id))
            
            # Connect Sector node edge in relationships table
            # Check if edge already exists, if not, create it
            if new_sector:
                res_edge = cursor.execute('''
                    SELECT id FROM relationships
                    WHERE source_id = ? AND target_id = ? AND relationship_type = 'BELONGS_TO_SECTOR'
                ''', (start_id, new_sector)).fetchone()
                
                if not res_edge:
                    cursor.execute('''
                        INSERT INTO relationships (source_id, source_type, target_id, target_type, relationship_type, confidence_score, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (start_id, "Startup", new_sector, "Sector", "BELONGS_TO_SECTOR", confidence_score, json.dumps({"auto_inferred": True})))
                    
            enriched_startups_count += 1
            
        conn.commit()
        log_pipeline_step("ENRICH", "SUCCESS", f"Enrichment completed successfully! Enriched {enriched_incubators_count} incubators with geolocation and focus area tags, and mapped {enriched_startups_count} startups.")
        return {"status": "success", "enriched_incubators": enriched_incubators_count, "enriched_startups": enriched_startups_count}
    except Exception as e:
        conn.rollback()
        log_pipeline_step("ENRICH", "ERROR", f"Error during enrichment: {str(e)}")
        raise e
    finally:
        conn.close()
