# tests/test_endpoints.py
import pytest
from httpx import AsyncClient
from app.main import app
import app.crud as crud
import app.utils.publisher as publisher

@pytest.mark.asyncio
async def test_report_endpoint(monkeypatch):
    async def fake_create_case_report(db, report):
        class R: id = 123
        return R()
    async def fake_publish(rk, payload):
        return None
    monkeypatch.setattr(crud, "create_case_report", fake_create_case_report)
    monkeypatch.setattr(publisher, "publish_to_queue", fake_publish)

    payload = {
      "reporter_type":"ASHA", "reporter_id":"asha-001",
      "patient_age":30, "sex":"F",
      "lat":17.447, "lng":78.390,
      "symptoms":["diarrhea","vomiting"],
      "reported_at":"2025-10-08T12:00:00Z"
    }
    headers = {"x-api-key": "secret-key"}
    async with AsyncClient(app=app, base_url="http://test") as ac:
        r = await ac.post("/report", json=payload, headers=headers)
        assert r.status_code == 200
        assert r.json()["id"] == 123
        assert r.json()["status"] == "accepted"