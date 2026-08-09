from typing import List, Optional

from pydantic import BaseModel


class UpdatePriorityRequest(BaseModel):
    app_id: str
    priority: str


class AddCohortToEcosystemRequest(BaseModel):
    app_ids: List[str]
    all: bool


class ScrapeEnrichRequest(BaseModel):
    entity_name: str
    entity_type: str = "incubator"  # "incubator" | "startup"
    city: str = ""
    state: str = ""


class BatchEnrichRequest(BaseModel):
    entity_names: List[str]
    entity_type: str = "incubator"
    city: str = ""
    state: str = ""


class SaveEnrichedRequest(BaseModel):
    entity_type: str = "incubator"
    results: List[dict] = []


class AddIncubatorsToEcosystemRequest(BaseModel):
    app_ids: List[str]
    all: bool


class MilestoneRequest(BaseModel):
    lead_id: str
    milestone_title: str
    milestone_day: int  # e.g. 7, 30, 60, 90
    meeting_date: str
    meeting_link: str = "Google Meet"
    notes: str = ""


class SeedRejectionRequest(BaseModel):
    app_ids: List[str] = []
    all_non_shortlisted: bool = False
