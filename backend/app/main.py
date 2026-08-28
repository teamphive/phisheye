from fastapi import FastAPI
import os
import vt
import load_dotenv

load_dotenv.load_dotenv()

app = FastAPI(title="phisheye")
client = vt.Client(os.getenv("VT_API_KEY"))

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/email_check")
async def virus_check():
    file = await client.get_object_async(
        "/files/44d88612fea8a8f36de82e1278abb02f"
    )
    return {"status": file.last_analysis_results}
