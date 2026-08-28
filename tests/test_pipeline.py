import os
import sys
from pathlib import Path

# Add project root to python path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

import json
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.data.sample_generator import generate_sample_aoi
from backend.app.modules.ingestion.pipeline import IngestionPipeline
from backend.app.modules.building_extraction.extractor import BuildingFootprintExtractor
from backend.app.modules.road_extraction.extractor import RoadNetworkExtractor
from backend.app.modules.parcel_delineation.delineator import ParcelBoundaryDelineator
from backend.app.modules.landuse_classification.classifier import LandUseClassifier
from backend.app.modules.topology_conflict.engine import TopologyConflictEngine
from backend.app.modules.gt_verification.verifier import GroundTruthingVerifier
from backend.app.modules.evaluation.evaluator import EvaluationSuite
from backend.app.modules.exporters.export_engine import ExportEngine

client = TestClient(app)
TEST_AOI = "aoi_test_ward"

@pytest.fixture(scope="session", autouse=True)
def setup_test_aoi():
    """Generates test dataset before running tests."""
    generate_sample_aoi(aoi_id=TEST_AOI, width_m=400.0, height_m=400.0)
    yield
    # Teardown if necessary

def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_module_1_ingestion():
    pipeline = IngestionPipeline(TEST_AOI)
    res = pipeline.run_ingestion_and_preprocessing()
    assert res["status"] == "success"
    assert res["chips_generated"] > 0

def test_module_2_building_extraction():
    extractor = BuildingFootprintExtractor(TEST_AOI)
    res = extractor.extract_building_footprints(min_height_thresh_m=2.0)
    assert res["status"] == "success"
    assert res["total_buildings_extracted"] > 0

def test_module_3_road_extraction():
    extractor = RoadNetworkExtractor(TEST_AOI)
    res = extractor.extract_road_network()
    assert res["status"] == "success"
    assert res["total_roads_extracted"] > 0

def test_module_4_parcel_delineation():
    delineator = ParcelBoundaryDelineator(TEST_AOI)
    res = delineator.delineate_parcels()
    assert res["status"] == "success"
    assert res["total_parcels_delineated"] > 0

def test_module_5_landuse_classification():
    classifier = LandUseClassifier(TEST_AOI)
    res = classifier.classify_parcels()
    assert res["status"] == "success"
    assert res["total_parcels_classified"] > 0

def test_module_6_topology_and_conflicts():
    engine = TopologyConflictEngine(TEST_AOI)
    res = engine.detect_topology_and_conflicts()
    assert res["status"] == "success"
    assert "severity_breakdown" in res

def test_module_7_gt_signoff_and_audit():
    verifier = GroundTruthingVerifier(TEST_AOI)
    parcels_path = settings.DATA_DIR / "aois" / TEST_AOI / "vectors" / "ai_inferred_parcels.geojson"
    with open(parcels_path, "r", encoding="utf-8") as f:
        fc = json.load(f)
    p_id = fc["features"][0]["properties"]["parcel_id"]
    
    signoff = verifier.sign_off_parcel(
        parcel_id=p_id,
        surveyor_name="Officer Test",
        surveyor_id="GT-TEST-01",
        status="Approved",
        notes="Automated unit test signoff"
    )
    assert signoff["status"] == "success"
    
    trail = verifier.get_audit_trail()
    assert len(trail) > 0

def test_module_9_benchmarks():
    suite = EvaluationSuite(TEST_AOI)
    res = suite.run_benchmarks()
    assert "building_footprint_benchmarks" in res
    assert "cadastral_parcel_benchmarks" in res
    assert "operational_impact" in res

def test_module_10_export_engine():
    engine = ExportEngine(TEST_AOI)
    exports = engine.export_all_formats()
    assert "geopackage" in exports
    assert "shapefile_zip" in exports
    assert "autocad_dxf" in exports

def test_api_layers_and_analytics():
    res_layers = client.get(f"/api/layers/geojson/{TEST_AOI}/parcels")
    assert res_layers.status_code == 200
    assert res_layers.json()["type"] == "FeatureCollection"
    
    res_analytics = client.get(f"/api/analytics/summary/{TEST_AOI}")
    assert res_analytics.status_code == 200
    assert res_analytics.json()["total_parcels"] > 0
