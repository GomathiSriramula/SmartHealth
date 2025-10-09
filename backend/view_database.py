# view_database.py - Manual Database Viewer
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Use the DATABASE_URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/smart_health")

# For local connection (outside Docker), change host from 'postgres' to 'localhost'
if "@postgres:" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("@postgres:", "@localhost:")

async def view_data():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("\n" + "="*60)
        print("CASE REPORTS TABLE")
        print("="*60)
        result = await session.execute(text("SELECT * FROM case_reports ORDER BY created_at DESC LIMIT 10"))
        rows = result.fetchall()
        if rows:
            print(f"Found {len(rows)} case report(s):\n")
            for row in rows:
                print(f"ID: {row[0]}")
                print(f"Patient ID: {row[1]}")
                print(f"Symptoms: {row[2]}")
                print(f"Location: {row[3]}, {row[4]}")
                print(f"Severity: {row[5]}")
                print(f"Created: {row[6]}")
                print("-" * 40)
        else:
            print("No case reports found.")
        
        print("\n" + "="*60)
        print("SENSOR READINGS TABLE")
        print("="*60)
        result = await session.execute(text("SELECT * FROM sensor_readings ORDER BY reading_at DESC LIMIT 10"))
        rows = result.fetchall()
        if rows:
            print(f"Found {len(rows)} sensor reading(s):\n")
            for row in rows:
                print(f"ID: {row[0]}")
                print(f"Sensor ID: {row[1]}")
                print(f"Reading At: {row[2]}")
                print(f"Location: lat={row[3]}, lng={row[4]}")
                print(f"Turbidity: {row[5]}, pH: {row[6]}, Conductivity: {row[7]}")
                print(f"Created: {row[8]}")
                print("-" * 40)
        else:
            print("No sensor readings found.")
        
        # Count totals
        print("\n" + "="*60)
        print("TOTALS")
        print("="*60)
        result = await session.execute(text("SELECT COUNT(*) FROM case_reports"))
        count = result.scalar()
        print(f"Total Case Reports: {count}")
        
        result = await session.execute(text("SELECT COUNT(*) FROM sensor_readings"))
        count = result.scalar()
        print(f"Total Sensor Readings: {count}")
    
    await engine.dispose()

if __name__ == "__main__":
    print("Connecting to database...")
    print(f"URL: {DATABASE_URL}\n")
    asyncio.run(view_data())
