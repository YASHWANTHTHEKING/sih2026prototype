import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
WORKSPACE_DIR = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data_store"
STATIC_DIR = BASE_DIR / "static"

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-Based Automated Cadastral Mapping System"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Paths
    BASE_DIR: Path = BASE_DIR
    DATA_DIR: Path = DATA_DIR
    STATIC_DIR: Path = STATIC_DIR
    
    # Coordinate Reference Systems
    DEFAULT_PROJECTED_CRS: str = "EPSG:32643"  # UTM Zone 43N (India)
    DEFAULT_GEOGRAPHIC_CRS: str = "EPSG:4326"   # WGS84
    WEB_MERCATOR_CRS: str = "EPSG:3857"
    
    # Default processing parameters
    DEFAULT_CHIP_SIZE: int = 512
    DEFAULT_CHIP_OVERLAP: float = 0.15
    BUILDING_MIN_AREA_M2: float = 15.0
    BUILDING_MAX_AREA_M2: float = 5000.0
    ROAD_BUFFER_METERS: float = 3.5
    
    # Conflict thresholds
    OVERLAP_THRESHOLD_M2: float = 1.0
    SLIVER_MAX_AREA_M2: float = 10.0
    ENCROACHMENT_TOLERANCE_M: float = 0.3
    LEGACY_DISPLACEMENT_TOLERANCE_M: float = 1.5
    
    class Config:
        case_sensitive = True

settings = Settings()

# Ensure directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.STATIC_DIR, exist_ok=True)
os.makedirs(settings.DATA_DIR / "aois", exist_ok=True)
os.makedirs(settings.DATA_DIR / "exports", exist_ok=True)
os.makedirs(settings.DATA_DIR / "audit_logs", exist_ok=True)
