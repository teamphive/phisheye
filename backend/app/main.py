from fastapi import FastAPI

app = FastAPI(title="phisheye")

@app.get("/health")
def health():
    return {"status": "ok"}
