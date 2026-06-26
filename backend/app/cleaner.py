import re
from datetime import datetime
from .database import get_db_connection, log_pipeline_step

# State normalization mapping
STATE_MAPPING = {
    "mh": "Maharashtra",
    "maharashtra": "Maharashtra",
    "maharastra": "Maharashtra",
    "gujarat": "Gujarat",
    "gujrat": "Gujarat",
    "gj": "Gujarat",
    "karnataka": "Karnataka",
    "ka": "Karnataka",
    "tamilnadu": "Tamil Nadu",
    "tamil nadu": "Tamil Nadu",
    "tn": "Tamil Nadu",
    "delhi": "Delhi",
    "new delhi": "Delhi",
    "dl": "Delhi",
    "up": "Uttar Pradesh",
    "uttar pradesh": "Uttar Pradesh",
    "haryana": "Haryana",
    "hr": "Haryana",
    "gujerat": "Gujarat"
}

# City normalization mapping
CITY_MAPPING = {
    "bombay": "Mumbai",
    "bangalore": "Bengaluru",
    "calcutta": "Kolkata",
    "madras": "Chennai",
    "new delhi": "Delhi"
}

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')

def normalize_state(state_str):
    if not state_str:
        return None
    state_clean = state_str.strip().lower()
    return STATE_MAPPING.get(state_clean, state_str.strip().title())

def normalize_city(city_str):
    if not city_str:
        return None
    city_clean = city_str.strip().lower()
    return CITY_MAPPING.get(city_clean, city_str.strip().title())

def validate_email(email_str):
    if not email_str:
        return None
    email_clean = email_str.strip().lower()
    # Remove placeholders or generic invalid placeholders
    if "placeholder" in email_clean or "invalid" in email_clean or "test" in email_clean:
        return None
    if EMAIL_REGEX.match(email_clean):
        return email_clean
    return None

def normalize_url(url_str):
    if not url_str:
        return None
    url_clean = url_str.strip().lower()
    # Remove trailing/leading slashes
    if url_clean.startswith("http://"):
        url_clean = "https://" + url_clean[7:]
    elif not url_clean.startswith("https://"):
        url_clean = "https://" + url_clean
    return url_clean

def run_cleaner_pipeline():
    log_pipeline_step("CLEAN", "START", "Starting data cleaning and standardization rules...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Clean Incubators
        cursor.execute("SELECT * FROM incubators")
        incubators = cursor.fetchall()
        cleaned_incubators_count = 0
        
        for inc in incubators:
            inc_id = inc["id"]
            
            # Clean elements
            clean_state = normalize_state(inc["state"])
            clean_city = normalize_city(inc["city"])
            clean_email = validate_email(inc["email"])
            clean_website = normalize_url(inc["website"])
            
            # Calculate adjustments to confidence score
            conf = inc["confidence_score"]
            if clean_state != inc["state"] or clean_city != inc["city"] or clean_email != inc["email"] or clean_website != inc["website"]:
                conf = min(0.95, conf + 0.15) # Boost confidence since data is now normalized/validated
            
            cursor.execute('''
                UPDATE incubators
                SET state = ?, city = ?, email = ?, website = ?, confidence_score = ?, status = 'cleaned', last_updated = ?
                WHERE id = ?
            ''', (clean_state, clean_city, clean_email, clean_website, conf, datetime.now().isoformat(), inc_id))
            cleaned_incubators_count += 1
            
        # 2. Clean Startups
        cursor.execute("SELECT * FROM startups")
        startups = cursor.fetchall()
        cleaned_startups_count = 0
        
        for start in startups:
            start_id = start["id"]
            
            clean_city = normalize_city(start["hq_city"])
            clean_website = normalize_url(start["website"])
            
            conf = start["confidence_score"]
            if clean_city != start["hq_city"] or clean_website != start["website"]:
                conf = min(0.95, conf + 0.15)
                
            cursor.execute('''
                UPDATE startups
                SET hq_city = ?, website = ?, confidence_score = ?, status = 'cleaned', last_updated = ?
                WHERE id = ?
            ''', (clean_city, clean_website, conf, datetime.now().isoformat(), start_id))
            cleaned_startups_count += 1

        # 3. Clean Investors
        cursor.execute("SELECT * FROM investors")
        investors = cursor.fetchall()
        for inv in investors:
            clean_email = validate_email(inv["email"])
            cursor.execute('''
                UPDATE investors
                SET email = ?
                WHERE id = ?
            ''', (clean_email, inv["id"]))

        # 4. Clean Mentors
        cursor.execute("SELECT * FROM mentors")
        mentors = cursor.fetchall()
        for m in mentors:
            clean_email = validate_email(m["email"])
            cursor.execute('''
                UPDATE mentors
                SET email = ?
                WHERE id = ?
            ''', (clean_email, m["id"]))
            
        conn.commit()
        log_pipeline_step("CLEAN", "SUCCESS", f"Successfully cleaned and normalized {cleaned_incubators_count} incubators and {cleaned_startups_count} startups.")
        return {"status": "success", "cleaned_incubators": cleaned_incubators_count, "cleaned_startups": cleaned_startups_count}
    except Exception as e:
        conn.rollback()
        log_pipeline_step("CLEAN", "ERROR", f"Error during cleaning: {str(e)}")
        raise e
    finally:
        conn.close()
