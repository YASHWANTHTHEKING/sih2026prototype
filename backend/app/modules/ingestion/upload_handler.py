import io
import os
import json
import time
import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
from PIL import Image
import rasterio
from rasterio.transform import from_bounds

from ...core.config import settings
from ...core.geo_utils import get_transformer

def ingest_uploaded_drone_image(
    file_bytes: bytes,
    filename: str,
    center_lat: float,
    center_lon: float,
    width_m: float = 300.0,
    height_m: float = 300.0,
    name: Optional[str] = None,
    aoi_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Ingests a raw user-uploaded drone photograph or orthomosaic (JPG, PNG, TIFF).
    Georeferences it around the user-supplied geographic center coordinate (WGS84)
    spanning the specified width_m and height_m in projected CRS (EPSG:32643),
    generates orthomosaic_rgb.tif, and writes a metadata.json record conforming
    to the GeoCadastre AI specifications.
    """
    # 1. Generate unique AOI identifier
    if not aoi_id:
        timestamp_ms = int(time.time() * 1000)
        aoi_id = f"aoi_upload_{timestamp_ms}"

    aoi_dir = settings.DATA_DIR / "aois" / aoi_id
    rasters_dir = aoi_dir / "rasters"
    vectors_dir = aoi_dir / "vectors"
    chips_dir = aoi_dir / "chips"

    os.makedirs(rasters_dir, exist_ok=True)
    os.makedirs(vectors_dir, exist_ok=True)
    os.makedirs(chips_dir, exist_ok=True)

    # 2. Decode the raw image with Pillow (RGB)
    try:
        pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Failed to decode image file: {str(e)}")

    img_width_px, img_height_px = pil_img.size
    rgb_arr = np.array(pil_img) # (H, W, 3), uint8

    # 3. Reproject supplied WGS84 center point to projected CRS (EPSG:32643)
    transformer_to_proj = get_transformer(
        settings.DEFAULT_GEOGRAPHIC_CRS,
        settings.DEFAULT_PROJECTED_CRS
    )
    center_proj_x, center_proj_y = transformer_to_proj.transform(center_lon, center_lat)

    # 4. Compute projected bounding box [min_x, min_y, max_x, max_y]
    min_x = center_proj_x - (width_m / 2.0)
    max_x = center_proj_x + (width_m / 2.0)
    min_y = center_proj_y - (height_m / 2.0)
    max_y = center_proj_y + (height_m / 2.0)

    # 5. Build north-up affine transform from bounds
    transform = from_bounds(min_x, min_y, max_x, max_y, img_width_px, img_height_px)
    pixel_res = width_m / float(img_width_px)

    # 6. Write orthomosaic_rgb.tif (3 bands, uint8) with projected CRS
    rgb_tif_path = rasters_dir / "orthomosaic_rgb.tif"
    with rasterio.open(
        rgb_tif_path,
        "w",
        driver="GTiff",
        height=img_height_px,
        width=img_width_px,
        count=3,
        dtype=rasterio.uint8,
        crs=settings.DEFAULT_PROJECTED_CRS,
        transform=transform,
    ) as dst:
        for band_idx in range(3):
            dst.write(rgb_arr[:, :, band_idx], band_idx + 1)

    # Save PNG preview for easy web rendering
    pil_img.save(rasters_dir / "orthomosaic_preview.png")

    # 7. Write metadata.json matching sample_generator.py format + upload flags
    metadata = {
        "aoi_id": aoi_id,
        "name": name or f"Drone Upload: {Path(filename).stem}",
        "location": f"Custom Georeferenced Pilot ({round(center_lat, 4)}°N, {round(center_lon, 4)}°E)",
        "bounds_projected": [round(min_x, 3), round(min_y, 3), round(max_x, 3), round(max_y, 3)],
        "center_lat": round(center_lat, 6),
        "center_lon": round(center_lon, 6),
        "crs_projected": settings.DEFAULT_PROJECTED_CRS,
        "crs_geographic": settings.DEFAULT_GEOGRAPHIC_CRS,
        "image_size_px": [img_width_px, img_height_px],
        "ground_resolution_m_per_px": round(pixel_res, 4),
        "total_area_hectares": round((width_m * height_m) / 10000.0, 2),
        "total_gt_parcels": 0,
        "total_gt_buildings": 0,
        "total_gt_roads": 0,
        "total_gnss_points": 0,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "data_source": "user_uploaded_drone_image",
        "source_filename": filename,
        "has_dsm_dtm": False
    }

    with open(aoi_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return metadata
