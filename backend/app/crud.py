# app/crud.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from . import models, schemas

async def create_case_report(db: AsyncSession, report: schemas.CaseReportCreate):
    obj = models.CaseReport(
        reporter_type=report.reporter_type,
        reporter_id=report.reporter_id,
        patient_age=report.patient_age,
        sex=report.sex,
        lat=report.lat,
        lng=report.lng,
        symptoms=report.symptoms,
        reported_at=report.reported_at,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj

async def create_sensor_reading(db: AsyncSession, reading: schemas.SensorReadingCreate):
    obj = models.SensorReading(
        sensor_id=reading.sensor_id,
        reading_at=reading.reading_at,
        lat=reading.lat,
        lng=reading.lng,
        turbidity=reading.turbidity,
        pH=reading.pH,
        conductivity=reading.conductivity,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj
async def get_case_reports(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(models.CaseReport).offset(skip).limit(limit)
    )
    return result.scalars().all()

async def get_sensor_readings(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(models.SensorReading).offset(skip).limit(limit)
    )
    return result.scalars().all()