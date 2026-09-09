from email import policy
from email.parser import BytesParser
from fastapi import FastAPI, File, UploadFile
import os
import vt
import load_dotenv
import hashlib

load_dotenv.load_dotenv()

app = FastAPI(title="phisheye")
    
@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze")
async def analyze_email(file: UploadFile = File(...)):
    content = await file.read()

    msg = BytesParser(policy=policy.default).parsebytes(content)
    attachments = {}
    results = []

    # extract attachment information
    for part in msg.iter_attachments():
        file_bytes = part.get_payload(decode=True)
        sha256 = hashlib.sha256(file_bytes).hexdigest()

        attachments[part.get_filename()] = sha256

    # virustotal analysis
    async with vt.Client(os.getenv("VT_API_KEY")) as client:
        for filename, sha256 in attachments.items():
            try:
                vt_result = await client.get_object_async(f"/files/{sha256}")
            except vt.APIError as e:
                if e.code == "NotFoundError":
                    vt_result = None
                else:
                    raise

            results.append({
                "filename": filename,
                "sha256": sha256,
                "vt_results": vt_result.last_analysis_results if vt_result else None,
            })

    return {"attachments": results}


