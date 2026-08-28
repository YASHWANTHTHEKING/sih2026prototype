import os
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import Dict, Any, Optional

from ..core.config import settings

router = APIRouter()

@router.get("/geojson/{aoi_id}/{layer_name}")
def get_layer_geojson(aoi_id: str, layer_name: str):
    """
    Returns GeoJSON for requested layer:
    - parcels (ai_inferred_parcels)
    - buildings (ai_inferred_buildings)
    - roads (ai_inferred_roads)
    - conflicts (cadastral_conflicts)
    - legacy (legacy_cadastral_parcels)
    - gnss (gnss_cors_survey_points)
    - gt_parcels (ground_truth_parcels)
    """
    layer_map = {
        "parcels": "ai_inferred_parcels.geojson",
        "buildings": "ai_inferred_buildings.geojson",
        "roads": "ai_inferred_roads.geojson",
        "conflicts": "cadastral_conflicts.geojson",
        "legacy": "legacy_cadastral_parcels.geojson",
        "gnss": "gnss_cors_survey_points.geojson",
        "gt_parcels": "ground_truth_parcels.geojson",
        "gt_buildings": "ground_truth_buildings.geojson",
        "gt_roads": "ground_truth_roads.geojson"
    }
    
    file_name = layer_map.get(layer_name, f"{layer_name}.geojson")
    file_path = settings.DATA_DIR / "aois" / aoi_id / "vectors" / file_name
    
    if not file_path.exists():
        # Fallback to ground truth if AI layer not yet extracted
        if layer_name == "parcels":
            fallback = settings.DATA_DIR / "aois" / aoi_id / "vectors" / "ground_truth_parcels.geojson"
            if fallback.exists():
                file_path = fallback
        elif layer_name == "buildings":
            fallback = settings.DATA_DIR / "aois" / aoi_id / "vectors" / "ground_truth_buildings.geojson"
            if fallback.exists():
                file_path = fallback
                
    if not file_path.exists():
        return {"type": "FeatureCollection", "features": []}
        
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/metadata/{aoi_id}")
def get_aoi_metadata(aoi_id: str):
    """Returns metadata for an AOI."""
    meta_path = settings.DATA_DIR / "aois" / aoi_id / "metadata.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="AOI metadata not found")
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/aois")
def list_available_aois():
    """Lists all available Areas of Interest (AOIs)."""
    aois_dir = settings.DATA_DIR / "aois"
    aois = []
    if aois_dir.exists():
        for d in aois_dir.iterdir():
            if d.is_dir():
                meta_file = d / "metadata.json"
                if meta_file.exists():
                    with open(meta_file, "r", encoding="utf-8") as f:
                        aois.append(json.load(f))
                else:
                    aois.append({"aoi_id": d.name, "name": d.name})
    return {"aois": aois}

@router.get("/raster/{aoi_id}/{raster_name}")
def get_raster_file(aoi_id: str, raster_name: str):
    """Serves raster files or previews."""
    raster_dir = settings.DATA_DIR / "aois" / aoi_id / "rasters"
    file_path = raster_dir / f"{raster_name}.png"
    if not file_path.exists():
        file_path = raster_dir / f"{raster_name}.tif"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Raster not found")
    return FileResponse(file_path)
