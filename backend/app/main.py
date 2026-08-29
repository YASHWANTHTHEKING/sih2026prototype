import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core.config import settings
from .data.sample_generator import generate_sample_aoi
from .api import (
    routes_pipeline,
    routes_layers,
    routes_editor,
    routes_gt,
    routes_analytics,
    routes_export,
    routes_benchmark,
    routes_upload
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure sample AOI exists for immediate demonstration
    default_aoi_dir = settings.DATA_DIR / "aois" / "aoi_urban_ward_07"
    if not default_aoi_dir.exists():
        print("Generating initial Pilot Area of Interest (AOI)...")
        generate_sample_aoi("aoi_urban_ward_07")
        print("Pilot AOI generated successfully!")
    yield
    # Shutdown logic if any

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-Based Automated Cadastral Mapping & Urban Parcel Extraction Platform",
    lifespan=lifespan
)

# Enable CORS for React frontend (Vite port 5173, 3000, 8000, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(routes_pipeline.router, prefix=f"{settings.API_PREFIX}/pipeline", tags=["Pipeline"])
app.include_router(routes_layers.router, prefix=f"{settings.API_PREFIX}/layers", tags=["GIS Layers"])
app.include_router(routes_editor.router, prefix=f"{settings.API_PREFIX}/editor", tags=["Cadastral Editor"])
app.include_router(routes_gt.router, prefix=f"{settings.API_PREFIX}/gt", tags=["Ground Truthing"])
app.include_router(routes_analytics.router, prefix=f"{settings.API_PREFIX}/analytics", tags=["Analytics"])
app.include_router(routes_export.router, prefix=f"{settings.API_PREFIX}/export", tags=["Exports"])
app.include_router(routes_benchmark.router, prefix=f"{settings.API_PREFIX}/benchmark", tags=["Benchmarks"])
app.include_router(routes_upload.router, prefix=f"{settings.API_PREFIX}/upload", tags=["Drone Image Upload"])

@app.get("/")
def root_status():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "documentation": "/docs",
        "health": "/api/health",
        "endpoints": {
            "aois": f"{settings.API_PREFIX}/layers/aois",
            "metadata": f"{settings.API_PREFIX}/layers/metadata/aoi_urban_ward_07",
            "parcels": f"{settings.API_PREFIX}/layers/geojson/aoi_urban_ward_07/parcels"
        }
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "crs": settings.DEFAULT_PROJECTED_CRS
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
