#!/usr/bin/env python3
"""
Database checker script - view data in your PostgreSQL database
Run with: python check_db.py
"""
import asyncio
import os
from sqlalchemy import select, func, text
from app.database import async_session
from app.models import CaseReport, SensorReading

async def check_database():
    async with async_session() as session:
        print("\n" + "="*60)
        print("DATABASE INSPECTION")
        print("="*60)
        
        # Check case_reports
        print("\n📊 CASE REPORTS:")
        print("-" * 60)
        result = await session.execute(select(func.count()).select_from(CaseReport))
        count = result.scalar()
        print(f"Total records: {count}")
        
        if count > 0:
            result = await session.execute(select(CaseReport).limit(5))
            reports = result.scalars().all()
            print(f"\nShowing first {len(reports)} records:")
            for i, report in enumerate(reports, 1):
                print(f"\n  [{i}] ID: {report.id}")
                print(f"      Reporter: {report.reporter_type} ({report.reporter_id})")
                print(f"      Patient: {report.sex}, Age {report.patient_age}")
                print(f"      Location: ({report.lat}, {report.lng})")
                print(f"      Symptoms: {report.symptoms}")
                print(f"      Reported: {report.reported_at}")
                print(f"      Created: {report.created_at}")
        
        # Check sensor_readings
        print("\n\n🌡️  SENSOR READINGS:")
        print("-" * 60)
        result = await session.execute(select(func.count()).select_from(SensorReading))
        count = result.scalar()
        print(f"Total records: {count}")
        
        if count > 0:
            result = await session.execute(select(SensorReading).limit(5))
            readings = result.scalars().all()
            print(f"\nShowing first {len(readings)} records:")
            for i, reading in enumerate(readings, 1):
                print(f"\n  [{i}] ID: {reading.id}")
                print(f"      Sensor: {reading.sensor_id}")
                print(f"      Location: ({reading.lat}, {reading.lng})")
                print(f"      Turbidity: {reading.turbidity}")
                print(f"      pH: {reading.pH}")
                print(f"      Conductivity: {reading.conductivity}")
                print(f"      Reading at: {reading.reading_at}")
                print(f"      Created: {reading.created_at}")
        
        # Database info
        print("\n\n🔧 DATABASE INFO:")
        print("-" * 60)
        result = await session.execute(text("SELECT version()"))
        version = result.scalar()
        print(f"PostgreSQL Version: {version}")
        
        print("\n" + "="*60)
        print("✅ Database check complete!")
        print("="*60 + "\n")

if __name__ == "__main__":
    # Override DATABASE_URL for local connection if needed
    # Uncomment and modify if running outside Docker:
    # os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5432/smart_health"
    
    asyncio.run(check_database())
