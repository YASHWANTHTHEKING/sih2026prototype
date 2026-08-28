import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import Dict, Any

from ..modules.exporters.export_engine import ExportEngine
from ..core.config import settings

router = APIRouter()

@router.post("/generate/{aoi_id}")
def generate_all_exports(aoi_id: str):
    """Generates Shapefiles, GeoPackage, DXF, CSV register for download."""
    engine = ExportEngine(aoi_id)
    exports = engine.export_all_formats()
    return {"status": "success", "exported_files": exports}

@router.get("/download/{aoi_id}/{export_type}")
def download_export_file(aoi_id: str, export_type: str):
    """
    Downloads exported file by format:
    - shapefile (.zip)
    - geopackage (.gpkg)
    - dxf (.dxf)
    - csv (.csv)
    """
    engine = ExportEngine(aoi_id)
    engine.export_all_formats()
    
    exports_dir = settings.DATA_DIR / "exports" / aoi_id
    
    file_map = {
        "shapefile": exports_dir / f"{aoi_id}_parcels_shapefile.zip",
        "geopackage": exports_dir / f"{aoi_id}_cadastre.gpkg",
        "dxf": exports_dir / f"{aoi_id}_cadastre.dxf",
        "csv": exports_dir / f"{aoi_id}_cadastral_register.csv"
    }
    
    file_path = file_map.get(export_type)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Requested export file not found")
        
    return FileResponse(
        file_path,
        filename=file_path.name,
        media_type="application/octet-stream"
    )
