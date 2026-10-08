import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import start_http_server
from prometheus_fastapi_instrumentator import Instrumentator

from .routes import analyze, me, stats, team, webhooks

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # the metrics leave on their own port, so nothing is public under /api
    try:
        start_http_server(int(os.getenv("METRICS_PORT", "9101")))
    except OSError:
        logger.warning("Metrics port is taken, no metrics in this process")

    yield


app = FastAPI(title="phisheye", lifespan=lifespan)

# health checks would drown the real traffic
Instrumentator(excluded_handlers=["/health"]).instrument(app)

# Only for the Vite dev server on its own port. In compose nginx serves the
# frontend and the API under one origin, the browser asks nothing there.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(me.router)
app.include_router(stats.router)
app.include_router(team.router)
app.include_router(webhooks.router)


@app.get("/health")
def health():
    return {"status": "ok"}
