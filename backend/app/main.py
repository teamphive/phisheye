import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import analyze, me, webhooks

app = FastAPI(title="phisheye")

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
app.include_router(webhooks.router)


@app.get("/health")
def health():
    return {"status": "ok"}
