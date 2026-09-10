from fastapi import FastAPI
from backend.app.routes.analyze import router as analyses_router

app = FastAPI(title="phisheye")

app.include_router(analyses_router)

@app.get("/health")
def health():
    return {"status": "ok"}