import ast
import os
import json
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.enums.ai_enrichment_status import AIEnrichmentStatus
from app.enums.entity_type import EntityType
from app.enums.relationship import RelationshipEntityType, RelationshipType
from app.models.ai_enrichment import AIEnrichment
from app.models.relationship import Relationship
from app.repositories.ai_enrichment_repository import AIEnrichmentRepository
from app.repositories.city_repository import CityRepository
from app.repositories.incubator_repository import IncubatorRepository
from app.repositories.relationship_repository import RelationshipRepository
from app.repositories.source_record_repository import SourceRecordRepository
from app.repositories.startup_repository import StartupRepository
from app.utils.hashing import hash_payload

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

GEMINI_PROVIDER = "Gemini"
GEMINI_MODEL = "gemini-1.5-flash"
LOCAL_PROVIDER = "Local"
LOCAL_MODEL = "keyword-classifier"
PROMPT_VERSION = "v1"
INCUBATOR_ENRICHMENT_TYPE = "incubator_sector_summary"
STARTUP_ENRICHMENT_TYPE = "startup_sector_classification"


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


def _list_all(repository):
    records = []
    skip = 0
    while batch := repository.list(skip=skip, limit=100):
        records.extend(batch)
        skip += len(batch)
    return records


def _parse_existing_focus(value):
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if item]
    if not isinstance(value, str):
        return [str(value).strip()]

    for parser in (json.loads, ast.literal_eval):
        try:
            parsed = parser(value)
            if isinstance(parsed, list):
                return [
                    str(item).strip()
                    for item in parsed
                    if item
                ]
        except (TypeError, ValueError, SyntaxError):
            continue
    return [
        item.strip()
        for item in re.split(r"[,;]", value)
        if item.strip()
    ]


def _get_confidence(raw_payload, default):
    try:
        return float(raw_payload.get("confidence_score", default))
    except (TypeError, ValueError):
        return default


def _build_input_hash(
    entity_type,
    entity_id,
    enrichment_type,
    source_record,
    entity_name,
):
    return hash_payload(
        {
            "entity_type": entity_type.value,
            "entity_id": str(entity_id),
            "enrichment_type": enrichment_type,
            "source_record_id": (
                str(source_record.id)
                if source_record
                else None
            ),
            "source_content_hash": (
                source_record.content_hash
                if source_record
                else None
            ),
            "entity_name": entity_name,
        }
    )


def _get_completed_enrichment(
    repository,
    entity_type,
    entity_id,
    provider,
    model_name,
    enrichment_type,
    input_hash,
):
    enrichment = repository.get_by_identity(
        entity_type=entity_type,
        entity_id=entity_id,
        provider=provider,
        model_name=model_name,
        enrichment_type=enrichment_type,
        prompt_version=PROMPT_VERSION,
        input_hash=input_hash,
    )
    if (
        enrichment is not None
        and enrichment.status == AIEnrichmentStatus.COMPLETED
    ):
        return enrichment
    return None


def _cached_incubator_plan(work_item, enrichment):
    parsed_output = enrichment.parsed_output
    return {
        **work_item,
        "provider": enrichment.provider,
        "model_name": enrichment.model_name,
        "description_result": parsed_output.get(
            "description",
            work_item["description"],
        ),
        "latitude_result": parsed_output.get(
            "latitude",
            work_item["latitude"],
        ),
        "longitude_result": parsed_output.get(
            "longitude",
            work_item["longitude"],
        ),
        "confidence_result": (
            enrichment.confidence
            if enrichment.confidence is not None
            else work_item["confidence"]
        ),
        "raw_response": enrichment.raw_response,
        "parsed_output": parsed_output,
        "persist_enrichment": False,
    }


def _cached_startup_plan(work_item, enrichment):
    return {
        **work_item,
        "provider": enrichment.provider,
        "model_name": enrichment.model_name,
        "sector_result": enrichment.parsed_output.get("primary_sector"),
        "confidence_result": (
            enrichment.confidence
            if enrichment.confidence is not None
            else work_item["confidence"]
        ),
        "raw_response": enrichment.raw_response,
        "parsed_output": enrichment.parsed_output,
        "persist_enrichment": False,
    }


def run_enricher_pipeline(db: Session):
    api_key = os.environ.get("GEMINI_API_KEY")

    incubator_repository = IncubatorRepository(db)
    startup_repository = StartupRepository(db)
    city_repository = CityRepository(db)
    source_record_repository = SourceRecordRepository(db)
    ai_enrichment_repository = AIEnrichmentRepository(db)
    relationship_repository = RelationshipRepository(db)

    incubators = sorted(
        _list_all(incubator_repository),
        key=lambda incubator: incubator.id,
    )
    startups = sorted(
        _list_all(startup_repository),
        key=lambda startup: startup.id,
    )

    incubator_work = []
    for index, incubator in enumerate(incubators):
        source_record = source_record_repository.get_latest_by_entity(
            EntityType.INCUBATOR,
            incubator.id,
        )
        raw_payload = (
            source_record.raw_payload
            if source_record
            else {}
        )
        city = city_repository.get_by_id(incubator.city_id)
        description = incubator.description or ""
        use_gemini = bool(
            api_key
            and (description or incubator.name)
            and index < 20
        )
        provider = GEMINI_PROVIDER if use_gemini else LOCAL_PROVIDER
        model_name = GEMINI_MODEL if use_gemini else LOCAL_MODEL
        input_hash = _build_input_hash(
            EntityType.INCUBATOR,
            incubator.id,
            INCUBATOR_ENRICHMENT_TYPE,
            source_record,
            incubator.name,
        )
        cached = _get_completed_enrichment(
            ai_enrichment_repository,
            EntityType.INCUBATOR,
            incubator.id,
            provider,
            model_name,
            INCUBATOR_ENRICHMENT_TYPE,
            input_hash,
        )
        work_item = {
            "entity": incubator,
            "entity_type": EntityType.INCUBATOR,
            "city": city,
            "description": description,
            "name": incubator.name,
            "latitude": city.latitude if city else None,
            "longitude": city.longitude if city else None,
            "city_name": city.name if city else None,
            "existing_focus": set(
                _parse_existing_focus(
                    raw_payload.get("focus_areas")
                    or raw_payload.get("sector")
                )
            ),
            "confidence": _get_confidence(raw_payload, 0.90),
            "input_hash": input_hash,
            "use_gemini": use_gemini,
        }
        if cached is not None:
            incubator_work.append(
                _cached_incubator_plan(work_item, cached)
            )
        else:
            incubator_work.append(work_item)

    startup_work = []
    for index, startup in enumerate(startups):
        source_record = source_record_repository.get_latest_by_entity(
            EntityType.STARTUP,
            startup.id,
        )
        raw_payload = (
            source_record.raw_payload
            if source_record
            else {}
        )
        sector = raw_payload.get("sector") or ""
        use_gemini = bool(
            api_key
            and (sector or startup.name)
            and index < 20
        )
        provider = GEMINI_PROVIDER if use_gemini else LOCAL_PROVIDER
        model_name = GEMINI_MODEL if use_gemini else LOCAL_MODEL
        input_hash = _build_input_hash(
            EntityType.STARTUP,
            startup.id,
            STARTUP_ENRICHMENT_TYPE,
            source_record,
            startup.name,
        )
        cached = _get_completed_enrichment(
            ai_enrichment_repository,
            EntityType.STARTUP,
            startup.id,
            provider,
            model_name,
            STARTUP_ENRICHMENT_TYPE,
            input_hash,
        )
        work_item = {
            "entity": startup,
            "entity_type": EntityType.STARTUP,
            "name": startup.name,
            "sector": sector,
            "confidence": _get_confidence(raw_payload, 0.75),
            "input_hash": input_hash,
            "use_gemini": use_gemini,
        }
        if cached is not None:
            startup_work.append(
                _cached_startup_plan(work_item, cached)
            )
        else:
            startup_work.append(work_item)

    # Complete all external calls before beginning any PostgreSQL writes.
    incubator_plans = []
    for work_item in incubator_work:
        if "persist_enrichment" in work_item:
            incubator_plans.append(work_item)
            continue

        gemini_result = None
        if work_item["use_gemini"]:
            gemini_result = call_gemini_enrichment(
                api_key,
                f"{work_item['name']}: {work_item['description']}",
                "incubator",
            )

        description = work_item["description"]
        confidence_score = work_item["confidence"]
        if gemini_result:
            provider = GEMINI_PROVIDER
            model_name = GEMINI_MODEL
            inferred_focus = gemini_result.get("sectors", [])
            if gemini_result.get("summary"):
                description = gemini_result["summary"]
            confidence_score = min(
                0.99,
                (
                    confidence_score
                    + gemini_result.get("confidence", 0.90)
                )
                / 2,
            )
            raw_response = gemini_result
        else:
            provider = LOCAL_PROVIDER
            model_name = LOCAL_MODEL
            cached = _get_completed_enrichment(
                ai_enrichment_repository,
                EntityType.INCUBATOR,
                work_item["entity"].id,
                provider,
                model_name,
                INCUBATOR_ENRICHMENT_TYPE,
                work_item["input_hash"],
            )
            if cached is not None:
                incubator_plans.append(
                    _cached_incubator_plan(work_item, cached)
                )
                continue
            inferred_focus = rule_based_enrichment(
                description + " " + work_item["name"]
            )
            confidence_score = min(0.98, confidence_score + 0.05)
            raw_response = {}

        latitude = work_item["latitude"]
        longitude = work_item["longitude"]
        if (
            (not latitude or not longitude)
            and work_item["city_name"] in CITY_COORDINATES
        ):
            latitude, longitude = CITY_COORDINATES[
                work_item["city_name"]
            ]

        merged_focus = list(
            work_item["existing_focus"].union(set(inferred_focus))
        )
        parsed_output = {
            "description": description,
            "sectors": merged_focus,
            "inferred_sectors": inferred_focus,
            "latitude": latitude,
            "longitude": longitude,
        }
        incubator_plans.append(
            {
                **work_item,
                "provider": provider,
                "model_name": model_name,
                "description_result": description,
                "latitude_result": latitude,
                "longitude_result": longitude,
                "confidence_result": confidence_score,
                "raw_response": raw_response,
                "parsed_output": parsed_output,
                "persist_enrichment": True,
            }
        )

    startup_plans = []
    for work_item in startup_work:
        if "persist_enrichment" in work_item:
            startup_plans.append(work_item)
            continue

        gemini_result = None
        if work_item["use_gemini"]:
            gemini_result = call_gemini_enrichment(
                api_key,
                (
                    f"Startup Name: {work_item['name']}, "
                    f"Raw Sector Tag: {work_item['sector']}"
                ),
                "startup",
            )

        confidence_score = work_item["confidence"]
        if gemini_result:
            provider = GEMINI_PROVIDER
            model_name = GEMINI_MODEL
            inferred_sectors = gemini_result.get("sectors", [])
            confidence_score = min(
                0.99,
                (
                    confidence_score
                    + gemini_result.get("confidence", 0.90)
                )
                / 2,
            )
            raw_response = gemini_result
        else:
            provider = LOCAL_PROVIDER
            model_name = LOCAL_MODEL
            cached = _get_completed_enrichment(
                ai_enrichment_repository,
                EntityType.STARTUP,
                work_item["entity"].id,
                provider,
                model_name,
                STARTUP_ENRICHMENT_TYPE,
                work_item["input_hash"],
            )
            if cached is not None:
                startup_plans.append(
                    _cached_startup_plan(work_item, cached)
                )
                continue
            inferred_sectors = rule_based_enrichment(
                work_item["sector"] + " " + work_item["name"]
            )
            confidence_score = min(0.98, confidence_score + 0.05)
            raw_response = {}

        new_sector = work_item["sector"]
        if inferred_sectors:
            new_sector = inferred_sectors[0]
        else:
            new_sector = (
                work_item["sector"].title()
                if work_item["sector"]
                else "General Startup"
            )
        parsed_output = {
            "primary_sector": new_sector,
            "inferred_sectors": inferred_sectors,
            "raw_sector": work_item["sector"],
        }
        startup_plans.append(
            {
                **work_item,
                "provider": provider,
                "model_name": model_name,
                "sector_result": new_sector,
                "confidence_result": confidence_score,
                "raw_response": raw_response,
                "parsed_output": parsed_output,
                "persist_enrichment": True,
            }
        )

    processed_at = datetime.now(timezone.utc)
    for plan in incubator_plans:
        incubator = plan["entity"]
        if plan["persist_enrichment"]:
            ai_enrichment_repository.create_or_update_by_identity(
                AIEnrichment(
                    provider=plan["provider"],
                    model_name=plan["model_name"],
                    enrichment_type=INCUBATOR_ENRICHMENT_TYPE,
                    prompt_version=PROMPT_VERSION,
                    input_hash=plan["input_hash"],
                    raw_response=plan["raw_response"],
                    parsed_output=plan["parsed_output"],
                    confidence=plan["confidence_result"],
                    status=AIEnrichmentStatus.COMPLETED,
                    processed_at=processed_at,
                    incubator_id=incubator.id,
                )
            )

        if incubator.description != plan["description_result"]:
            incubator.description = plan["description_result"]
            incubator_repository.update(incubator)

        city = plan["city"]
        if city is not None and (
            city.latitude != plan["latitude_result"]
            or city.longitude != plan["longitude_result"]
        ):
            city.latitude = plan["latitude_result"]
            city.longitude = plan["longitude_result"]
            city_repository.update(city)

    for plan in startup_plans:
        startup = plan["entity"]
        if plan["persist_enrichment"]:
            ai_enrichment_repository.create_or_update_by_identity(
                AIEnrichment(
                    provider=plan["provider"],
                    model_name=plan["model_name"],
                    enrichment_type=STARTUP_ENRICHMENT_TYPE,
                    prompt_version=PROMPT_VERSION,
                    input_hash=plan["input_hash"],
                    raw_response=plan["raw_response"],
                    parsed_output=plan["parsed_output"],
                    confidence=plan["confidence_result"],
                    status=AIEnrichmentStatus.COMPLETED,
                    processed_at=processed_at,
                    startup_id=startup.id,
                )
            )

        sector = plan["sector_result"]
        if sector and not relationship_repository.exists_edge(
            source_type=RelationshipEntityType.STARTUP,
            source_id=startup.id,
            relationship_type=RelationshipType.BELONGS_TO_SECTOR,
            target_type=RelationshipEntityType.SECTOR,
            target_value=sector,
        ):
            relationship_repository.create(
                Relationship(
                    source_type=RelationshipEntityType.STARTUP,
                    source_id=startup.id,
                    relationship_type=RelationshipType.BELONGS_TO_SECTOR,
                    target_type=RelationshipEntityType.SECTOR,
                    target_value=sector,
                    confidence=Decimal(
                        str(plan["confidence_result"])
                    ),
                )
            )

    return {
        "status": "success",
        "enriched_incubators": len(incubators),
        "enriched_startups": len(startups),
    }
