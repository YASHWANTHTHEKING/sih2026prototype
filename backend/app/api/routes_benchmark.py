from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from ..modules.evaluation.evaluator import EvaluationSuite
from ..core.config import settings

router = APIRouter()

@router.get("/run/{aoi_id}")
def run_evaluation_benchmarks(aoi_id: str):
    """Executes Module 9 benchmark suite and returns metrics."""
    try:
        suite = EvaluationSuite(aoi_id)
        benchmarks = suite.run_benchmarks()
        return benchmarks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
