import json
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from ..core.config import settings

router = APIRouter()

@router.get("/summary/{aoi_id}")
def get_analytics_summary(aoi_id: str):
    """
    Returns comprehensive analytics & KPI dashboard statistics:
    - Total parcels count and mapped area
    - Confidence distribution
    - Land use breakdown
    - Conflict counts by severity
    - Property tax assessment potential
    - Ground truthing sign-off progress
    """
    aoi_dir = settings.DATA_DIR / "aois" / aoi_id
    vectors_dir = aoi_dir / "vectors"
    
    parcels_path = vectors_dir / "ai_inferred_parcels.geojson"
    if not parcels_path.exists():
        parcels_path = vectors_dir / "ground_truth_parcels.geojson"
        
    conflicts_path = vectors_dir / "cadastral_conflicts.geojson"
    meta_path = aoi_dir / "metadata.json"
    
    if not parcels_path.exists() or not meta_path.exists():
        raise HTTPException(status_code=404, detail="AOI data not found")
        
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
        
    with open(parcels_path, "r", encoding="utf-8") as f:
        parcels_fc = json.load(f)
        
    conflicts_fc = {"features": []}
    if conflicts_path.exists():
        with open(conflicts_path, "r", encoding="utf-8") as f:
            conflicts_fc = json.load(f)
            
    total_parcels = len(parcels_fc["features"])
    total_area_sqm = sum(f["properties"].get("area_sqm", 0.0) for f in parcels_fc["features"])
    total_tax_val = sum(f["properties"].get("tax_assessment_annual_inr", int(f["properties"].get("area_sqm", 100)*2200)) for f in parcels_fc["features"])
    
    # Confidence breakdown
    high_conf = sum(1 for f in parcels_fc["features"] if f["properties"].get("confidence_score", 0.85) >= 0.85)
    med_conf = sum(1 for f in parcels_fc["features"] if 0.70 <= f["properties"].get("confidence_score", 0.85) < 0.85)
    low_conf = total_parcels - high_conf - med_conf
    
    # Land use breakdown
    lu_counts = {}
    for f in parcels_fc["features"]:
        lu = f["properties"].get("landuse_class", "Residential")
        lu_counts[lu] = lu_counts.get(lu, 0) + 1
        
    # Verification status
    status_counts = {}
    for f in parcels_fc["features"]:
        st = f["properties"].get("verification_status", "AI Confirmed")
        status_counts[st] = status_counts.get(st, 0) + 1
        
    # Conflicts severity
    conf_severity = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    for c in conflicts_fc.get("features", []):
        sev = c["properties"].get("severity", "Medium")
        conf_severity[sev] = conf_severity.get(sev, 0) + 1
        
    return {
        "aoi_id": aoi_id,
        "aoi_name": meta.get("name", aoi_id),
        "total_area_hectares": meta.get("total_area_hectares", round(total_area_sqm / 10000.0, 2)),
        "total_parcels": total_parcels,
        "total_mapped_area_sqm": round(total_area_sqm, 2),
        "auto_mapped_rate_pct": round((high_conf / max(1, total_parcels)) * 100.0, 1),
        "estimated_annual_property_tax_inr": total_tax_val,
        "confidence_distribution": {
            "High (>= 85%)": high_conf,
            "Medium (70-84%)": med_conf,
            "Needs GT (< 70%)": low_conf
        },
        "landuse_distribution": lu_counts,
        "verification_status_distribution": status_counts,
        "total_conflicts": len(conflicts_fc.get("features", [])),
        "conflict_severity_distribution": conf_severity,
        "average_extraction_confidence": round(float(sum(f["properties"].get("confidence_score", 0.88) for f in parcels_fc["features"]) / max(1, total_parcels)), 3)
    }
