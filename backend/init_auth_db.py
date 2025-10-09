"""
Script to initialize authentication tables in the database.
Run this after setting up your database to create the users table.
"""
import asyncio
import sys
from app.database import engine, Base
from app.models import User, CaseReport, SensorReading

async def init_tables():
    """Create all tables in the database."""
    print("Creating database tables...")
    async with engine.begin() as conn:
        # Drop all tables (use with caution in production!)
        # await conn.run_sync(Base.metadata.drop_all)
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    
    print("✓ Database tables created successfully!")
    print("Tables created: users, case_reports, sensor_readings")

if __name__ == "__main__":
    try:
        asyncio.run(init_tables())
    except Exception as e:
        print(f"Error initializing database: {e}", file=sys.stderr)
        sys.exit(1)
