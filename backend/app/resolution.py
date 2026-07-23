import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.enums.entity_type import EntityType
from app.enums.relationship import RelationshipEntityType
from app.repositories.ai_enrichment_repository import AIEnrichmentRepository
from app.repositories.city_repository import CityRepository
from app.repositories.incubator_repository import IncubatorRepository
from app.repositories.mentor_repository import MentorRepository
from app.repositories.relationship_repository import RelationshipRepository
from app.repositories.source_record_repository import SourceRecordRepository
from app.repositories.startup_repository import StartupRepository
from app.repositories.state_repository import StateRepository

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


def _list_all(repository):
    records = []
    skip = 0
    while batch := repository.list(skip=skip, limit=100):
        records.extend(batch)
        skip += len(batch)
    return records


def _group_source_records(source_records):
    grouped_records = {}
    entity_id_attributes = {
        EntityType.INCUBATOR: "incubator_id",
        EntityType.STARTUP: "startup_id",
        EntityType.MENTOR: "mentor_id",
        EntityType.INVESTOR: "investor_id",
    }
    for source_record in source_records:
        entity_id = getattr(
            source_record,
            entity_id_attributes[source_record.entity_type],
        )
        if entity_id is None:
            continue
        grouped_records.setdefault(
            (source_record.entity_type, entity_id),
            [],
        ).append(source_record)
    return grouped_records


def _build_incubator_record(
    incubator,
    source_records,
    cities_by_id,
    states_by_id,
):
    source_record = source_records[0] if source_records else None
    raw_payload = source_record.raw_payload if source_record else {}
    city = cities_by_id.get(incubator.city_id)
    state = states_by_id.get(city.state_id) if city else None

    return {
        "id": incubator.id,
        "name": incubator.name,
        "slug": incubator.slug,
        "description": incubator.description,
        "city_id": incubator.city_id,
        "organization_type": incubator.organization_type,
        "founded_year": incubator.founded_year,
        "is_active": incubator.is_active,
        "phone": raw_payload.get("phone"),
        "linkedin": (
            raw_payload.get("linkedin")
            or raw_payload.get("linkedin_url")
        ),
        "city": city.name if city else raw_payload.get("city"),
        "state": state.name if state else raw_payload.get("state"),
        "source_url": (
            source_record.source_url
            if source_record
            else raw_payload.get("source_url")
        ),
        "focus_areas": (
            raw_payload.get("focus_areas")
            or raw_payload.get("sector")
        ),
        "incubation_programs": raw_payload.get("incubation_programs"),
        "lab_facilities": raw_payload.get("lab_facilities"),
        "confidence_score": raw_payload.get("confidence_score") or 0.0,
        "status": raw_payload.get("status") or "cleaned",
        "last_updated": incubator.updated_at.isoformat(),
    }


def _build_startup_record(startup, source_records):
    source_record = source_records[0] if source_records else None
    raw_payload = source_record.raw_payload if source_record else {}

    return {
        "id": startup.id,
        "startup_name": startup.name,
        "name": startup.name,
        "slug": startup.slug,
        "incubator_id": startup.incubator_id,
        "description": startup.description,
        "founded_year": startup.founded_year,
        "funding_stage": startup.funding_stage,
        "website": startup.website,
        "is_active": startup.is_active,
        "sector": raw_payload.get("sector"),
        "confidence_score": raw_payload.get("confidence_score") or 0.0,
        "status": raw_payload.get("status") or "cleaned",
        "last_updated": startup.updated_at.isoformat(),
    }


def _find_incubator_duplicates(incubators):
    inc_duplicates = []
    resolved_inc_ids = set()

    for i in range(len(incubators)):
        for j in range(i + 1, len(incubators)):
            inc1 = incubators[i]
            inc2 = incubators[j]

            if (
                inc1["id"] in resolved_inc_ids
                or inc2["id"] in resolved_inc_ids
            ):
                continue

            sim = calculate_similarity(inc1["name"], inc2["name"])

            city1 = (inc1["city"] or "").strip().lower()
            city2 = (inc2["city"] or "").strip().lower()
            state1 = (inc1["state"] or "").strip().lower()
            state2 = (inc2["state"] or "").strip().lower()
            src1 = (inc1["source_url"] or "").strip().lower()
            src2 = (inc2["source_url"] or "").strip().lower()

            if city1 and city2 and city1 != city2:
                if city1 not in city2 and city2 not in city1:
                    sim = 0.0
            if state1 and state2 and state1 != state2:
                if state1 not in state2 and state2 not in state1:
                    sim = 0.0
            if src1 and src2 and src1 != src2:
                if src1 not in src2 and src2 not in src1:
                    sim = 0.0

            if sim >= 0.6:
                len1 = (
                    len(inc1["description"] or "")
                    + len(inc1["phone"] or "")
                    + len(inc1["linkedin"] or "")
                )
                len2 = (
                    len(inc2["description"] or "")
                    + len(inc2["phone"] or "")
                    + len(inc2["linkedin"] or "")
                )

                if len1 >= len2:
                    canon, dupe = inc1, inc2
                else:
                    canon, dupe = inc2, inc1

                inc_duplicates.append((canon, dupe))
                resolved_inc_ids.add(dupe["id"])

    return inc_duplicates


def _find_startup_duplicates(startups):
    start_duplicates = []
    resolved_start_ids = set()

    for i in range(len(startups)):
        for j in range(i + 1, len(startups)):
            s1 = startups[i]
            s2 = startups[j]

            if (
                s1["id"] in resolved_start_ids
                or s2["id"] in resolved_start_ids
            ):
                continue

            sim = calculate_similarity(
                s1["startup_name"],
                s2["startup_name"],
            )
            if sim >= 0.7:
                len1 = len(s1["website"] or "") + len(s1["sector"] or "")
                len2 = len(s2["website"] or "") + len(s2["sector"] or "")

                if len1 >= len2:
                    canon, dupe = s1, s2
                else:
                    canon, dupe = s2, s1

                start_duplicates.append((canon, dupe))
                resolved_start_ids.add(dupe["id"])

    return start_duplicates


def _resolve_final_id(entity_id, direct_mapping):
    visited = set()
    while entity_id in direct_mapping:
        if entity_id in visited:
            raise ValueError("Circular duplicate mapping detected")
        visited.add(entity_id)
        entity_id = direct_mapping[entity_id]
    return entity_id


def _build_merge_plans(records, duplicate_pairs, merge_records):
    working_records = {
        record["id"]: dict(record)
        for record in records
    }
    direct_mapping = {}

    for canon, dupe in duplicate_pairs:
        canonical_id = canon["id"]
        duplicate_id = dupe["id"]
        direct_mapping[duplicate_id] = canonical_id
        working_records[canonical_id] = merge_records(
            working_records[canonical_id],
            working_records[duplicate_id],
        )

    final_mapping = {
        duplicate_id: _resolve_final_id(duplicate_id, direct_mapping)
        for duplicate_id in direct_mapping
    }
    duplicate_groups = {}
    for duplicate_id, canonical_id in final_mapping.items():
        duplicate_groups.setdefault(canonical_id, []).append(duplicate_id)

    plans = [
        {
            "canonical_id": canonical_id,
            "duplicate_ids": duplicate_ids,
            "merged_record": working_records[canonical_id],
        }
        for canonical_id, duplicate_ids in duplicate_groups.items()
    ]
    return plans, final_mapping


def _apply_incubator_merge(incubator, merged_record):
    incubator.name = merged_record["name"]
    incubator.slug = merged_record["slug"]
    incubator.description = merged_record["description"]
    incubator.city_id = merged_record["city_id"]
    incubator.organization_type = merged_record["organization_type"]
    incubator.founded_year = merged_record["founded_year"]
    incubator.is_active = merged_record["is_active"]


def _apply_startup_merge(startup, merged_record, incubator_mapping):
    incubator_id = merged_record["incubator_id"]
    startup.incubator_id = incubator_mapping.get(
        incubator_id,
        incubator_id,
    )
    startup.name = merged_record["name"]
    startup.slug = merged_record["slug"]
    startup.description = merged_record["description"]
    startup.founded_year = merged_record["founded_year"]
    startup.funding_stage = merged_record["funding_stage"]
    startup.website = merged_record["website"]
    startup.is_active = merged_record["is_active"]


def run_resolution_pipeline(db: Session):
    incubator_repository = IncubatorRepository(db)
    startup_repository = StartupRepository(db)
    mentor_repository = MentorRepository(db)
    source_record_repository = SourceRecordRepository(db)
    ai_enrichment_repository = AIEnrichmentRepository(db)
    relationship_repository = RelationshipRepository(db)
    city_repository = CityRepository(db)
    state_repository = StateRepository(db)

    incubator_entities = _list_all(incubator_repository)
    startup_entities = _list_all(startup_repository)
    source_records = _list_all(source_record_repository)
    cities = _list_all(city_repository)
    states = _list_all(state_repository)

    source_records_by_entity = _group_source_records(source_records)
    cities_by_id = {city.id: city for city in cities}
    states_by_id = {state.id: state for state in states}

    incubator_records = [
        _build_incubator_record(
            incubator,
            source_records_by_entity.get(
                (EntityType.INCUBATOR, incubator.id),
                [],
            ),
            cities_by_id,
            states_by_id,
        )
        for incubator in incubator_entities
    ]
    startup_records = [
        _build_startup_record(
            startup,
            source_records_by_entity.get(
                (EntityType.STARTUP, startup.id),
                [],
            ),
        )
        for startup in startup_entities
    ]

    inc_duplicates = _find_incubator_duplicates(incubator_records)
    start_duplicates = _find_startup_duplicates(startup_records)
    incubator_plans, incubator_mapping = _build_merge_plans(
        incubator_records,
        inc_duplicates,
        merge_incubator_records,
    )
    startup_plans, _ = _build_merge_plans(
        startup_records,
        start_duplicates,
        merge_startup_records,
    )

    incubators_by_id = {
        incubator.id: incubator
        for incubator in incubator_entities
    }
    startups_by_id = {
        startup.id: startup
        for startup in startup_entities
    }

    for plan in incubator_plans:
        canonical = incubators_by_id[plan["canonical_id"]]
        _apply_incubator_merge(canonical, plan["merged_record"])
        incubator_repository.update(canonical)

    for plan in incubator_plans:
        canonical_id = plan["canonical_id"]
        for duplicate_id in plan["duplicate_ids"]:
            startup_repository.reassign_incubator(
                duplicate_id,
                canonical_id,
            )
            mentor_repository.reassign_incubator(
                duplicate_id,
                canonical_id,
            )
            source_record_repository.reassign_incubator(
                duplicate_id,
                canonical_id,
            )
            ai_enrichment_repository.reassign_incubator(
                duplicate_id,
                canonical_id,
            )
            relationship_repository.reassign_source(
                RelationshipEntityType.INCUBATOR,
                duplicate_id,
                canonical_id,
            )
            relationship_repository.reassign_target(
                RelationshipEntityType.INCUBATOR,
                duplicate_id,
                canonical_id,
            )

    for plan in incubator_plans:
        for duplicate_id in plan["duplicate_ids"]:
            incubator_repository.delete(incubators_by_id[duplicate_id])

    for plan in startup_plans:
        canonical = startups_by_id[plan["canonical_id"]]
        _apply_startup_merge(
            canonical,
            plan["merged_record"],
            incubator_mapping,
        )
        startup_repository.update(canonical)

    for plan in startup_plans:
        canonical_id = plan["canonical_id"]
        for duplicate_id in plan["duplicate_ids"]:
            source_record_repository.reassign_startup(
                duplicate_id,
                canonical_id,
            )
            ai_enrichment_repository.reassign_startup(
                duplicate_id,
                canonical_id,
            )
            relationship_repository.reassign_source(
                RelationshipEntityType.STARTUP,
                duplicate_id,
                canonical_id,
            )
            relationship_repository.reassign_target(
                RelationshipEntityType.STARTUP,
                duplicate_id,
                canonical_id,
            )

    for plan in startup_plans:
        for duplicate_id in plan["duplicate_ids"]:
            startup_repository.delete(startups_by_id[duplicate_id])

    relationship_repository.deduplicate_edges()

    return {
        "status": "success",
        "merged_incubators": len(inc_duplicates),
        "merged_startups": len(start_duplicates),
    }
