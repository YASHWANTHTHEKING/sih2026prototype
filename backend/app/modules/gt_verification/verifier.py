import os
import json
import datetime
from typing import Dict, Any, List, Optional
from shapely.geometry import shape, Point

from ...core.config import settings

class GroundTruthingVerifier:
    def __init__(self, aoi_id: str):
        self.aoi_id = aoi_id
        self.aoi_dir = settings.DATA_DIR / "aois" / aoi_id
        self.vectors_dir = self.aoi_dir / "vectors"
        self.audit_log_path = settings.DATA_DIR / "audit_logs" / f"{aoi_id}_audit_trail.json"
        
    def get_gt_points(self) -> Dict[str, Any]:
        """Returns GNSS survey points and verification tasks."""
        gt_path = self.vectors_dir / "gnss_cors_survey_points.geojson"
        if not gt_path.exists():
            return {"type": "FeatureCollection", "features": []}
        with open(gt_path, "r", encoding="utf-8") as f:
            return json.load(f)
            
    def sign_off_parcel(
        self,
        parcel_id: str,
        surveyor_name: str,
        surveyor_id: str,
        status: str,  # 'Approved', 'Field Verified', 'Rejected', 'Modified'
        notes: str = "",
        gnss_delta_cm: float = 1.2
    ) -> Dict[str, Any]:
        """
        Records a formal Ground Truthing sign-off for a parcel.
        Logs timestamp, surveyor credentials, and updates parcel status.
        """
        parcels_path = self.vectors_dir / "ai_inferred_parcels.geojson"
        if not parcels_path.exists():
            parcels_path = self.vectors_dir / "ground_truth_parcels.geojson"
            
        target_parcel = None
        target_path = parcels_path
        parcels_fc = None

        if parcels_path.exists():
            with open(parcels_path, "r", encoding="utf-8") as f:
                parcels_fc = json.load(f)
            for feat in parcels_fc.get("features", []):
                if feat["properties"].get("parcel_id") == parcel_id:
                    target_parcel = feat
                    break

        # If not found in current AOI, search all AOIs in data_store
        if not target_parcel:
            aois_dir = settings.DATA_DIR / "aois"
            for aoi_folder in aois_dir.iterdir():
                if aoi_folder.is_dir():
                    candidate_path = aoi_folder / "vectors" / "ai_inferred_parcels.geojson"
                    if candidate_path.exists():
                        with open(candidate_path, "r", encoding="utf-8") as f:
                            cand_fc = json.load(f)
                        for feat in cand_fc.get("features", []):
                            if feat["properties"].get("parcel_id") == parcel_id:
                                target_parcel = feat
                                target_path = candidate_path
                                parcels_fc = cand_fc
                                self.aoi_id = aoi_folder.name
                                break
                    if target_parcel:
                        break

        if not target_parcel:
            return {"status": "error", "message": f"Parcel {parcel_id} not found"}

        target_parcel["properties"]["verification_status"] = status
        target_parcel["properties"]["gt_surveyor"] = surveyor_name
        target_parcel["properties"]["gt_surveyor_id"] = surveyor_id
        target_parcel["properties"]["gt_signoff_date"] = datetime.datetime.utcnow().isoformat() + "Z"
        target_parcel["properties"]["gt_notes"] = notes
        target_parcel["properties"]["gnss_delta_cm"] = gnss_delta_cm
            
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(parcels_fc, f, indent=2)
            
        # Append to audit trail
        audit_entry = {
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "action": "GT_PARCEL_SIGNOFF",
            "parcel_id": parcel_id,
            "survey_number": target_parcel["properties"].get("survey_number"),
            "status": status,
            "surveyor_name": surveyor_name,
            "surveyor_id": surveyor_id,
            "notes": notes,
            "gnss_delta_cm": gnss_delta_cm
        }
        
        audit_records = []
        if self.audit_log_path.exists():
            try:
                with open(self.audit_log_path, "r", encoding="utf-8") as f:
                    audit_records = json.load(f)
            except Exception:
                audit_records = []
                
        audit_records.append(audit_entry)
        with open(self.audit_log_path, "w", encoding="utf-8") as f:
            json.dump(audit_records, f, indent=2)
            
        return {
            "status": "success",
            "message": f"Parcel {parcel_id} marked as '{status}' by {surveyor_name}",
            "audit_entry": audit_entry
        }

    def get_audit_trail(self) -> List[Dict[str, Any]]:
        if not self.audit_log_path.exists():
            return []
        with open(self.audit_log_path, "r", encoding="utf-8") as f:
            return json.load(f)
