import os
import json
import logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from ..core.config import settings
from ..modules.ingestion.upload_handler import ingest_uploaded_drone_image
from ..modules.ingestion.pipeline import IngestionPipeline
from ..modules.building_extraction.extractor import BuildingFootprintExtractor
from ..modules.road_extraction.extractor import RoadNetworkExtractor
from ..modules.parcel_delineation.delineator import ParcelBoundaryDelineator
from ..modules.landuse_classification.classifier import LandUseClassifier
from ..modules.topology_conflict.engine import TopologyConflictEngine
from ..modules.evaluation.evaluator import EvaluationSuite

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_UPLOAD_SIZE_BYTES = 60 * 1024 * 1024  # 60MB

@router.post("/drone-image")
async def upload_drone_image(
    file: UploadFile = File(...),
    center_lat: str = Form(...),
    center_lon: str = Form(...),
    width_m: str = Form("300.0"),
    height_m: str = Form("300.0"),
    name: Optional[str] = Form(None),
    run_pipeline: str = Form("true")
):
    """
    Uploads a real non-georeferenced drone photo/orthomosaic, georeferences it around
    the supplied WGS84 center coordinates (spanning width_m x height_m), and executes
    the full GeoAI cadastral extraction pipeline on the real pixel data.
    """
    # 1. Parameter Validations
    try:
        c_lat = float(center_lat)
        c_lon = float(center_lon)
        w_m = float(width_m)
        h_m = float(height_m)
        should_run = str(run_pipeline).lower() in ("true", "1", "yes")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"Invalid numeric input parameters: {str(ve)}")

    if not (-90.0 <= c_lat <= 90.0):
        raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90 degrees.")
    if not (-180.0 <= c_lon <= 180.0):
        raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180 degrees.")
    if w_m <= 0 or w_m > 5000.0:
        raise HTTPException(status_code=400, detail="Width must be between 1 and 5000 meters.")
    if h_m <= 0 or h_m > 5000.0:
        raise HTTPException(status_code=400, detail="Height must be between 1 and 5000 meters.")

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")

    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Uploaded file exceeds 60MB maximum limit.")

    # 2. Ingest and georeference drone image
    try:
        meta = ingest_uploaded_drone_image(
            file_bytes=file_bytes,
            filename=file.filename or "drone_upload.jpg",
            center_lat=c_lat,
            center_lon=c_lon,
            width_m=w_m,
            height_m=h_m,
            name=name
        )
    except Exception as e:
        logger.error(f"Ingestion error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Image georeferencing error: {str(e)}")

    aoi_id = meta["aoi_id"]
    summary = {
        "buildings_extracted": 0,
        "roads_extracted": 0,
        "parcels_delineated": 0,
        "conflicts_flagged": 0,
        "auto_mapped_pct": 0.0,
        "extraction_mode": "RGB-Only Computer Vision (No Elevation Survey)"
    }

    # 3. Execute GeoAI extraction pipeline if requested
    if run_pipeline:
        try:
            # Stage 1: Preprocessing & Chipping
            IngestionPipeline(aoi_id).run_ingestion_and_preprocessing()

            # Stage 2: Building Footprint Extraction (RGB-only fallback)
            bld_res = BuildingFootprintExtractor(aoi_id).extract_building_footprints()

            # Stage 3: Road & Access Corridor Extraction
            road_res = RoadNetworkExtractor(aoi_id).extract_road_network()

            # Stage 4: Multi-Cue Cadastral Parcel Delineation
            parcel_res = ParcelBoundaryDelineator(aoi_id).delineate_parcels(
                use_legacy_conflation=False,
                use_gnss_anchors=False
            )

            # Stage 5: Land Use & Cover Classification
            LandUseClassifier(aoi_id).classify_parcels()

            # Stage 6: DE-9IM Topological Validation
            top_res = TopologyConflictEngine(aoi_id).detect_topology_and_conflicts()

            # Stage 7: Evaluation & Benchmarks
            EvaluationSuite(aoi_id).run_benchmarks()

            summary = {
                "buildings_extracted": bld_res.get("total_buildings_extracted", 0),
                "roads_extracted": road_res.get("total_roads_extracted", 0),
                "parcels_delineated": parcel_res.get("total_parcels_delineated", 0),
                "conflicts_flagged": top_res.get("total_conflicts_flagged", 0),
                "auto_mapped_pct": parcel_res.get("auto_mapped_percentage", 0.0),
                "extraction_mode": "RGB Computer Vision Fallback (Real Pixel Ingestion)"
            }
        except Exception as e:
            logger.error(f"GeoAI pipeline execution failed on uploaded image: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"GeoAI pipeline failed on uploaded drone image: {str(e)}"
            )

    return {
        "status": "success",
        "message": f"Real drone orthomosaic successfully ingested and processed for {aoi_id}",
        "aoi_id": aoi_id,
        "metadata": meta,
        "summary": summary
    }
