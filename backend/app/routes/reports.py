# app/routes/reports.py
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from ..schemas import CaseReportCreate
from ..database import async_session
from ..crud import create_case_report
from ..utils.publisher import publish_to_queue
import os
import json

API_KEY = os.getenv("API_KEY", "secret-key")
router = APIRouter()

async def get_db():
    async with async_session() as session:
        yield session

def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

# Debug endpoint to see what data is being sent
@router.post("/reports/debug")
async def debug_report(request: Request):
    body = await request.body()
    try:
        json_data = json.loads(body)
        return {
            "received_data": json_data,
            "data_types": {k: type(v).__name__ for k, v in json_data.items()},
            "expected_schema": {
                "reporter_type": "string",
                "reporter_id": "string",
                "patient_age": "integer",
                "sex": "string (M/F/O)",
                "lat": "float",
                "lng": "float",
                "symptoms": "array of strings",
                "reported_at": "datetime (ISO format)"
            }
        }
    except Exception as e:
        return {"error": str(e), "raw_body": body.decode()}

@router.post("/report")
async def submit_report(report: CaseReportCreate, db: AsyncSession = Depends(get_db), _=Depends(verify_api_key)):
    try:
        obj = await create_case_report(db, report)
        # Publish for downstream analytics
        await publish_to_queue("case_reports", {"id": obj.id})
        return {"status": "accepted", "id": obj.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating report: {str(e)}")

# Also accept POST on /reports (plural) for frontend compatibility
@router.post("/reports")
async def submit_report_plural(report: CaseReportCreate, db: AsyncSession = Depends(get_db), _=Depends(verify_api_key)):
    try:
        obj = await create_case_report(db, report)
        # Publish for downstream analytics
        await publish_to_queue("case_reports", {"id": obj.id})
        return {"status": "accepted", "id": obj.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating report: {str(e)}")

@router.get("/reports")
async def list_reports(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db), _=Depends(verify_api_key)):
    from ..crud import get_case_reports
    reports = await get_case_reports(db, skip=skip, limit=limit)
    return reports