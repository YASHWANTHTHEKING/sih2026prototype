from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional
from pydantic import BaseModel

from ..modules.ingestion.pipeline import IngestionPipeline
from ..modules.building_extraction.extractor import BuildingFootprintExtractor
from ..modules.road_extraction.extractor import RoadNetworkExtractor
from ..modules.parcel_delineation.delineator import ParcelBoundaryDelineator
from ..modules.landuse_classification.classifier import LandUseClassifier
from ..modules.topology_conflict.engine import TopologyConflictEngine
from ..modules.evaluation.evaluator import EvaluationSuite
from ..data.sample_generator import generate_sample_aoi
from ..core.config import settings

router = APIRouter()

class PipelineRunRequest(BaseModel):
    aoi_id: str = "aoi_urban_ward_07"
    min_building_height: float = 2.5
    regularize_buildings: bool = True
    use_legacy_conflation: bool = True
    use_gnss_anchors: bool = True

@router.post("/run-full")
def run_full_pipeline(req: PipelineRunRequest):
    """Executes full end-to-end GeoAI Cadastral Pipeline (Modules 1 - 9)."""
    aoi_dir = settings.DATA_DIR / "aois" / req.aoi_id
    if not aoi_dir.exists():
        generate_sample_aoi(aoi_id=req.aoi_id)
        
    try:
        # 1. Ingestion
        ingest = IngestionPipeline(req.aoi_id).run_ingestion_and_preprocessing()
        
        # 2. Building Footprints
        bld = BuildingFootprintExtractor(req.aoi_id).extract_building_footprints(
            min_height_thresh_m=req.min_building_height,
            regularize=req.regularize_buildings
        )
        
        # 3. Roads
        roads = RoadNetworkExtractor(req.aoi_id).extract_road_network()
        
        # 4. Parcels
        parcels = ParcelBoundaryDelineator(req.aoi_id).delineate_parcels(
            use_legacy_conflation=req.use_legacy_conflation,
            use_gnss_anchors=req.use_gnss_anchors
        )
        
        # 5. Land Use
        landuse = LandUseClassifier(req.aoi_id).classify_parcels()
        
        # 6. Topology & Conflicts
        topology = TopologyConflictEngine(req.aoi_id).detect_topology_and_conflicts()
        
        # 9. Benchmarks
        benchmarks = EvaluationSuite(req.aoi_id).run_benchmarks()
        
        return {
            "status": "success",
            "message": "Full GeoAI Cadastral Extraction Pipeline completed successfully",
            "aoi_id": req.aoi_id,
            "summary": {
                "buildings_extracted": bld["total_buildings_extracted"],
                "roads_extracted": roads["total_roads_extracted"],
                "parcels_delineated": parcels["total_parcels_delineated"],
                "conflicts_flagged": topology["total_conflicts_detected"],
                "auto_mapped_pct": parcels["auto_mapped_percentage"],
                "time_saved_pct": benchmarks["operational_impact"]["manual_digitization_reduction_pct"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CreateCustomAoiRequest(BaseModel):
    name: Optional[str] = None
    center_lat: float
    center_lon: float
    width_m: float = 600.0
    height_m: float = 600.0

@router.post("/custom-aoi")
def create_and_process_custom_aoi(req: CreateCustomAoiRequest):
    """
    Creates a new custom AOI anywhere the user selects/clicks on the map
    and executes the full automated cadastral extraction pipeline on that selected area.
    """
    import time
    aoi_id = f"aoi_custom_{int(time.time())}"
    aoi_name = req.name or f"Custom Parcel Zone ({round(req.center_lat, 4)}, {round(req.center_lon, 4)})"
    
    try:
        # 1. Generate AOI base layers centered on user's selected location
        meta = generate_sample_aoi(
            aoi_id=aoi_id,
            center_lat=req.center_lat,
            center_lon=req.center_lon,
            width_m=req.width_m,
            height_m=req.height_m
        )
        meta["name"] = aoi_name
        
        # Save custom name to metadata
        meta_file = settings.DATA_DIR / "aois" / aoi_id / "metadata.json"
        with open(meta_file, "w", encoding="utf-8") as f:
            import json
            json.dump(meta, f, indent=2)

        # 2. Run GeoAI extraction on the newly selected area
        IngestionPipeline(aoi_id).run_ingestion_and_preprocessing()
        bld = BuildingFootprintExtractor(aoi_id).extract_building_footprints()
        roads = RoadNetworkExtractor(aoi_id).extract_road_network()
        parcels = ParcelBoundaryDelineator(aoi_id).delineate_parcels()
        landuse = LandUseClassifier(aoi_id).classify_parcels()
        topology = TopologyConflictEngine(aoi_id).detect_topology_and_conflicts()
        benchmarks = EvaluationSuite(aoi_id).run_benchmarks()
        
        return {
            "status": "success",
            "message": f"Successfully parceled selected area '{aoi_name}'!",
            "aoi_id": aoi_id,
            "metadata": meta,
            "summary": {
                "buildings_extracted": bld["total_buildings_extracted"],
                "roads_extracted": roads["total_roads_extracted"],
                "parcels_delineated": parcels["total_parcels_delineated"],
                "conflicts_flagged": topology["total_conflicts_detected"],
                "auto_mapped_pct": parcels["auto_mapped_percentage"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/init-aoi")
def initialize_sample_aoi(aoi_id: str = "aoi_urban_ward_07"):
    """Generates sample Area of Interest data (Drone imagery, DSM/DTM, legacy cadastre)."""
    meta = generate_sample_aoi(aoi_id=aoi_id)
    return {"status": "success", "metadata": meta}
