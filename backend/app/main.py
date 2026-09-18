from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.gzip import GZipMiddleware

from .core.config import BASE_DIR
from .api.middleware.cors import add_cors_middleware
from .api.middleware.logging import log_requests
from .api.middleware.error_handler import register_exception_handlers
from .api.routes.pipeline import router as pipeline_router
from .api.routes.email import router as email_router
from .api.routes.incubators import router as incubators_router
from .api.routes.ai import router as ai_router
from .api.routes.outreach import router as outreach_router
from .api.routes.meetings import router as meetings_router
from .api.routes.incubein import router as incubein_router
from .api.routes.crm import router as crm_router
from .api.routes.config import router as config_router
from .api.routes.rbac import router as rbac_router
from .services import start_imap_checking_loop

app = FastAPI(title="Indian Startup Ecosystem Intelligence Platform API")

# Enable CORS for frontend development
add_cors_middleware(app)

# Compress JSON/JS/CSS responses to cut transfer size on slow connections
app.add_middleware(GZipMiddleware, minimum_size=500)

# Request logging + exception -> JSON mapping
app.middleware("http")(log_requests)
register_exception_handlers(app)

app.include_router(pipeline_router)
app.include_router(email_router)
app.include_router(incubators_router)
app.include_router(ai_router)
app.include_router(outreach_router)
app.include_router(meetings_router)
app.include_router(incubein_router)
app.include_router(crm_router)
app.include_router(config_router)
app.include_router(rbac_router)


@app.on_event("startup")
def on_startup():
    start_imap_checking_loop()


@app.get("/health", include_in_schema=False)
def health_check():
    from .core.redis import is_connected
    return {"status": "ok", "redis": is_connected()}


# --- Serve Built React Frontend (production / exe mode) ---
_static_dir = BASE_DIR / "static"
if _static_dir.exists() and _static_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_static_dir / "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_index():
        return FileResponse(str(_static_dir / "index.html"))
