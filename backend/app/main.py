import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import start_http_server
from prometheus_fastapi_instrumentator import Instrumentator

from .routes import analyze, bell, health, me, monitoring, stats, team, webhooks

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # the metrics leave on their own port, so nothing is public under /api
    try:
        start_http_server(int(os.getenv("METRICS_PORT", "9101")))
    except OSError:
        logger.warning("Metrics port is taken, no metrics in this process")

    yield


def docs_settings() -> dict:
    """Where the API docs live and whether they exist at all.

    Behind nginx the API answers under /api, which nginx strips. ROOT_PATH
    tells FastAPI, so Swagger loads /api/openapi.json and its requests go to
    /api. Without a proxy it stays empty and /docs works as it is.
    DOCS_ENABLED=false removes Swagger, ReDoc and the schema.
    """
    settings: dict = {"root_path": os.getenv("ROOT_PATH", "")}

    if os.getenv("DOCS_ENABLED", "true").lower() in ("0", "false", "no", "off"):
        settings |= {"docs_url": None, "redoc_url": None, "openapi_url": None}

    return settings


app = FastAPI(title="phisheye", lifespan=lifespan, **docs_settings())

# health checks would drown the real traffic
Instrumentator(excluded_handlers=["/health", "/health/ready"]).instrument(app)

# Only for the Vite dev server on its own port. In compose nginx serves the
# frontend and the API under one origin, the browser asks nothing there.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(bell.router)
app.include_router(health.router)
app.include_router(me.router)
app.include_router(monitoring.router)
app.include_router(stats.router)
app.include_router(team.router)
app.include_router(webhooks.router)


@app.get("/health")
def health():
    return {"status": "ok"}
