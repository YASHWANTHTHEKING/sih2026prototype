from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional

from ..modules.gt_verification.verifier import GroundTruthingVerifier

router = APIRouter()

class GtSignOffRequest(BaseModel):
    aoi_id: str
    parcel_id: str
    surveyor_name: str
    surveyor_id: str
    status: str = "Approved" # Approved / Field Verified / Rejected
    notes: str = ""
    gnss_delta_cm: float = 1.2

@router.post("/signoff")
def submit_ground_truth_signoff(req: GtSignOffRequest):
    """Submits official Ground Truthing signoff for a parcel."""
    verifier = GroundTruthingVerifier(req.aoi_id)
    res = verifier.sign_off_parcel(
        parcel_id=req.parcel_id,
        surveyor_name=req.surveyor_name,
        surveyor_id=req.surveyor_id,
        status=req.status,
        notes=req.notes,
        gnss_delta_cm=req.gnss_delta_cm
    )
    return res

@router.get("/audit-trail/{aoi_id}")
def get_audit_trail(aoi_id: str):
    """Returns the immutable audit log for field surveys and edits."""
    verifier = GroundTruthingVerifier(aoi_id)
    return {"audit_trail": verifier.get_audit_trail()}

@router.get("/gnss-points/{aoi_id}")
def get_gnss_control_points(aoi_id: str):
    """Returns GNSS CORS control points."""
    verifier = GroundTruthingVerifier(aoi_id)
    return verifier.get_gt_points()
