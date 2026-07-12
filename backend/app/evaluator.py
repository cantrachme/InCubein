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

def evaluate_llm(startup: Dict[str, Any]) -> Dict[str, Any]:
    prompt = f"""
    You are an expert venture capitalist and startup incubator evaluator for the INCUBEIN Startup Program.
    Evaluate the following startup application based ONLY on the non-PII fields:
    
    Sector: {startup.get('sector')}
    Stage: {startup.get('stage')}
    Team Size: {startup.get('team_size')}
    Competitors: {startup.get('competitors')}
    Business Summary: {startup.get('business_summary')}
    
    Please rate the startup out of 20 points for each of the following 5 criteria:
    1. innovation: Originality, unique value proposition, technology defensibility.
    2. market: Market size, target audience, commercial viability.
    3. scalability: Potential to scale, business model viability, growth rate potential.
    4. execution: Team capabilities, product stage, execution feasibility.
    5. problem: Pain point severity, customer demand, clarity of problem statement.
    
    Provide:
    1. A list of 2-3 key Strengths.
    2. A list of 2-3 key Weaknesses/Risks.
    3. A final Recommendation (one of: "Highly Recommended", "Recommended", "Consider with Reservations", "Not Recommended").
    
    Respond ONLY with a valid JSON object matching this schema:
    {{
        "innovation": 18,
        "market": 15,
        "scalability": 16,
        "execution": 14,
        "problem": 17,
        "strengths": ["Strength 1", "Strength 2"],
        "weaknesses": ["Weakness 1", "Weakness 2"],
        "recommendation": "Highly Recommended"
    }}
    """

    # 1. Try OpenRouter First
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    if openrouter_key and "your_openrouter" not in openrouter_key:
        import requests
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
                    timeout=15
                )
                if response.status_code == 200:
                    result_data = response.json()
                    result_text = result_data["choices"][0]["message"]["content"].strip()
                    
                    if "```json" in result_text:
                        result_text = result_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in result_text:
                        try:
                            result_text = result_text.split("```")[1].split("```")[0].strip()
                        except:
                            pass
                    
                    res = json.loads(result_text)
                    total_llm_score = (
                        res.get("innovation", 0) +
                        res.get("market", 0) +
                        res.get("scalability", 0) +
                        res.get("execution", 0) +
                        res.get("problem", 0)
                    )
                    res["llm_score"] = float(total_llm_score)
                    print(f"OpenRouter evaluated successfully using {model}.")
                    return res
            except Exception as or_err:
                print(f"OpenRouter model {model} failed: {or_err}")

    # 2. Try Gemini Library Fallback
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key and "your_gemini" not in gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            response = model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            res = json.loads(text)
            total_llm_score = (
                res.get("innovation", 0) +
                res.get("market", 0) +
                res.get("scalability", 0) +
                res.get("execution", 0) +
                res.get("problem", 0)
            )
            res["llm_score"] = float(total_llm_score)
            print("Gemini evaluated successfully.")
            return res
        except Exception as e:
            print(f"Error in Gemini library evaluation fallback: {e}")

    # 3. Final Fallback to Skipped State
    print("AI keys failed or missing, skipping AI analysis.")
    return {
        "innovation": 0,
        "market": 0,
        "scalability": 0,
        "execution": 0,
        "problem": 0,
        "strengths": ["AI analysis skipped / unavailable"],
        "weaknesses": [],
        "recommendation": "Pending review",
        "llm_score": 0.0
    }



def get_mock_llm_evaluation(startup: Dict[str, Any]) -> Dict[str, Any]:
    summary = startup.get("business_summary", "").lower()
    sector = startup.get("sector", "").lower()
    
    innovation = 12
    market = 13
    scalability = 12
    execution = 13
    problem = 14
    
    strengths = ["Clever concept in sector", "Has clear team structure"]
    weaknesses = ["Needs market validation", "Early stage market dynamics"]
    
    if "ai" in summary or "ml" in summary or "intelligence" in summary:
        innovation = 17
        market = 16
        scalability = 17
        strengths = ["Leverages AI/ML for automated operations", "Scalable product-led growth model", "Low initial capital expenditure"]
        weaknesses = ["High data dependency", "Highly competitive AI space"]
    elif "health" in sector or "medical" in sector:
        problem = 18
        market = 15
        scalability = 14
        strengths = ["Addresses high-impact healthcare pain points", "Strong social and economic value", "Experienced founder interest"]
        weaknesses = ["Regulatory approvals could slow progress", "Long sales cycle to hospitals"]
    elif "agri" in sector or "farm" in summary:
        market = 16
        execution = 15
        problem = 17
        strengths = ["Targets large underserved rural market", "Direct-to-farmer support channel", "Simple localized solution"]
        weaknesses = ["High logistics overhead", "Seasonal and weather dependency"]
        
    total = innovation + market + scalability + execution + problem
    recommendation = "Recommended"
    if total >= 80:
        recommendation = "Highly Recommended"
    elif total < 65:
        recommendation = "Consider with Reservations"
        
    return {
        "innovation": innovation,
        "market": market,
        "scalability": scalability,
        "execution": execution,
        "problem": problem,
        "strengths": strengths,
        "weaknesses": weaknesses,
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
