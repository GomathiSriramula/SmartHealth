# app/models.py
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from .database import Base

class CaseReport(Base):
    __tablename__ = "case_reports"
    id = Column(Integer, primary_key=True, index=True)
    reporter_type = Column(String, nullable=False)
    reporter_id = Column(String, nullable=False)
    patient_age = Column(Integer, nullable=False)
    sex = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    symptoms = Column(JSONB, nullable=False)
    reported_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SensorReading(Base):
    __tablename__ = "sensor_readings"
    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(String, nullable=False)
    reading_at = Column(DateTime(timezone=True), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    turbidity = Column(Float, nullable=True)
    pH = Column(Float, nullable=True)
    conductivity = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())