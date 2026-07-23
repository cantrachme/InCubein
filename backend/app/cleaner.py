import re

from sqlalchemy.orm import Session

from app.enums.entity_type import EntityType
from app.enums.source_status import SourceStatus
from app.models.city import City
from app.models.state import State
from app.repositories.city_repository import CityRepository
from app.repositories.incubator_repository import IncubatorRepository
from app.repositories.investor_repository import InvestorRepository
from app.repositories.mentor_repository import MentorRepository
from app.repositories.source_record_repository import SourceRecordRepository
from app.repositories.startup_repository import StartupRepository
from app.repositories.state_repository import StateRepository

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

def run_cleaner_pipeline(db: Session):
    incubator_repository = IncubatorRepository(db)
    startup_repository = StartupRepository(db)
    mentor_repository = MentorRepository(db)
    investor_repository = InvestorRepository(db)
    source_record_repository = SourceRecordRepository(db)
    state_repository = StateRepository(db)
    city_repository = CityRepository(db)

    cleaned_incubators_count = 0
    skip = 0
    while incubators := incubator_repository.list(skip=skip, limit=100):
        skip += len(incubators)
        for incubator in incubators:
            source_records = source_record_repository.list_by_entity(
                EntityType.INCUBATOR,
                incubator.id,
            )
            if not source_records:
                continue

            for source_record in source_records:
                raw_payload = source_record.raw_payload
                clean_state = normalize_state(raw_payload.get("state"))
                clean_city = normalize_city(raw_payload.get("city"))
                validate_email(raw_payload.get("email"))
                normalize_url(raw_payload.get("website"))

                if clean_state and clean_city:
                    state = state_repository.get_by_name("IN", clean_state)
                    if state is None:
                        state_code = clean_state.upper()
                        state = state_repository.get_by_code("IN", state_code)
                    if state is None:
                        state = state_repository.create(
                            State(
                                name=clean_state,
                                code=clean_state.upper(),
                                country_code="IN",
                            )
                        )

                    city = city_repository.get_by_state_and_name(
                        state.id,
                        clean_city,
                    )
                    if city is None:
                        city = city_repository.create(
                            City(
                                state_id=state.id,
                                name=clean_city,
                            )
                        )

                    if incubator.city_id != city.id:
                        incubator.city_id = city.id
                        incubator_repository.update(incubator)

                source_record.status = SourceStatus.PROCESSED
                source_record_repository.update(source_record)

            cleaned_incubators_count += 1

    cleaned_startups_count = 0
    skip = 0
    while startups := startup_repository.list(skip=skip, limit=100):
        skip += len(startups)
        for startup in startups:
            source_records = source_record_repository.list_by_entity(
                EntityType.STARTUP,
                startup.id,
            )
            if not source_records:
                continue

            for source_record in source_records:
                raw_payload = source_record.raw_payload
                normalize_city(raw_payload.get("hq_city"))
                clean_website = normalize_url(raw_payload.get("website"))
                if startup.website != clean_website:
                    startup.website = clean_website
                    startup_repository.update(startup)

                source_record.status = SourceStatus.PROCESSED
                source_record_repository.update(source_record)

            cleaned_startups_count += 1

    skip = 0
    while investors := investor_repository.list(skip=skip, limit=100):
        skip += len(investors)
        for investor in investors:
            source_records = source_record_repository.list_by_entity(
                EntityType.INVESTOR,
                investor.id,
            )
            for source_record in source_records:
                clean_email = validate_email(
                    source_record.raw_payload.get("email")
                )
                if investor.email != clean_email:
                    investor.email = clean_email
                    investor_repository.update(investor)

                source_record.status = SourceStatus.PROCESSED
                source_record_repository.update(source_record)

    skip = 0
    while mentors := mentor_repository.list(skip=skip, limit=100):
        skip += len(mentors)
        for mentor in mentors:
            source_records = source_record_repository.list_by_entity(
                EntityType.MENTOR,
                mentor.id,
            )
            for source_record in source_records:
                clean_email = validate_email(
                    source_record.raw_payload.get("email")
                )
                if mentor.email != clean_email:
                    mentor.email = clean_email
                    mentor_repository.update(mentor)

                source_record.status = SourceStatus.PROCESSED
                source_record_repository.update(source_record)

    return {
        "status": "success",
        "cleaned_incubators": cleaned_incubators_count,
        "cleaned_startups": cleaned_startups_count,
    }
