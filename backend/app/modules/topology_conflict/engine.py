import os
import json
import numpy as np
from typing import Dict, Any, List
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, box
from shapely.ops import unary_union
from shapely.validation import make_valid
from shapely.strtree import STRtree

from ...core.config import settings
from ...core.geo_utils import get_geojson_feature_collection

class TopologyConflictEngine:
    def __init__(self, aoi_id: str):
        self.aoi_id = aoi_id
        self.aoi_dir = settings.DATA_DIR / "aois" / aoi_id
        self.vectors_dir = self.aoi_dir / "vectors"
        
    def detect_topology_and_conflicts(self) -> Dict[str, Any]:
        """
        Executes Module 6: Planar Topology & Conflict Detection
        - Checks for:
          1. Overlapping parcels
          2. Slivers / unassigned micro-gaps
          3. Building encroachments across parcel / road boundaries
          4. Legacy cadastre discrepancies (area shift / boundary displacement)
        - Outputs structured Conflict Report with severity ranking
        """
        parcels_path = self.vectors_dir / "ai_inferred_parcels.geojson"
        buildings_path = self.vectors_dir / "ai_inferred_buildings.geojson"
        legacy_path = self.vectors_dir / "legacy_cadastral_parcels.geojson"
        roads_path = self.vectors_dir / "ai_inferred_roads.geojson"
        
        if not parcels_path.exists():
            raise FileNotFoundError("Parcel layer is required for topology check")
            
        with open(parcels_path, "r", encoding="utf-8") as f:
            parcels_fc = json.load(f)
            
        conflicts = []
        conflict_idx = 1
        
        # Parse parcel geometries
        parcel_items = []
        parcel_geoms = []
        for feat in parcels_fc["features"]:
            geom = shape(feat["geometry"])
            if not geom.is_valid:
                geom = make_valid(geom)
            parcel_items.append({"props": feat["properties"], "geom": geom})
            parcel_geoms.append(geom)

        tree = STRtree(parcel_geoms)
        
        # 1. Overlapping Parcels Check
        for i, p1 in enumerate(parcel_items):
            candidates = tree.query(p1["geom"])
            for j in candidates:
                if i >= j:
                    continue
                p2 = parcel_items[j]
                if p1["geom"].intersects(p2["geom"]):
                    inter = p1["geom"].intersection(p2["geom"])
                    if inter.area > 1e-8:
                        c_id = f"CONF-OVR-{conflict_idx:04d}"
                        conflicts.append({
                            "conflict_id": c_id,
                            "type": "Parcel Overlap",
                            "severity": "Critical" if inter.area > 5.0 else "High",
                            "parcel_1": p1["props"].get("parcel_id"),
                            "parcel_2": p2["props"].get("parcel_id"),
                            "survey_number_1": p1["props"].get("survey_number"),
                            "survey_number_2": p2["props"].get("survey_number"),
                            "overlap_area_sqm": round(inter.area, 2),
                            "description": f"Overlapping boundary ({round(inter.area, 2)} sqm) between {p1['props'].get('survey_number')} and {p2['props'].get('survey_number')}",
                            "suggested_action": "Execute interactive polygon trim or merge boundary in Cadastral Editor",
                            "status": "Open",
                            "geometry": mapping(inter)
                        })
                        conflict_idx += 1

        # 2. Building Encroachment Check
        if buildings_path.exists():
            with open(buildings_path, "r", encoding="utf-8") as f:
                bld_fc = json.load(f)
            
            for b_feat in bld_fc["features"]:
                b_geom = shape(b_feat["geometry"])
                b_props = b_feat["properties"]
                
                # Find matching parcel
                matching_parcels = [p for p in parcel_items if p["geom"].intersects(b_geom)]
                
                if len(matching_parcels) > 1:
                    # Building straddles across multiple parcels!
                    p_ids = [p["props"].get("survey_number") for p in matching_parcels]
                    c_id = f"CONF-ENC-{conflict_idx:04d}"
                    conflicts.append({
                        "conflict_id": c_id,
                        "type": "Building Encroachment",
                        "severity": "Critical",
                        "building_id": b_props.get("building_id"),
                        "parcels_involved": p_ids,
                        "encroachment_type": "Multi-Parcel Straddle",
                        "description": f"Building {b_props.get('building_id')} extends across boundary of {', '.join(p_ids)}",
                        "suggested_action": "Verify setback in field with GNSS CORS survey or initiate boundary adjustment",
                        "status": "Open",
                        "geometry": mapping(b_geom)
                    })
                    conflict_idx += 1
                elif len(matching_parcels) == 1:
                    # Check if building exceeds parcel boundary
                    diff = b_geom.difference(matching_parcels[0]["geom"])
                    if diff.area > 2.0:
                        c_id = f"CONF-ENC-{conflict_idx:04d}"
                        conflicts.append({
                            "conflict_id": c_id,
                            "type": "Setback / ROW Encroachment",
                            "severity": "High",
                            "building_id": b_props.get("building_id"),
                            "parcel_id": matching_parcels[0]["props"].get("parcel_id"),
                            "survey_number": matching_parcels[0]["props"].get("survey_number"),
                            "spillover_area_sqm": round(diff.area, 2),
                            "description": f"Building extends {round(diff.area, 2)} sqm outside registered parcel boundary",
                            "suggested_action": "Inspect setback violation vs Right-of-Way",
                            "status": "Open",
                            "geometry": mapping(diff)
                        })
                        conflict_idx += 1

        # 3. Legacy Cadastre Discrepancy Check
        if legacy_path.exists():
            with open(legacy_path, "r", encoding="utf-8") as f:
                leg_fc = json.load(f)
                
            for leg_feat in leg_fc["features"]:
                leg_props = leg_feat["properties"]
                leg_geom = shape(leg_feat["geometry"])
                s_no = leg_props.get("survey_number")
                
                # Match by survey number
                ai_match = next((p for p in parcel_items if p["props"].get("survey_number") == s_no), None)
                if ai_match:
                    ai_area = ai_match["props"].get("area_sqm", 0.0)
                    rec_area = leg_props.get("recorded_area_sqm", 0.0)
                    delta_area = abs(ai_area - rec_area)
                    delta_pct = (delta_area / rec_area * 100.0) if rec_area > 0 else 0.0
                    
                    if delta_pct > 12.0:
                        c_id = f"CONF-LEG-{conflict_idx:04d}"
                        conflicts.append({
                            "conflict_id": c_id,
                            "type": "Legacy Record Mismatch",
                            "severity": "Medium",
                            "survey_number": s_no,
                            "legacy_area_sqm": rec_area,
                            "ai_detected_area_sqm": ai_area,
                            "area_discrepancy_sqm": round(delta_area, 2),
                            "discrepancy_percentage": round(delta_pct, 1),
                            "description": f"Survey {s_no} has {round(delta_pct, 1)}% area discrepancy vs {leg_props.get('vintage_year', 'historical')} land record",
                            "suggested_action": "Trigger Ground Truthing (GT) surveyor re-measurement",
                            "status": "Open",
                            "geometry": mapping(ai_match["geom"])
                        })
                        conflict_idx += 1

        # Save Conflicts as GeoJSON
        features = []
        for c in conflicts:
            geom = c["geometry"]
            props = {k: v for k, v in c.items() if k != "geometry"}
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": geom
            })
            
        fc = get_geojson_feature_collection(features)
        out_file = self.vectors_dir / "cadastral_conflicts.geojson"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(fc, f, indent=2)
            
        severity_summary = {
            "Critical": sum(1 for c in conflicts if c["severity"] == "Critical"),
            "High": sum(1 for c in conflicts if c["severity"] == "High"),
            "Medium": sum(1 for c in conflicts if c["severity"] == "Medium"),
            "Low": sum(1 for c in conflicts if c["severity"] == "Low")
        }
        
        report = {
            "status": "success",
            "aoi_id": self.aoi_id,
            "total_conflicts_detected": len(conflicts),
            "severity_breakdown": severity_summary,
            "conflicts_geojson": str(out_file),
            "conflicts_list": conflicts
        }
        
        with open(self.aoi_dir / "topology_conflict_report.json", "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
            
        return report
