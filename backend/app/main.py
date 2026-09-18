from fastapi import FastAPI
from backend.app.routes.analyze import router as analyses_router
from backend.app.routes import analyze, webhooks


app = FastAPI(title="phisheye")

app.include_router(analyses_router)

app.include_router(analyze.router)
app.include_router(webhooks.router)

@app.get("/health")
def health():
    return {"status": "ok"}
