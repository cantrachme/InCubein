from fastapi import APIRouter, Query, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse

from ...schemas.pipeline import PipelineRunResponse
from ...services import (
    reset_pipeline,
    run_pipeline,
    get_logs,
    export_data,
    get_incubators,
    get_startups,
    get_graph,
    get_analytics,
    import_directory_excel,
)

router = APIRouter()


@router.post("/api/pipeline/reset", response_model=PipelineRunResponse)
def api_reset_pipeline():
    return reset_pipeline()


@router.post("/api/pipeline/run", response_model=PipelineRunResponse)
def api_run_pipeline(stage: str = Query("all", description="Stage to run: scrape, clean, resolve, enrich, or all")):
    return run_pipeline(stage)


@router.get("/api/pipeline/logs")
def api_get_logs():
    return get_logs()


@router.get("/api/incubators")
def api_get_incubators(
    q: str | None = None,
    org_type: str | None = None,
    state: str | None = None,
    city: str | None = None,
    sector: str | None = None,
    region: str | None = None,
    page: int | None = None,
    limit: int | None = None,
):
    return get_incubators(q, org_type, state, city, sector, region, page, limit)


@router.get("/api/startups")
def api_get_startups(
    q: str | None = None,
    sector: str | None = None,
    funding_stage: str | None = None,
    hq_city: str | None = None,
    incubator_id: str | None = None,
    page: int | None = None,
    limit: int | None = None,
):
    return get_startups(q, sector, funding_stage, hq_city, incubator_id, page, limit)


@router.post("/api/directory/upload")
async def api_upload_directory_excel(
    file: UploadFile = File(...),
    entity_type: str = Form("startup"),
):
    contents = await file.read()
    return import_directory_excel(contents, entity_type)


@router.get("/api/graph")
def api_get_graph():
    return get_graph()


@router.get("/api/analytics")
def api_get_analytics():
    return get_analytics()


@router.get("/api/export/{format_type}")
def api_export_data(format_type: str):
    content, media_type, filename = export_data(format_type)
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    if media_type == "application/zip":
        return StreamingResponse(content, media_type=media_type, headers=headers)
    return Response(content=content, media_type=media_type, headers=headers)
