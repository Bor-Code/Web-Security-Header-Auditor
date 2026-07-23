from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from requests import RequestException

from web_security_header_auditor import (
    audit_url,
    result_to_json_payload,
    validate_timeout,
)


app = FastAPI(
    title="Web Security Header Auditor API",
    version="1.0.0",
    description=(
        "Passive API for reviewing HTTP security headers. "
        "It does not exploit, fuzz, brute force, or send attack payloads."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuditRequest(BaseModel):
    url: str = Field(..., min_length=1)
    timeout: int = Field(default=10, ge=1)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/audit")
def create_audit(request: AuditRequest) -> dict:
    try:
        timeout = validate_timeout(request.timeout)
        result = audit_url(request.url, timeout)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RequestException as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return result_to_json_payload(result)