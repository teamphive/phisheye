from fastapi import FastAPI

from .routes import analyze, webhooks

app = FastAPI(title="phisheye")

app.include_router(analyze.router)
app.include_router(webhooks.router)


@app.get("/health")
def health():
    return {"status": "ok"}
