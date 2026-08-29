import os
import json
from typing import Dict, Any, List, Tuple, Optional
import cv2
import numpy as np
import rasterio
from rasterio.transform import xy
from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.validation import make_valid

from ...core.config import settings
from ...core.geo_utils import regularize_polygon, get_geojson_feature_collection, reproject_geojson

class BuildingFootprintExtractor:
    def __init__(self, aoi_id: str):
        self.aoi_id = aoi_id
        self.aoi_dir = settings.DATA_DIR / "aois" / aoi_id
        self.rasters_dir = self.aoi_dir / "rasters"
        self.vectors_dir = self.aoi_dir / "vectors"
        
    def extract_building_footprints(
        self,
        min_height_thresh_m: float = 2.5,
        min_area_m2: float = 20.0,
        regularize: bool = True,
        confidence_min: float = 0.50
    ) -> Dict[str, Any]:
        """
        Executes Module 2: Building Footprint Extraction
        - Multi-channel analysis (nDSM height + RGB spectral contrast) if nDSM exists
        - RGB-only computer vision (Canny edge + adaptive thresholding) if no DSM/DTM survey
        - Connected component & contour detection
        - Right-angle rectilinear regularization
        - Output GeoJSON layer with heights (if available) and confidence ratings
        """
        rgb_path = self.rasters_dir / "orthomosaic_rgb.tif"
        ndsm_path = self.rasters_dir / "ndsm.tif"
        has_ndsm = ndsm_path.exists()
        
        with rasterio.open(rgb_path) as src_rgb:
            rgb = src_rgb.read([1, 2, 3])
            transform = src_rgb.transform
            h, w = src_rgb.shape
            pixel_res = src_rgb.res[0]

        if has_ndsm:
            with rasterio.open(ndsm_path) as src_ndsm:
                ndsm = src_ndsm.read(1)
            # 1. Height mask from nDSM
            height_mask = (ndsm >= min_height_thresh_m).astype(np.uint8) * 255
        else:
            ndsm = None
            # RGB-only fallback segmentation (adaptive threshold + Canny edges)
            rgb_hwc = np.transpose(rgb, (1, 2, 0))
            gray = cv2.cvtColor(rgb_hwc, cv2.COLOR_RGB2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            canny = cv2.Canny(blurred, 40, 120)
            canny_dilated = cv2.dilate(canny, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
            adaptive = cv2.adaptiveThreshold(
                blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 5
            )
            height_mask = cv2.bitwise_or(canny_dilated, adaptive)
        
        # 2. Morphological filtering to eliminate small noise and bridge rooftop discontinuities
        kernel_clean = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        height_mask = cv2.morphologyEx(height_mask, cv2.MORPH_CLOSE, kernel_clean)
        height_mask = cv2.morphologyEx(height_mask, cv2.MORPH_OPEN, kernel_clean)
        
        # 3. Find rooftop contours
        contours, hierarchy = cv2.findContours(height_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        extracted_buildings = []
        bld_idx = 1
        
        min_pixel_area = min_area_m2 / (pixel_res * pixel_res)
        
        for cnt in contours:
            area_px = cv2.contourArea(cnt)
            if area_px < min_pixel_area:
                continue
                
            # Convert contour pixel coordinates to projected geospatial coordinates
            poly_coords = []
            for pt in cnt:
                c = np.asarray(pt).ravel()
                if len(c) < 2:
                    continue
                px, py = int(c[0]), int(c[1])
                geo_x, geo_y = xy(transform, py, px)
                poly_coords.append((geo_x, geo_y))
                
            if len(poly_coords) < 3:
                continue
                
            poly_coords.append(poly_coords[0])  # Close ring
            
            try:
                poly = Polygon(poly_coords)
                if not poly.is_valid:
                    poly = make_valid(poly)
                if poly.is_empty or poly.area < min_area_m2:
                    continue
                if poly.geom_type == "MultiPolygon":
                    poly = max(poly.geoms, key=lambda p: p.area)
                    
                # Apply orthogonal right-angle regularization
                if regularize:
                    poly = regularize_polygon(poly, angle_tolerance_deg=18.0, distance_tolerance_m=0.8)
                    
                if has_ndsm and ndsm is not None:
                    # Compute height stats inside polygon from real elevation data
                    mask_poly = np.zeros((h, w), dtype=np.uint8)
                    cv2.drawContours(mask_poly, [cnt], -1, 255, -1)
                    poly_heights = ndsm[mask_poly > 0]
                    mean_h = float(np.mean(poly_heights)) if len(poly_heights) > 0 else min_height_thresh_m
                    max_h = float(np.max(poly_heights)) if len(poly_heights) > 0 else min_height_thresh_m
                    floors = max(1, int(round(mean_h / 3.0)))
                    conf = float(np.clip(0.80 + (0.15 * min(1.0, mean_h / 10.0)), 0.70, 0.99))
                    ext_method = "Multi-Channel nDSM + Orthogonal Regularization"
                    h_available = True
                else:
                    # RGB-only: do NOT synthesize fake height values
                    mean_h = None
                    max_h = None
                    floors = None
                    h_available = False
                    
                    # Compute geometric confidence from solidity and rectangularity
                    hull = cv2.convexHull(cnt)
                    hull_area = cv2.contourArea(hull)
                    solidity = float(area_px / hull_area) if hull_area > 0 else 0.5
                    
                    rect = cv2.minAreaRect(cnt)
                    rect_area = float(rect[1][0] * rect[1][1])
                    rectangularity = float(area_px / rect_area) if rect_area > 0 else 0.5
                    
                    conf = float(np.clip(0.55 + 0.20 * solidity + 0.15 * rectangularity, 0.55, 0.90))
                    ext_method = "RGB-Only Edge/Contour Segmentation (no DSM/DTM survey)"
                
                if conf < confidence_min:
                    continue
                    
                b_id = f"AI-BLD-{self.aoi_id.replace('aoi_', '')}-{bld_idx:04d}"
                extracted_buildings.append({
                    "building_id": b_id,
                    "height_mean_m": round(mean_h, 2) if mean_h is not None else None,
                    "height_max_m": round(max_h, 2) if max_h is not None else None,
                    "estimated_floors": floors,
                    "height_data_available": h_available,
                    "footprint_area_sqm": round(poly.area, 2),
                    "perimeter_m": round(poly.length, 2),
                    "confidence_score": round(conf, 3),
                    "extraction_method": ext_method,
                    "geometry": poly
                })
                bld_idx += 1
            except Exception as e:
                continue

        # Save as GeoJSON (Projected & Reprojected to WGS84 for Web-GIS)
        features = []
        for b in extracted_buildings:
            geom = b["geometry"]
            props = {k: v for k, v in b.items() if k != "geometry"}
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": mapping(geom)
            })
            
        fc_proj = get_geojson_feature_collection(features)
        fc_wgs84 = reproject_geojson(fc_proj, settings.DEFAULT_PROJECTED_CRS, settings.DEFAULT_GEOGRAPHIC_CRS)
        
        out_file = self.vectors_dir / "ai_inferred_buildings.geojson"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(fc_wgs84, f, indent=2)
            
        valid_heights = [b["height_mean_m"] for b in extracted_buildings if b["height_mean_m"] is not None]
        mean_height = round(float(np.mean(valid_heights)), 2) if valid_heights else None
        
        return {
            "status": "success",
            "aoi_id": self.aoi_id,
            "total_buildings_extracted": len(extracted_buildings),
            "mean_building_height_m": mean_height,
            "height_data_available": has_ndsm,
            "extraction_method": "Multi-Channel nDSM + Orthogonal Regularization" if has_ndsm else "RGB-Only Edge/Contour Segmentation (no DSM/DTM survey)",
            "geojson_path": str(out_file),
            "buildings": extracted_buildings
        }
