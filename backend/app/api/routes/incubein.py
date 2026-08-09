from fastapi import APIRouter, UploadFile, File, Form, Query
from typing import Optional

from ...schemas.incubein import (
    UpdatePriorityRequest,
    AddCohortToEcosystemRequest,
    ScrapeEnrichRequest,
    BatchEnrichRequest,
    SaveEnrichedRequest,
    AddIncubatorsToEcosystemRequest,
    MilestoneRequest,
    SeedRejectionRequest,
)
from ...services import (
    process_cohort_excel,
    get_applications,
    delete_applications,
    update_application_priority,
    add_cohort_to_database,
    add_cohort_to_campaigns,
    clear_startup_campaigns,
    clear_incubators_directory,
    clear_startups_directory,
    scrape_and_enrich_entity,
    batch_enrich_entities,
    enrich_from_excel,
    save_enriched_to_db,
    add_incubator_cohort_to_db,
    get_nurture_loop_entities,
    add_nurture_milestone,
    process_seed_support_rejections,
)

router = APIRouter()


@router.post("/api/incubein/upload")
async def upload_cohort_excel(
    file: UploadFile = File(...),
    entity_type: str = Form("startup"),
):
    contents = await file.read()
    return process_cohort_excel(contents, entity_type)


@router.get("/api/incubein/applications")
def api_get_incubein_applications(entity_type: Optional[str] = Query(None)):
    return get_applications(entity_type)


@router.post("/api/incubein/delete")
def api_delete_incubein_applications():
    return delete_applications()


@router.post("/api/incubein/applications/priority")
def api_update_application_priority(req: UpdatePriorityRequest):
    return update_application_priority(req)


@router.post("/api/incubein/add-to-db")
def api_add_cohort_to_database(req: AddCohortToEcosystemRequest):
    return add_cohort_to_database(req)


@router.post("/api/incubein/add-to-campaigns")
def api_add_cohort_to_campaigns(req: AddCohortToEcosystemRequest):
    return add_cohort_to_campaigns(req)


@router.post("/api/outreach/clear-startups")
def api_clear_startup_campaigns():
    return clear_startup_campaigns()


@router.post("/api/incubators/clear")
def api_clear_incubators_directory():
    return clear_incubators_directory()


@router.post("/api/startups/clear")
def api_clear_startups_directory():
    return clear_startups_directory()


@router.post("/api/enrichment/scrape")
def api_scrape_and_enrich_entity(req: ScrapeEnrichRequest):
    return scrape_and_enrich_entity(req)


@router.post("/api/enrichment/batch-scrape")
def api_batch_enrich_entities(req: BatchEnrichRequest):
    return batch_enrich_entities(req)


@router.post("/api/enrichment/upload")
async def api_enrich_from_excel(
    file: UploadFile = File(...),
    entity_type: str = Form("incubator"),
    city: str = Form(""),
    state: str = Form(""),
):
    contents = await file.read()
    return enrich_from_excel(contents, entity_type, city, state)


@router.post("/api/enrichment/save")
def api_save_enriched(req: SaveEnrichedRequest):
    return save_enriched_to_db(req)


@router.post("/api/incubein/incubator/add-to-db")
def api_add_incubator_cohort_to_db(req: AddIncubatorsToEcosystemRequest):
    return add_incubator_cohort_to_db(req)


@router.get("/api/lifecycle/nurture-loop/list")
def api_get_nurture_loop_entities():
    return get_nurture_loop_entities()


@router.post("/api/lifecycle/nurture-loop/add-milestone")
def api_add_nurture_milestone(req: MilestoneRequest):
    return add_nurture_milestone(req)


@router.post("/api/incubein/seed-support/reject")
def api_process_seed_support_rejections(req: SeedRejectionRequest):
    return process_seed_support_rejections(req)
