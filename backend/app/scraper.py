import json
import uuid
import os
import ast
import re
import openpyxl
from datetime import datetime
from .database import get_db_connection, log_pipeline_step

def clean_sectors(sector_str):
    if not sector_str:
        return []
    sector_str = str(sector_str).strip()
    if sector_str.startswith('[') and sector_str.endswith(']'):
        try:
            val = ast.literal_eval(sector_str)
            if isinstance(val, list):
                cleaned = []
                for item in val:
                    if isinstance(item, list):
                        cleaned.extend([str(i).strip() for i in item if i])
                    elif item:
                        cleaned.append(str(item).strip())
                return list(dict.fromkeys(cleaned))
        except:
            pass
    parts = re.split(r'[,;]', sector_str)
    return list(dict.fromkeys([p.strip() for p in parts if p.strip()]))

def find_best_incubator_id(incubator_id_map, name):
    if not name:
        return None
    if name in incubator_id_map:
        return incubator_id_map[name]
        
    clean_name = "".join(c for c in name.lower() if c.isalnum())
    for k, v in incubator_id_map.items():
        clean_k = "".join(c for c in k.lower() if c.isalnum())
        if clean_name == clean_k:
            return v
            
    def get_words(t):
        return {w for w in re.sub(r'[^a-zA-Z0-9\s]', ' ', t.lower()).split() if w not in {"for", "and", "the", "of", "in", "at", "on", "with", "a", "an"}}
        
    name_words = get_words(name)
    best_id = None
    best_sim = 0.0
    
    for k, v in incubator_id_map.items():
        k_words = get_words(k)
        if not name_words or not k_words:
            continue
        sim = len(name_words.intersection(k_words)) / len(name_words.union(k_words))
        if name.lower() in k.lower() or k.lower() in name.lower():
            sim = max(sim, 0.6)
        if sim > best_sim:
            best_sim = sim
            best_id = v
            
    if best_sim >= 0.4:
        return best_id
        
    return None


# A rich dataset of raw ecosystem information containing duplicates, errors, and unnormalized fields.
# This represents the raw scraped output from various government, academic, and private ecosystem directories.
RAW_INCUBATORS = [
    {
        "name": "Society for Innovation and Entrepreneurship IIT Bombay",
        "description": "The technology business incubator at IIT Bombay. SINE provides end-to-end support for tech startups.",
        "organization_type": "University",
        "year_established": 2004,
        "website": "sine.iitb.ac.in",
        "email": "sine@iitb.ac.in",
        "phone": "+91 22 2576 7016",
        "linkedin": "linkedin.com/company/sine-iit-bombay",
        "twitter": "@SINEIITB",
        "founder_or_head": "Prof. Poyni Bhatt",
        "address": "IIT Bombay, Powai",
        "city": "Bombay",
        "state": "MH",
        "country": "India",
        "postal_code": "400076",
        "latitude": None,
        "longitude": None,
        "incubation_programs": ["Bio-incubation", "Physical Incubation", "Virtual Incubation"],
        "acceleration_programs": ["NIDHI-Accelerator"],
        "funding_support": "Seed support up to 30 Lakhs",
        "equity_model": "3% to 5% equity",
        "grant_support": "NIDHI-PRAYAS, BIRAC-BIG",
        "mentorship_available": 1,
        "coworking_available": 1,
        "lab_facilities": ["Makerspace", "Bio-lab", "Electronics Lab"],
        "duration": "18-36 months",
        "focus_areas": ["DeepTech", "Biotech", "Manufacturing", "IoT", "AI"],
        "source_url": "https://sine.iitb.ac.in/about"
    },
    {
        "name": "SINE IIT Bombay", # DUPLICATE entity for Entity Resolution testing
        "description": "SINE is the umbrella organization at IIT Bombay for fostering entrepreneurship and incubating tech startups.",
        "organization_type": "Academic Institutions",
        "year_established": 2004,
        "website": "http://sine.iitb.ac.in",
        "email": "sine_office@iitb.ac.in",
        "phone": "022-25767016",
        "linkedin": "https://linkedin.com/company/sine-iit-bombay",
        "twitter": "",
        "founder_or_head": "Poyni Bhatt",
        "address": "Powai, IIT Campus",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "postal_code": "400076",
        "latitude": 19.1334,
        "longitude": 72.9133,
        "incubation_programs": ["Incubation Program"],
        "acceleration_programs": [],
        "funding_support": "Yes",
        "equity_model": "Equity model varies",
        "grant_support": "BIRAC BIG, NIDHI Prayas",
        "mentorship_available": 1,
        "coworking_available": 1,
        "lab_facilities": [],
        "duration": "3 years",
        "focus_areas": ["DeepTech", "Biotech", "SaaS", "AI"],
        "source_url": "https://www.startupindia.gov.in/incubators/sine"
    },
    {
        "name": "Centre for Innovation Incubation and Entrepreneurship",
        "description": "CIIE.CO is the Innovation and Entrepreneurship Centre at IIM Ahmedabad, supporting startups and founders.",
        "organization_type": "University",
        "year_established": 2002,
        "website": "ciie.co",
        "email": "ciie@iima.ac.in",
        "phone": "+91 79 6632 4201",
        "linkedin": "linkedin.com/company/ciie-co",
        "twitter": "@CIIECO",
        "founder_or_head": "Kunal Upadhyay",
        "address": "IIM Ahmedabad Campus, Vastrapur",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "country": "India",
        "postal_code": "380015",
        "latitude": 23.0308,
        "longitude": 72.5358,
        "incubation_programs": ["Ecosystem Builders Program", "Spreed Program"],
        "acceleration_programs": ["Financial Inclusion Lab", "Craft Accelerator"],
        "funding_support": "Seed funding & Growth funds",
        "equity_model": "Equity matching standard",
        "grant_support": "TIDE 2.0, NIDHI Seed Support",
        "mentorship_available": 1,
        "coworking_available": 1,
        "lab_facilities": [],
        "duration": "12-24 months",
        "focus_areas": ["FinTech", "AgriTech", "Clean Energy", "SaaS"],
        "source_url": "https://ciie.co/"
    },
    {
        "name": "CIIE.CO IIM Ahmedabad", # DUPLICATE entity for Entity Resolution testing
        "description": "CIIE.CO (Centre for Innovation Incubation and Entrepreneurship) is the startup incubator of IIM Ahmedabad.",
        "organization_type": "University",
        "year_established": 2002,
        "website": "https://www.ciie.co",
        "email": "info@ciie.co",
        "phone": "",
        "linkedin": "https://linkedin.com/company/ciie-co",
        "twitter": "@CIIECO",
        "founder_or_head": "Kunal Upadhyay",
        "address": "Vastrapur",
        "city": "Ahmedabad",
        "state": "Gujrat", # Typos in state
        "country": "India",
        "postal_code": "380015",
        "latitude": None,
        "longitude": None,
        "incubation_programs": ["Incubation"],
        "acceleration_programs": ["Fintech Lab"],
        "funding_support": "Yes",
        "equity_model": "Flexible equity",
        "grant_support": "MeitY TIDE, DST",
        "mentorship_available": 1,
        "coworking_available": 1,
        "lab_facilities": [],
        "duration": "24 months",
        "focus_areas": ["FinTech", "AgriTech", "EdTech", "Clean Energy"],
        "source_url": "https://www.startupindia.gov.in/incubators/ciie"
    },
    {
        "name": "NSRCEL IIM Bangalore",
        "description": "NSRCEL is the startup hub of IIM Bangalore. It fosters entrepreneurship through academic & practical support.",
        "organization_type": "University",
        "year_established": 2000,
        "website": "nsrcel.org",
        "email": "nsrcel@iimb.ac.in",
        "phone": "080 2699 3701",
        "linkedin": "linkedin.com/company/nsrcel",
        "twitter": "@NSRCEL",
        "founder_or_head": "Anand Sri Ganesh",
        "address": "IIM Bangalore Campus, Bannerghatta Road",
        "city": "Bangalore", # Unnormalized City name
        "state": "karnataka", # Unnormalized State name (lowercase)
        "country": "India",
        "postal_code": "560076",
        "latitude": 12.8950,
        "longitude": 77.6010,
        "incubation_programs": ["Launchpad Program", "Women Startup Program", "Impact Orbit"],
        "acceleration_programs": ["Velocity Accelerator"],
        "funding_support": "Access to angel networks & seed grants",
        "equity_model": "Zero-equity incubation for select programs",
        "grant_support": "NIDHI-SSS, MeitY SAMRIDH",
        "mentorship_available": 1,
        "coworking_available": 1,
        "lab_facilities": [],
        "duration": "12 months",
        "focus_areas": ["SaaS", "FinTech", "Social Impact", "EdTech", "HealthTech"],
        "source_url": "https://www.nsrcel.org/"
    },
    {
        "name": "IITM Incubation Cell",
        "description": "India's leading DeepTech incubator based at IIT Madras Research Park. Supports deeptech innovations.",
        "organization_type": "University",
        "year_established": 2013,
        "website": "https://www.incubation.iitm.ac.in",
        "email": "contact@incubation.iitm.ac.in",
        "phone": "+91-44-6646 9870",
        "linkedin": "linkedin.com/company/iitm-incubation-cell",
        "twitter": "@IITMIC",
        "founder_or_head": "Dr. Tamaswati Ghosh",
        "address": "IITM Research Park, Phase-1, Kanagam Road, Taramani",
        "city": "Madras", # Unnormalized City name
        "state": "Tamilnadu", # Unnormalized State name
        "country": "India",
        "postal_code": "600113",
        "latitude": 12.9892,
        "longitude": 80.2464,
        "incubation_programs": ["Deep Tech Incubation", "Bio-Incubator", "IITM MedTech"],
        "acceleration_programs": [],
        "funding_support": "Seed funding up to 50 Lakhs",
        "equity_model": "2% to 4% equity",
        "grant_support": "BIRAC BIG, DST NIDHI",
        "mentorship_available": 1,
        "coworking_available": 1,
        "lab_facilities": ["Advanced Maker Lab", "Electronic Design Lab", "Bioincubator Cleanroom"],
        "duration": "24-36 months",
        "focus_areas": ["DeepTech", "SpaceTech", "DefenceTech", "Clean Energy", "AI", "IoT"],
        "source_url": "https://www.incubation.iitm.ac.in"
    },
    {
        "name": "Foundation for Innovation and Technology Transfer FITT IIT Delhi",
        "description": "FITT is the industrial interface organization of IIT Delhi, facilitating technology transfer and incubation.",
        "organization_type": "University",
        "year_established": 1992,
        "website": "fitt-iitd.in",
        "email": "fitt_office@admin.iitd.ac.in",
        "phone": "+91-11-26597164",
        "linkedin": "linkedin.com/company/fitt-iitd",
        "twitter": "@FITT_IITD",
        "founder_or_head": "Dr. Anil Wali",
        "address": "IIT Delhi Campus, Hauz Khas",
        "city": "New Delhi",
        "state": "Delhi",
        "country": "India",
        "postal_code": "110016",
        "latitude": 28.5450,
        "longitude": 77.1926,
        "incubation_programs": ["TBI", "Bio-NEST", "Sonata Innovation Lab"],
        "acceleration_programs": [],
        "funding_support": "Debt and equity seed options",
        "equity_model": "Minority equity model",
        "grant_support": "NIDHI-SSS, BIRAC BIG, MeitY TIDE 2.0",
        "mentorship_available": 1,
        "coworking_available": 1,
        "lab_facilities": ["Mechanical Prototype Lab", "Chemical Characterization Lab"],
        "duration": "18-24 months",
        "focus_areas": ["DeepTech", "Biotech", "HealthTech", "Clean Energy", "Manufacturing"],
        "source_url": "http://fitt-iitd.in/"
    },
    {
        "name": "91springboard Innovation Hub",
        "description": "A leading private co-working ecosystem and accelerator hub supporting high-growth private businesses.",
        "organization_type": "Private",
        "year_established": 2012,
        "website": "https://91springboard.com",
        "email": "invalid-email-placeholder", # Invalid email to test Cleaner
        "phone": "1800 121 9191",
        "linkedin": "",
        "twitter": "",
        "founder_or_head": "Anand Vemuri",
        "address": "Sector 1, Noida",
        "city": "Noida",
        "state": "UP", # State abbreviation
        "country": "India",
        "postal_code": "201301",
        "latitude": 28.5800,
        "longitude": 77.3111,
        "incubation_programs": [],
        "acceleration_programs": ["Startup Accelerator program"],
        "funding_support": "Partner VC networks",
        "equity_model": "Zero-equity (co-working model)",
        "grant_support": "",
        "mentorship_available": 1,
        "coworking_available": 1,
        "lab_facilities": [],
        "duration": "Flexible",
        "focus_areas": ["SaaS", "FinTech", "EdTech", "Web3"],
        "source_url": "https://91springboard.com"
    },
    {
        "name": "Cisco LaunchPad",
        "description": "Corporate accelerator run by Cisco systems, helping B2B startup scale using Cisco's technology and network.",
        "organization_type": "Corporate",
        "year_established": 2016,
        "website": "cisco.com/in/launchpad",
        "email": "cisco-launchpad@cisco.com",
        "phone": "",
        "linkedin": "linkedin.com/company/cisco-launchpad",
        "twitter": "@CiscoLaunchPad",
        "founder_or_head": "Sruthi Kannan",
        "address": "Cisco Campus, Cessna Business Park, Sarjapur Outer Ring Road",
        "city": "Bangalore", # Unnormalized City
        "state": "Karnataka",
        "country": "India",
        "postal_code": "560103",
        "latitude": 12.9298,
        "longitude": 77.6934,
        "incubation_programs": [],
        "acceleration_programs": ["B2B Cohort Acceleration"],
        "funding_support": "Non-dilutive funding, marketing access",
        "equity_model": "Zero-equity",
        "grant_support": "Cisco dev grants",
        "mentorship_available": 1,
        "coworking_available": 1,
        "lab_facilities": ["Cisco Dev Labs", "B2B Hardware Lab"],
        "duration": "6 months",
        "focus_areas": ["IoT", "AI", "ML", "SaaS", "DefenceTech"], # missing SpaceTech, DefenceTech
        "source_url": "https://www.cisco.com/c/m/en_in/launchpad.html"
    },
    {
        "name": "AIC-Sangam",
        "description": "An AIM-supported incubator focused on clean energy, climate action, and sustainability projects.",
        "organization_type": "Government",
        "year_established": 2018,
        "website": "https://sangam.vc",
        "email": "aic@sangam.vc",
        "phone": "",
        "linkedin": "",
        "twitter": "",
        "founder_or_head": "Kartikeya Sarabhai",
        "address": "AIC Sangam Innovation Store, DLF Phase 3",
        "city": "Gurgaon", # Unnormalized City
        "state": "HR", # State abbreviation
        "country": "India",
        "postal_code": "122002",
        "latitude": 28.4900,
        "longitude": 77.0900,
        "incubation_programs": ["CleanTech Incubation"],
        "acceleration_programs": ["Climate Change Cohort"],
        "funding_support": "Seed and Series A options",
        "equity_model": "Equity taken",
        "grant_support": "AIM Grants",
        "mentorship_available": 1,
        "coworking_available": 1,
        "lab_facilities": ["Material Testing Lab"],
        "duration": "12-18 months",
        "focus_areas": ["ClimateTech", "Clean Energy", "AgriTech"],
        "source_url": "https://sangam.vc/aic/"
    }
]

# Raw startup dataset, linked back to incubators via the incubated_at reference.
# Contains spelling mistakes and unnormalized fields.
RAW_STARTUPS = [
    {
        "startup_name": "Ideaforge Technology",
        "sector": "DefenceTech",
        "founders": ["Ankit Mehta", "Rahul Singh", "Ashish Bhat"],
        "website": "ideaforge.co.in",
        "funding_stage": "IPO",
        "hq_city": "Mumbai",
        "incubated_at": "Society for Innovation and Entrepreneurship IIT Bombay",
        "source_url": "https://sine.iitb.ac.in/portfolio"
    },
    {
        "startup_name": "IdeaForge", # DUPLICATE entity for resolution testing
        "sector": "DefenceTech & IoT",
        "founders": ["Ankit Mehta"],
        "website": "https://www.ideaforge.co.in",
        "funding_stage": "Post-IPO",
        "hq_city": "Bombay",
        "incubated_at": "SINE IIT Bombay",
        "source_url": "https://startupindia.gov.in/portal"
    },
    {
        "startup_name": "Atomberg Technologies",
        "sector": "ClimateTech",
        "founders": ["Manoj Meena", "Sibabrata Das"],
        "website": "atomberg.com",
        "funding_stage": "Series C",
        "hq_city": "Bombay",
        "incubated_at": "Society for Innovation and Entrepreneurship IIT Bombay",
        "source_url": "https://sine.iitb.ac.in/portfolio"
    },
    {
        "startup_name": "Pharmeasy",
        "sector": "HealthTech",
        "founders": ["Dharmil Sheth", "Dhaval Shah"],
        "website": "https://pharmeasy.in",
        "funding_stage": "Series F",
        "hq_city": "Mumbai",
        "incubated_at": "SINE IIT Bombay",
        "source_url": "https://sine.iitb.ac.in/portfolio"
    },
    {
        "startup_name": "Agnikul Cosmos",
        "sector": "SpaceTech",
        "founders": ["Srinath Ravichandran", "Moin SPM"],
        "website": "agnikul.in",
        "funding_stage": "Series B",
        "hq_city": "Madras",
        "incubated_at": "IITM Incubation Cell",
        "source_url": "https://www.incubation.iitm.ac.in/portfolio"
    },
    {
        "startup_name": "The ePlane Company",
        "sector": "DeepTech",
        "founders": ["Satya Chakravarthy", "Pranjal Mehta"],
        "website": "eplane.ai",
        "funding_stage": "Seed",
        "hq_city": "Chennai",
        "incubated_at": "IITM Incubation Cell",
        "source_url": "https://www.incubation.iitm.ac.in/portfolio"
    },
    {
        "startup_name": "Detect Technologies",
        "sector": "IoT",
        "founders": ["Daniel Raj David", "Harikrishnan AS"],
        "website": "detecttechnologies.com",
        "funding_stage": "Series B",
        "hq_city": "Chennai",
        "incubated_at": "IITM Incubation Cell",
        "source_url": "https://www.incubation.iitm.ac.in/portfolio"
    },
    {
        "startup_name": "Yulu",
        "sector": "Clean Energy",
        "founders": ["Amit Gupta", "RK Misra", "Naveen Dachuri"],
        "website": "https://www.yulu.bike",
        "funding_stage": "Series B",
        "hq_city": "Bangalore",
        "incubated_at": "NSRCEL IIM Bangalore",
        "source_url": "https://nsrcel.org/portfolio"
    },
    {
        "startup_name": "ElasticRun",
        "sector": "SaaS",
        "founders": ["Sandeep Deshmukh", "Saurabh Nigam", "Shitiz Bansal"],
        "website": "elasticrun.in",
        "funding_stage": "Series E",
        "hq_city": "Pune",
        "incubated_at": "NSRCEL IIM Bangalore",
        "source_url": "https://nsrcel.org/portfolio"
    },
    {
        "startup_name": "KreditBee",
        "sector": "FinTech",
        "founders": ["Madhusudan Ekambaram"],
        "website": "https://kreditbee.in",
        "funding_stage": "Series D",
        "hq_city": "Bangalore",
        "incubated_at": "Centre for Innovation Incubation and Entrepreneurship",
        "source_url": "https://ciie.co/portfolio"
    },
    {
        "startup_name": "Progcap",
        "sector": "FinTech",
        "founders": ["Pallavi Shrivastava", "Himanshu Chandra"],
        "website": "progcap.com",
        "funding_stage": "Series C",
        "hq_city": "New Delhi",
        "incubated_at": "CIIE.CO IIM Ahmedabad",
        "source_url": "https://ciie.co/portfolio"
    },
    {
        "startup_name": "LogiNext",
        "sector": "SaaS",
        "founders": ["Dhruvil Sanghvi", "Manisha Raisinghani"],
        "website": "https://loginextsolutions.com",
        "funding_stage": "Series B",
        "hq_city": "Mumbai",
        "incubated_at": "Foundation for Innovation and Technology Transfer FITT IIT Delhi",
        "source_url": "http://fitt-iitd.in/portfolio"
    }
]

RAW_MENTORS = [
    {"name": "Prof. R. G. B. Prasad", "email": "rgbprasad@iitb.ac.in", "linkedin": "linkedin.com/in/rgbprasad", "expertise": ["DeepTech", "Manufacturing"], "incubator": "Society for Innovation and Entrepreneurship IIT Bombay"},
    {"name": "Ananya Roy", "email": "ananya.r@iitm.ac.in", "linkedin": "linkedin.com/in/ananyaroy-iit", "expertise": ["SpaceTech", "Biotech"], "incubator": "IITM Incubation Cell"},
    {"name": "Venkatesh S.", "email": "venk.s@nsrcel.org", "linkedin": "linkedin.com/in/venk-s-nsrcel", "expertise": ["SaaS", "FinTech"], "incubator": "NSRCEL IIM Bangalore"},
    {"name": "Pawan Goenka", "email": "pawan@ciie.co", "linkedin": "linkedin.com/in/pawangoenka", "expertise": ["Automotive", "AgriTech", "Scaleup"], "incubator": "Centre for Innovation Incubation and Entrepreneurship"}
]

RAW_INVESTORS = [
    {"name": "Indian Angel Network", "type": "Angel Network", "email": "dealflow@indianangelnetwork.com", "linkedin": "linkedin.com/company/indian-angel-network", "investment_stage": ["Pre-Seed", "Seed", "Series A"], "portfolio_startups": ["Ideaforge Technology", "Detect Technologies"]},
    {"name": "Sequoia Capital India", "type": "VC", "email": "info@sequoiacap.com", "linkedin": "linkedin.com/company/sequoia-capital-india", "investment_stage": ["Seed", "Series A", "Series B", "Growth"], "portfolio_startups": ["Atomberg Technologies", "Pharmeasy", "Progcap"]},
    {"name": "Atal Innovation Mission Scheme", "type": "Government Scheme", "email": "aim@gov.in", "linkedin": "", "investment_stage": ["Grant", "Seed"], "portfolio_startups": ["Agnikul Cosmos", "The ePlane Company", "Yulu"]}
]

def run_scraper_pipeline():
    """Runs the scraper pipeline. This empties current database tables and inserts raw uncleaned scraped data."""
    log_pipeline_step("SCRAPE", "START", "Starting data ingestion pipeline from ecosystem sources...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Clear existing tables to reset pipeline state
        cursor.execute("DELETE FROM incubators")
        cursor.execute("DELETE FROM startups")
        cursor.execute("DELETE FROM mentors")
        cursor.execute("DELETE FROM investors")
        cursor.execute("DELETE FROM relationships")
        
        # Load from Excel
        excel_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "incubators_with_contact_details(100).xlsx")
        if not os.path.exists(excel_path):
            excel_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db01.xlsx")
        wb = openpyxl.load_workbook(excel_path, read_only=True)
        sheet = wb.active
        excel_rows = list(sheet.iter_rows(values_only=True))
        
        headers = excel_rows[0]
        data_rows = [r for r in excel_rows[1:] if r and r[0]] # Filter empty rows
        
        incubator_id_map = {}
        
        for row in data_rows:
            inc_name = row[0]
            inc_state = row[1]
            inc_city = row[2]
            inc_website = row[3]
            inc_email = row[4]
            inc_sector = row[5]
            inc_source = row[6]
            
            inc_id = f"inc_{uuid.uuid4().hex[:8]}"
            incubator_id_map[inc_name] = inc_id
            
            # Clean sectors to focus areas JSON list
            focus_list = clean_sectors(inc_sector)
            focus_areas_json = json.dumps(focus_list)
            
            # Form clean description or use default
            city_str = f" in {inc_city}" if inc_city else ""
            state_str = f", {inc_state}" if inc_state else ""
            desc = f"{inc_name} is an incubation center supported by {inc_source}{city_str}{state_str}."
            
            # Infer organization type
            org_type = "Academic"
            name_lower = inc_name.lower()
            if any(w in name_lower for w in ["college", "university", "iit", "iim", "nit", "iiit", "institute", "engineering", "technology", "campus", "academic"]):
                org_type = "Academic"
            elif any(w in name_lower for w in ["government", "department", "ministry", "board", "corporation"]):
                org_type = "Government"
            elif any(w in name_lower for w in ["pvt", "ltd", "private", "limited", "corporate", "cisco", "91springboard"]):
                org_type = "Private"
            else:
                org_type = "Government Support" if "DST" in str(inc_source) or "MeitY" in str(inc_source) else "Private"
                
            cursor.execute('''
                INSERT INTO incubators (
                    id, name, description, organization_type, year_established, website,
                    email, phone, linkedin, twitter, founder_or_head, address, city,
                    state, country, postal_code, latitude, longitude, incubation_programs,
                    acceleration_programs, funding_support, equity_model, grant_support,
                    mentorship_available, coworking_available, lab_facilities, duration,
                    focus_areas, startup_count, active_startups, confidence_score, status,
                    last_updated, source_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                inc_id,
                inc_name,
                desc,
                org_type,
                None, # Year established (not in excel)
                inc_website,
                inc_email,
                None, # Phone
                None, # Linkedin
                None, # Twitter
                None, # Founder/Head
                None, # Address
                inc_city,
                inc_state,
                "India",
                None, # Postal code
                None, # Latitude
                None, # Longitude
                json.dumps([]), # Incubation programs
                json.dumps([]), # Acceleration programs
                None, # Funding support
                None, # Equity model
                inc_source, # Grant/Source support
                1, 1, # Mentorship, Coworking
                json.dumps([]), # Lab facilities
                None, # Duration
                focus_areas_json,
                0, 0,
                0.90, # Raw confidence score
                "raw",
                datetime.now().isoformat(),
                inc_source # Source url / reference
            ))
            
        # Save raw startups
        startup_id_map = {}
        for start in RAW_STARTUPS:
            start_id = f"start_{uuid.uuid4().hex[:8]}"
            startup_id_map[start["startup_name"]] = start_id
            
            # Match incubator reference ID using fuzzy matcher
            inc_id = find_best_incubator_id(incubator_id_map, start["incubated_at"])
            
            cursor.execute('''
                INSERT INTO startups (
                    id, startup_name, sector, founders, website, funding_stage, hq_city,
                    incubated_at, incubator_id, confidence_score, status, last_updated, source_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                start_id,
                start["startup_name"],
                start["sector"],
                json.dumps(start["founders"]),
                start["website"],
                start["funding_stage"],
                start["hq_city"],
                start["incubated_at"],
                inc_id,
                0.75, # Raw confidence score
                "raw",
                datetime.now().isoformat(),
                start["source_url"]
            ))

        # Save raw mentors
        for m in RAW_MENTORS:
            m_id = f"men_{uuid.uuid4().hex[:8]}"
            inc_id = find_best_incubator_id(incubator_id_map, m["incubator"])
            cursor.execute('''
                INSERT INTO mentors (id, name, email, linkedin, expertise, incubator_id)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                m_id,
                m["name"],
                m["email"],
                m["linkedin"],
                json.dumps(m["expertise"]),
                inc_id
            ))

        # Save raw investors
        for inv in RAW_INVESTORS:
            inv_id = f"inv_{uuid.uuid4().hex[:8]}"
            cursor.execute('''
                INSERT INTO investors (id, name, type, email, linkedin, investment_stage, portfolio_startups)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                inv_id,
                inv["name"],
                inv["type"],
                inv["email"],
                inv["linkedin"],
                json.dumps(inv["investment_stage"]),
                json.dumps(inv["portfolio_startups"])
            ))

        # Save initial relationships
        # 1. Mentor -> Incubator relationships (HAS_MENTOR)
        for m in RAW_MENTORS:
            m_id = None
            res = cursor.execute("SELECT id FROM mentors WHERE name = ?", (m["name"],)).fetchone()
            if res:
                m_id = res[0]
            inc_id = find_best_incubator_id(incubator_id_map, m["incubator"])
            if m_id and inc_id:
                cursor.execute('''
                    INSERT INTO relationships (source_id, source_type, target_id, target_type, relationship_type, confidence_score, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (inc_id, "Incubator", m_id, "Mentor", "HAS_MENTOR", 0.8, json.dumps({"role": "Ecosystem Mentor"})))

        # 2. Startup -> Incubator raw relationships (INCUBATED)
        for start in RAW_STARTUPS:
            start_id = startup_id_map.get(start["startup_name"])
            inc_id = find_best_incubator_id(incubator_id_map, start["incubated_at"])
            if start_id and inc_id:
                cursor.execute('''
                    INSERT INTO relationships (source_id, source_type, target_id, target_type, relationship_type, confidence_score, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (inc_id, "Incubator", start_id, "Startup", "INCUBATED", 0.9, json.dumps({"stage": start["funding_stage"]})))

        # 3. Investor -> Startup relationships (FUNDED)
        for inv in RAW_INVESTORS:
            inv_id = None
            res = cursor.execute("SELECT id FROM investors WHERE name = ?", (inv["name"],)).fetchone()
            if res:
                inv_id = res[0]
            for port in inv["portfolio_startups"]:
                start_id = startup_id_map.get(port)
                if inv_id and start_id:
                    cursor.execute('''
                        INSERT INTO relationships (source_id, source_type, target_id, target_type, relationship_type, confidence_score, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (inv_id, "Investor", start_id, "Startup", "FUNDED", 0.85, json.dumps({"type": inv["type"]})))

        conn.commit()
        log_pipeline_step("SCRAPE", "SUCCESS", f"Successfully ingested {len(data_rows)} incubators from {os.path.basename(excel_path)}, {len(RAW_STARTUPS)} startups, {len(RAW_MENTORS)} mentors, and {len(RAW_INVESTORS)} investors.")
        return {"status": "success", "incubators": len(data_rows), "startups": len(RAW_STARTUPS)}
    except Exception as e:
        conn.rollback()
        log_pipeline_step("SCRAPE", "ERROR", f"Error during scraping/ingestion: {str(e)}")
        raise e
    finally:
        conn.close()
