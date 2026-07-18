import os
import re
import json
import base64
from typing import List, Dict, Any, Tuple
import openpyxl
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# Setup Fernet Encryption Key
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # Generate and save to env
    key = Fernet.generate_key().decode()
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "a") as f:
                f.write(f"\nENCRYPTION_KEY={key}\n")
        except Exception as e:
            print(f"Error writing ENCRYPTION_KEY to .env: {e}")
    os.environ["ENCRYPTION_KEY"] = key
    ENCRYPTION_KEY = key

cipher = Fernet(ENCRYPTION_KEY.encode())

def encrypt_val(val: Any) -> str:
    if val is None:
        return ""
    val_str = str(val).strip()
    if not val_str:
        return ""
    return cipher.encrypt(val_str.encode()).decode()

def decrypt_val(val: str) -> str:
    if not val:
        return ""
    try:
        return cipher.decrypt(val.encode()).decode()
    except Exception:
        return val # Fallback if decryption fails or if it wasn't encrypted

def clean_revenue(rev_str: Any) -> float:
    if rev_str is None:
        return 0.0
    s = str(rev_str).strip().lower()
    if not s or s in ["none", "na", "n/a", "no", "nil", "0", "zero"]:
        return 0.0
    
    # Remove currency symbols, spaces, commas
    s = re.sub(r"[₹$,\s]", "", s)
    
    multiplier = 1.0
    if "lakh" in s or "l" in s:
        multiplier = 100000.0
        s = re.sub(r"[a-z]", "", s)
    elif "crore" in s or "cr" in s:
        multiplier = 10000000.0
        s = re.sub(r"[a-z]", "", s)
        
    try:
        # Extract first decimal number found
        match = re.search(r"[-+]?\d*\.\d+|\d+", s)
        if match:
            return float(match.group()) * multiplier
        return 0.0
    except ValueError:
        return 0.0

def clean_team_size(team_str: Any) -> int:
    if team_str is None:
        return 1
    s = str(team_str).strip()
    if not s:
        return 1
    # Extract first integer
    match = re.search(r"\d+", s)
    if match:
        return int(match.group())
    return 1

def clean_dpiit(dpiit_str: Any) -> Tuple[bool, str]:
    if dpiit_str is None:
        return False, ""
    s = str(dpiit_str).strip()
    s_lower = s.lower()
    if not s_lower or s_lower in ["no", "none", "na", "n/a", "false"]:
        return False, ""
    
    match = re.search(r"\d+", s)
    dpiit_num = match.group() if match else s
    return True, dpiit_num

def map_excel_headers(headers: List[str]) -> Dict[str, int]:
    mapping = {}
    header_patterns = {
        "email": [r"email"],
        "name": [r"name\s*\(", r"^name$"],
        "mobile": [r"mobile\s*number", r"^mobile$"],
        "alternet_mobile": [r"alternet", r"alternative.*mobile"],
        "dob": [r"date\s*of\s*birth", r"dob"],
        "gender": [r"gender"],
        "address": [r"address"],
        "city_state": [r"city\s*&\s*state", r"city", r"state"],
        "highest_qualification": [r"highest\s*qualification"],
        "school_university": [r"school", r"college", r"university"],
        "how_found_out": [r"how\s*did\s*you\s*find\s*out"],
        "startup_name": [r"name\s*of\s*startup", r"company/idea\s*name", r"startup.*name"],
        "year_established": [r"year\s*of\s*establishment"],
        "sector": [r"sector"],
        "team_size": [r"team\s*members", r"team\s*size"],
        "company_registered_name": [r"company\s*name\s*\("],
        "comments": [r"comments\s*or\s*questions"],
        "dpiit_registered": [r"dpiit\s*registered"],
        "website": [r"website", r"share\s*the\s*url", r"website.*url"],
        "applied_other": [r"applied\s*to\s*any\s*other\s*incubator"],
        "litigation": [r"litigation"],
        "business_summary": [r"summary\s*of\s*your\s*business\s*idea", r"business\s*summary"],
        "competitors": [r"competitors"],
        "revenue": [r"revenue"],
        "pitch_deck_url": [r"presentation", r"pitch\s*deck"],
        "stage": [r"stage\s*of\s*startup", r"^stage$"],
        "legal_entity": [r"legal\s*entity\s*type"],
        "logo_url": [r"company\s*logo"],
        "applying_for": [r"what\s*are\s*you\s*applying\s*for"]
    }
    
    for key, patterns in header_patterns.items():
        for i, h in enumerate(headers):
            if h is None:
                continue
            h_str = str(h).strip().lower()
            for pat in patterns:
                if re.search(pat, h_str):
                    mapping[key] = i
                    break
            if key in mapping:
                break
                
    return mapping

def evaluate_rules(startup: Dict[str, Any]) -> Tuple[float, Dict[str, Any]]:
    scores = {}
    
    # 1. Revenue score (max 10)
    rev = startup.get("revenue", 0.0)
    if rev == 0:
        scores["revenue"] = 0
    elif rev <= 500000: # up to 5 Lakhs
        scores["revenue"] = 5
    elif rev <= 2000000: # up to 20 Lakhs
        scores["revenue"] = 8
    else:
        scores["revenue"] = 10
        
    # 2. Stage score (max 10)
    stage = str(startup.get("stage", "")).strip().lower()
    if "mvp" in stage:
        scores["stage"] = 8
    elif "traction" in stage or "revenue" in stage or "growth" in stage or "scaling" in stage:
        scores["stage"] = 10
    elif "idea" in stage or "concept" in stage:
        scores["stage"] = 4
    elif "prototype" in stage:
        scores["stage"] = 6
    else:
        scores["stage"] = 5
        
    # 3. DPIIT score (max 5)
    dpiit = startup.get("dpiit", False)
    scores["dpiit"] = 5 if dpiit else 0
    
    # 4. Team score (max 5)
    size = startup.get("team_size", 1)
    if size == 1:
        scores["team_size"] = 2
    elif 2 <= size <= 4:
        scores["team_size"] = 4
    else:
        scores["team_size"] = 5
        
    # 5. Website score (max 5)
    website = str(startup.get("website", "")).strip()
    if website and (website.startswith("http") or "." in website):
        scores["website"] = 5
    else:
        scores["website"] = 0
        
    # 6. Pitch deck score (max 5)
    pitch = str(startup.get("pitch_deck_url", "")).strip()
    if pitch and ("http" in pitch or len(pitch) > 5):
        scores["pitch_deck"] = 5
    else:
        scores["pitch_deck"] = 0
        
    total_score = sum(scores.values()) # Max is 40
    normalized_score = (total_score / 40.0) * 100.0
    
    return round(normalized_score, 1), scores

def evaluate_advanced_heuristics(startup: Dict[str, Any]) -> Dict[str, Any]:
    """
    Advanced Non-AI heuristic engine to evaluate a startup.
    Returns the same schema as the LLM would.
    """
    summary = str(startup.get("business_summary") or "").lower()
    sector = str(startup.get("sector") or "").lower()
    competitors = str(startup.get("competitors") or "").lower()
    team_size = int(startup.get("team_size") or 1)
    revenue = float(startup.get("revenue") or 0.0)
    stage = str(startup.get("stage") or "").lower()
    website = str(startup.get("website") or "").strip()
    dpiit = startup.get("dpiit", False)
    
    innovation = 10
    market = 10
    scalability = 10
    execution = 10
    problem = 10
    
    strengths = []
    weaknesses = []
    
    # 1. Market & Scalability
    if "tech" in sector or "ai" in sector or "ml" in sector or "software" in sector or "saas" in sector:
        market += 4
        scalability += 5
        strengths.append("High-growth potential tech sector")
    elif "health" in sector or "medical" in sector or "agri" in sector or "climate" in sector:
        market += 5
        scalability += 3
        strengths.append("Addresses critical, large-scale sector")
    else:
        market += 2
        scalability += 2
        
    if competitors and len(competitors) > 5 and "none" not in competitors:
        market += 3
        strengths.append("Aware of competitive landscape")
    else:
        weaknesses.append("Lack of competitor awareness or no clear competitors mentioned")
        
    # 2. Innovation & Problem
    if "ai " in summary or "ml " in summary or "patent" in summary or "proprietary" in summary:
        innovation += 6
        strengths.append("Strong focus on innovation/IP")
    elif len(summary.split()) > 30:
        innovation += 3
        problem += 4
        strengths.append("Detailed business summary and problem statement")
    else:
        weaknesses.append("Vague or overly brief business summary")
        
    if dpiit:
        innovation += 2
        problem += 3
        strengths.append("DPIIT Recognized (Validated startup)")
        
    # 3. Execution (Traction & Readiness)
    if revenue > 0:
        execution += 8
        strengths.append("Demonstrated revenue traction")
    elif "revenue" in stage or "traction" in stage or "growth" in stage:
        execution += 6
        strengths.append("Reported traction stage")
    elif "mvp" in stage or "prototype" in stage:
        execution += 4
        strengths.append("Product development is underway")
    else:
        weaknesses.append("Early stage with unproven execution")
        
    if team_size > 1:
        execution += 2
        strengths.append("Has a co-founding team/multiple members")
    else:
        weaknesses.append("Solo founder risk")
        
    if website:
        scalability += 2
    else:
        weaknesses.append("Lacks digital presence (no website)")
        
    # Cap scores at 20
    innovation = min(20, innovation)
    market = min(20, market)
    scalability = min(20, scalability)
    execution = min(20, execution)
    problem = min(20, problem)
    
    total = innovation + market + scalability + execution + problem
    
    if total >= 80:
        recommendation = "Highly Recommended"
    elif total >= 65:
        recommendation = "Recommended"
    elif total >= 50:
        recommendation = "Consider with Reservations"
    else:
        recommendation = "Not Recommended"
        
    if not strengths:
        strengths.append("No distinct strengths identified from provided data")
    if not weaknesses:
        weaknesses.append("No obvious weaknesses detected")
        
    return {
        "innovation": innovation,
        "market": market,
        "scalability": scalability,
        "execution": execution,
        "problem": problem,
        "strengths": strengths[:3],
        "weaknesses": weaknesses[:3],
        "recommendation": recommendation,
        "llm_score": float(total)
    }

def compute_similarity_matrix(startups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    summaries = [s.get("business_summary", "") for s in startups]
    n = len(startups)
    
    for s in startups:
        s["similarity_matches"] = []
        
    if n <= 1:
        return startups
        
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        
        valid_indices = [i for i, text in enumerate(summaries) if text.strip()]
        if len(valid_indices) <= 1:
            return startups
            
        valid_summaries = [summaries[i] for i in valid_indices]
        
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(valid_summaries)
        sim_matrix = cosine_similarity(tfidf_matrix, tfidf_matrix)
        
        for i in range(len(valid_indices)):
            orig_idx = valid_indices[i]
            for j in range(len(valid_indices)):
                if i == j:
                    continue
                score = sim_matrix[i][j]
                if score >= 0.4: # Log significant matches
                    other_idx = valid_indices[j]
                    startups[orig_idx]["similarity_matches"].append({
                        "startup_name": startups[other_idx].get("startup_name", "Unknown"),
                        "similarity_score": round(float(score) * 100, 1)
                    })
    except Exception as e:
        print(f"Error computing TF-IDF similarity, using fallback string overlap: {e}")
        for i in range(n):
            words_i = set(re.findall(r"\w+", summaries[i].lower()))
            if not words_i:
                continue
            for j in range(n):
                if i == j:
                    continue
                words_j = set(re.findall(r"\w+", summaries[j].lower()))
                if not words_j:
                    continue
                intersection = words_i.intersection(words_j)
                union = words_i.union(words_j)
                score = len(intersection) / len(union) if union else 0.0
                if score >= 0.3:
                    startups[i]["similarity_matches"].append({
                        "startup_name": startups[j].get("startup_name", "Unknown"),
                        "similarity_score": round(score * 100, 1)
                    })
                    
    for s in startups:
        s["similarity_matches"].sort(key=lambda x: x["similarity_score"], reverse=True)
        
    return startups
