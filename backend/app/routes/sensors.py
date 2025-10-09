# app/routes/sensors.py
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..schemas import SensorReadingCreate
from ..database import async_session
from ..crud import create_sensor_reading
from ..utils.publisher import publish_to_queue
import os

API_KEY = os.getenv("API_KEY", "secret-key")
router = APIRouter()

async def get_db():
    async with async_session() as session:
        yield session

def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

@router.post("/sensor")
async def submit_sensor(reading: SensorReadingCreate, db: AsyncSession = Depends(get_db), _=Depends(verify_api_key)):
    obj = await create_sensor_reading(db, reading)
    await publish_to_queue("sensor_readings", {"id": obj.id})
    return {"status": "accepted", "sensor_id": obj.id}

# Also accept POST on /sensors (plural) for frontend compatibility
@router.post("/sensors")
async def submit_sensor_plural(reading: SensorReadingCreate, db: AsyncSession = Depends(get_db), _=Depends(verify_api_key)):
    obj = await create_sensor_reading(db, reading)
    await publish_to_queue("sensor_readings", {"id": obj.id})
    return {"status": "accepted", "sensor_id": obj.id}

@router.get("/sensors")
async def list_sensors(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db), _=Depends(verify_api_key)):
    from ..crud import get_sensor_readings
    readings = await get_sensor_readings(db, skip=skip, limit=limit)
    return readings