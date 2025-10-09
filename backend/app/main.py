# app/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import reports, sensors
from .database import init_db
import os

app = FastAPI(title="SmartHealth Ingest API")

# Configure CORS for development (allow the React dev server)
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [o.strip() for o in FRONTEND_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)
app.include_router(sensors.router)


@app.on_event("startup")
async def on_startup():
    # create DB tables if not exist
    await init_db()
    print("Database initialized")
    # Other startup tasks can be added here