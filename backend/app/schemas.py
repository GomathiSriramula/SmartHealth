# app/schemas.py
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Union
from datetime import datetime

class CaseReportCreate(BaseModel):
    reporter_type: str
    reporter_id: str
    patient_age: int
    sex: str = Field(..., pattern="^(M|F|O)$")  # Pydantic v2
    lat: float
    lng: float
    symptoms: Union[List[str], str]  # Accept both list and comma-separated string
    reported_at: Union[datetime, str]  # Accept both datetime and string
    
    @field_validator('symptoms', mode='before')
    @classmethod
    def validate_symptoms(cls, v):
        if isinstance(v, str):
            # If it's a string, split by comma
            return [s.strip() for s in v.split(',') if s.strip()]
        return v
    
    @field_validator('reported_at', mode='before')
    @classmethod
    def validate_reported_at(cls, v):
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                # Try parsing common formats
                from dateutil import parser
                return parser.parse(v)
        return v
    
    @field_validator('sex', mode='before')
    @classmethod
    def validate_sex(cls, v):
        # Normalize sex to uppercase
        if isinstance(v, str):
            v = v.upper()
            if v in ['MALE', 'M']:
                return 'M'
            elif v in ['FEMALE', 'F']:
                return 'F'
            elif v in ['OTHER', 'O']:
                return 'O'
        return v

class SensorReadingCreate(BaseModel):
    sensor_id: str
    reading_at: datetime
    lat: float
    lng: float
    turbidity: Optional[float] = None
    pH: Optional[float] = None
    conductivity: Optional[float] = None

    class Config:
        from_attributes = True  # replaces orm_mode
        json_schema_extra = {  # renamed from schema_extra
            "example": {
                "sensor_id": "sensor_123",
                "reading_at": "2023-10-01T12:00:00Z",
                "lat": 37.7749,
                "lng": -122.4194,
                "turbidity": 5.5,
                "pH": 7.2,
                "conductivity": 250.0
            }
        }
# --- IGNORE ---