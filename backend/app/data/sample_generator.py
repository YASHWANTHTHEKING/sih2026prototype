import os
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import Polygon, LineString, Point, box, mapping
from shapely.ops import unary_union, split
from shapely.validation import make_valid
import rasterio
from rasterio.transform import from_bounds

from ..core.config import settings
from ..core.geo_utils import get_geojson_feature_collection, reproject_geojson, get_transformer

def generate_sample_aoi(aoi_id: str = "aoi_urban_ward_07", center_lat: float = 28.6139, center_lon: float = 77.2090, width_m: float = 600.0, height_m: float = 600.0):
    """
    Generates a full-featured realistic sample Area of Interest (AOI):
    - Drone Orthorectified Imagery (ORI)
    - DSM, DTM, nDSM (Building Heights)
    - Ground Truth Cadastre, Buildings, Roads, Land-Use
    - Legacy Cadastral map with intentional real-world discrepancies (encroachments, boundary shifts)
    - GNSS CORS Survey Control Points
    """
    aoi_dir = settings.DATA_DIR / "aois" / aoi_id
    os.makedirs(aoi_dir, exist_ok=True)
    os.makedirs(aoi_dir / "rasters", exist_ok=True)
    os.makedirs(aoi_dir / "vectors", exist_ok=True)
    
    # Raster dimensions
    img_size = 1200  # 1200x1200 pixels -> 0.5m/pixel resolution for 600m x 600m
    pixel_res = width_m / img_size
    
    # Calculate projected UTM coordinates from center lat/lon
    to_proj = get_transformer(settings.DEFAULT_GEOGRAPHIC_CRS, settings.DEFAULT_PROJECTED_CRS)
    center_proj_x, center_proj_y = to_proj.transform(center_lon, center_lat)
    
    min_x, max_x = center_proj_x - (width_m / 2.0), center_proj_x + (width_m / 2.0)
    min_y, max_y = center_proj_y - (height_m / 2.0), center_proj_y + (height_m / 2.0)
    
    transform = from_bounds(min_x, min_y, max_x, max_y, img_size, img_size)
    
    # Arrays for synthesis
    rgb_img = np.zeros((img_size, img_size, 3), dtype=np.uint8)
    dsm_arr = np.zeros((img_size, img_size), dtype=np.float32)
    dtm_arr = np.zeros((img_size, img_size), dtype=np.float32)
    
    # Base terrain slope: gradual elevation from 210m to 216m
    for r in range(img_size):
        for c in range(img_size):
            base_elev = 210.0 + 3.0 * (r / img_size) + 3.0 * (c / img_size) + 0.3 * np.sin(r/40.0) * np.cos(c/40.0)
            dtm_arr[r, c] = base_elev
            dsm_arr[r, c] = base_elev
            # Ground texture (natural soil / grass / paved base)
            rgb_img[r, c] = [170 + int(np.random.randint(0, 15)), 175 + int(np.random.randint(0, 15)), 160 + int(np.random.randint(0, 15))]

    # 1. Generate Organic Road Network & Blocks
    roads_list = []
    road_polys = []
    
    # Primary Arterial Road (realistic angle across AOI)
    p_mid_y = min_y + height_m * 0.52
    primary_road_line = LineString([
        (min_x, p_mid_y - 25.0),
        (min_x + width_m * 0.45, p_mid_y + 12.0),
        (max_x, p_mid_y - 10.0)
    ])
    p_width = 14.0
    road_polys.append(primary_road_line.buffer(p_width / 2.0, cap_style="flat"))
    roads_list.append({
        "road_id": "RD_PRIMARY_01",
        "name": "MG Road / Revenue Arterial",
        "hierarchy": "Major Arterial",
        "width_m": p_width,
        "surface": "Asphalt",
        "geometry": primary_road_line
    })

    # Secondary Access Connectors (Angled / Organic)
    sec_corridors = [
        LineString([(min_x, min_y + height_m * 0.78), (max_x, min_y + height_m * 0.82)]),
        LineString([(min_x, min_y + height_m * 0.24), (max_x, min_y + height_m * 0.20)]),
        LineString([(min_x + width_m * 0.32, min_y), (min_x + width_m * 0.28, max_y)]),
        LineString([(min_x + width_m * 0.68, min_y), (min_x + width_m * 0.72, max_y)]),
    ]
    for idx, s_line in enumerate(sec_corridors):
        s_width = 9.0
        road_polys.append(s_line.buffer(s_width / 2.0, cap_style="flat"))
        roads_list.append({
            "road_id": f"RD_ACCESS_{idx+1}",
            "name": f"Survey Access Sector Lane {idx+1}",
            "hierarchy": "Secondary Access",
            "width_m": s_width,
            "surface": "Asphalt",
            "geometry": s_line
        })
        
    combined_roads_union = unary_union(road_polys)
    
    # Burn roads onto rasters
    for r_poly in road_polys:
        if r_poly.geom_type == "Polygon":
            polys = [r_poly]
        else:
            polys = list(r_poly.geoms)
        for poly in polys:
            ext_coords = [( (x - min_x) / pixel_res, img_size - (y - min_y) / pixel_res ) for x, y in poly.exterior.coords]
            pil_poly = Image.new("L", (img_size, img_size), 0)
            draw = ImageDraw.Draw(pil_poly)
            draw.polygon(ext_coords, fill=255)
            mask = np.array(pil_poly) > 0
            rgb_img[mask] = [72 + int(np.random.randint(-4, 4)), 75 + int(np.random.randint(-4, 4)), 80 + int(np.random.randint(-4, 4))]

    # 2. Organic Parcel Partitioning & Feature Extraction
    aoi_box = box(min_x, min_y, max_x, max_y)
    blocks_geom = aoi_box.difference(combined_roads_union)
    
    parcels_gt = []
    buildings_gt = []
    legacy_parcels = []
    gnss_points = []
    
    roof_colors = [
        [195, 105, 80],   # Terracotta Tile
        [180, 185, 190],  # Concrete Slab
        [100, 130, 155],  # Industrial Tin
        [210, 205, 180],  # Light Stucco
        [135, 145, 135]   # Weathered RCC
    ]

    parcel_idx = 1
    building_idx = 1
    
    block_list = [blocks_geom] if blocks_geom.geom_type == "Polygon" else list(blocks_geom.geoms)
    
    for b_idx, block in enumerate(block_list):
        if block.area < 250.0:
            continue
        bx_min, by_min, bx_max, by_max = block.bounds
        bw = bx_max - bx_min
        bh = by_max - by_min
        
        # Multi-angle organic slice lines
        cut_lines = []
        
        # Horizontal tier cuts (varied street depths)
        n_tiers = max(1, int(bh / 45.0))
        y_cuts = np.linspace(by_min + 30.0, by_max - 30.0, n_tiers)
        for y in y_cuts:
            y_p1 = y + np.random.uniform(-6.0, 6.0)
            y_p2 = y + np.random.uniform(-6.0, 6.0)
            cut_lines.append(LineString([(bx_min - 20, y_p1), (bx_max + 20, y_p2)]))
            
        # Vertical / Angled lot frontage cuts
        n_lots = max(2, int(bw / 32.0))
        x_cuts = np.linspace(bx_min + 20.0, bx_max - 20.0, n_lots)
        for x in x_cuts:
            x_p1 = x + np.random.uniform(-7.0, 7.0)
            x_p2 = x + np.random.uniform(-7.0, 7.0)
            cut_lines.append(LineString([(x_p1, by_min - 20), (x_p2, by_max + 20)]))
            
        merged_cuts = unary_union(cut_lines)
        subdivided_block = split(block, merged_cuts)
        raw_parcels = [p for p in subdivided_block.geoms if p.area >= 90.0]
        
        for parcel_poly in raw_parcels:
            if parcel_poly.geom_type == "MultiPolygon":
                parcel_poly = max(parcel_poly.geoms, key=lambda p: p.area)
                
            upi = f"ULPIN-2026-{aoi_id[-4:]}-{parcel_idx:05d}"
            survey_no = f"SY-{100 + b_idx}/{parcel_idx}"
            
            # Realistic land use assignment
            if b_idx == 1 or parcel_idx % 8 == 0:
                lu_type = "Commercial"
            elif parcel_idx % 11 == 0:
                lu_type = "Mixed-Use"
            elif parcel_idx % 17 == 0:
                lu_type = "Institutional"
            elif parcel_idx % 19 == 0:
                lu_type = "Vacant/Green"
            else:
                lu_type = "Residential"
                
            # Add parcel GT
            parcels_gt.append({
                "parcel_id": upi,
                "survey_number": survey_no,
                "landuse": lu_type,
                "area_sqm": round(parcel_poly.area, 2),
                "owner_name": f"Owner SY-{survey_no} (Registered)",
                "property_tax_val": int(parcel_poly.area * (4500 if lu_type == "Commercial" else 2800)),
                "geometry": parcel_poly
            })
            
            # Legacy parcel (with realistic historic surveyor drift)
            legacy_geom = parcel_poly
            if parcel_idx % 6 == 0:
                legacy_geom = make_valid(parcel_poly.buffer(-2.2 if parcel_idx % 2 == 0 else 1.8))
            elif parcel_idx % 9 == 0:
                shift_delta = np.random.uniform(1.5, 3.5)
                legacy_geom = make_valid(box(parcel_poly.bounds[0] - shift_delta, parcel_poly.bounds[1], parcel_poly.bounds[2], parcel_poly.bounds[3]).intersection(aoi_box))
                
            legacy_parcels.append({
                "legacy_id": f"LEGACY-{survey_no.replace('/', '-')}",
                "survey_number": survey_no,
                "recorded_area_sqm": round(legacy_geom.area if not legacy_geom.is_empty else parcel_poly.area, 2),
                "vintage_year": 1998 + (parcel_idx % 22),
                "geometry": legacy_geom if not legacy_geom.is_empty else parcel_poly
            })
            
            # Create building inside parcel (unless vacant)
            if lu_type != "Vacant/Green" and parcel_poly.area > 120.0:
                b_setback = np.random.uniform(2.2, 3.8)
                b_inset = parcel_poly.buffer(-b_setback)
                if not b_inset.is_empty and b_inset.area >= 40.0:
                    if b_inset.geom_type == "MultiPolygon":
                        b_inset = max(b_inset.geoms, key=lambda p: p.area)
                        
                    # 30% of buildings get an L-shape footprint cutout
                    if parcel_idx % 3 == 0 and b_inset.area > 180.0:
                        bb = b_inset.bounds
                        cutout_box = box(bb[0], bb[1], bb[0] + (bb[2]-bb[0])*0.45, bb[1] + (bb[3]-bb[1])*0.45)
                        b_cut = b_inset.difference(cutout_box)
                        if not b_cut.is_empty and b_cut.area >= 35.0:
                            b_inset = b_cut if b_cut.geom_type == "Polygon" else max(b_cut.geoms, key=lambda p: p.area)
                            
                    floors = np.random.choice([1, 2, 3, 4, 6], p=[0.2, 0.45, 0.2, 0.1, 0.05])
                    b_height = float(floors * 3.2 + np.random.uniform(0.2, 0.8))
                    b_color = roof_colors[parcel_idx % len(roof_colors)]
                    
                    b_id = f"BLD-SURVEY-{building_idx:05d}"
                    buildings_gt.append({
                        "building_id": b_id,
                        "parcel_id": upi,
                        "height_m": round(b_height, 2),
                        "floors": int(floors),
                        "structure_type": "RCC Framed" if floors > 2 else "Masonry",
                        "confidence": round(float(np.random.uniform(0.91, 0.98)), 3),
                        "geometry": b_inset
                    })
                    
                    # Burn building onto RGB & DSM
                    if b_inset.geom_type == "Polygon":
                        b_polys = [b_inset]
                    else:
                        b_polys = list(b_inset.geoms)
                    for b_p in b_polys:
                        ext_coords = [( (x - min_x) / pixel_res, img_size - (y - min_y) / pixel_res ) for x, y in b_p.exterior.coords]
                        pil_poly = Image.new("L", (img_size, img_size), 0)
                        draw = ImageDraw.Draw(pil_poly)
                        draw.polygon(ext_coords, fill=255)
                        mask = np.array(pil_poly) > 0
                        for cr in range(3):
                            rgb_img[mask, cr] = np.clip(b_color[cr] + np.random.randint(-10, 10, size=np.count_nonzero(mask)), 0, 255)
                        dsm_arr[mask] += b_height
                        
                    building_idx += 1
                    
            parcel_idx += 1

    # 3. GNSS CORS Geodetic Benchmarks (Placed authentically at road intersections)
    gnss_node_id = 1
    for r in roads_list:
        line_pts = list(r["geometry"].coords)
        for pt in [line_pts[0], line_pts[-1]]:
            if min_x + 10 < pt[0] < max_x - 10 and min_y + 10 < pt[1] < max_y - 10:
                gnss_points.append({
                    "point_id": f"GSI-CORS-BM{gnss_node_id:03d}",
                    "parcel_ref": "Geodetic Control Network",
                    "easting": round(pt[0], 4),
                    "northing": round(pt[1], 4),
                    "elevation_m": round(float(dtm_arr[min(img_size-1, int((pt[1]-min_y)/pixel_res)), min(img_size-1, int((pt[0]-min_x)/pixel_res))]), 3),
                    "accuracy_cm": round(float(np.random.uniform(0.6, 1.8)), 2),
                    "surveyor_status": "Fixed CORS Monument",
                    "geometry": Point(pt[0], pt[1])
                })
                gnss_node_id += 1

                parcel_idx += 1

    # 3. Compute nDSM = DSM - DTM
    ndsm_arr = np.maximum(0.0, dsm_arr - dtm_arr)
    
    # Add subtle shadows & texture to RGB imagery for photorealism
    pil_rgb = Image.fromarray(rgb_img)
    pil_rgb = pil_rgb.filter(ImageFilter.SMOOTH_MORE)
    rgb_img = np.array(pil_rgb)
    
    # Save GeoTIFF Rasters
    # 1. Orthomosaic RGB
    with rasterio.open(
        aoi_dir / "rasters" / "orthomosaic_rgb.tif",
        "w",
        driver="GTiff",
        height=img_size,
        width=img_size,
        count=3,
        dtype=rasterio.uint8,
        crs=settings.DEFAULT_PROJECTED_CRS,
        transform=transform,
    ) as dst:
        for i in range(3):
            dst.write(rgb_img[:, :, i], i + 1)
            
    # 2. DSM
    with rasterio.open(
        aoi_dir / "rasters" / "dsm.tif",
        "w",
        driver="GTiff",
        height=img_size,
        width=img_size,
        count=1,
        dtype=rasterio.float32,
        crs=settings.DEFAULT_PROJECTED_CRS,
        transform=transform,
    ) as dst:
        dst.write(dsm_arr, 1)

    # 3. DTM
    with rasterio.open(
        aoi_dir / "rasters" / "dtm.tif",
        "w",
        driver="GTiff",
        height=img_size,
        width=img_size,
        count=1,
        dtype=rasterio.float32,
        crs=settings.DEFAULT_PROJECTED_CRS,
        transform=transform,
    ) as dst:
        dst.write(dtm_arr, 1)

    # 4. nDSM
    with rasterio.open(
        aoi_dir / "rasters" / "ndsm.tif",
        "w",
        driver="GTiff",
        height=img_size,
        width=img_size,
        count=1,
        dtype=rasterio.float32,
        crs=settings.DEFAULT_PROJECTED_CRS,
        transform=transform,
    ) as dst:
        dst.write(ndsm_arr, 1)
        
    # Also save PNG preview for easy web rendering
    Image.fromarray(rgb_img).save(aoi_dir / "rasters" / "orthomosaic_preview.png")

    # Helper to convert list of dicts with shapely geometry to GeoJSON in EPSG:4326
    def save_geojson(items, out_path):
        features = []
        for it in items:
            geom = it["geometry"]
            props = {k: v for k, v in it.items() if k != "geometry"}
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": mapping(geom)
            })
        raw_fc = get_geojson_feature_collection(features)
        # Reproject to WGS84 for Leaflet / Web-GIS
        wgs84_fc = reproject_geojson(raw_fc, settings.DEFAULT_PROJECTED_CRS, settings.DEFAULT_GEOGRAPHIC_CRS)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(wgs84_fc, f, indent=2)
        return wgs84_fc

    save_geojson(parcels_gt, aoi_dir / "vectors" / "ground_truth_parcels.geojson")
    save_geojson(buildings_gt, aoi_dir / "vectors" / "ground_truth_buildings.geojson")
    save_geojson(roads_list, aoi_dir / "vectors" / "ground_truth_roads.geojson")
    save_geojson(legacy_parcels, aoi_dir / "vectors" / "legacy_cadastral_parcels.geojson")
    save_geojson(gnss_points, aoi_dir / "vectors" / "gnss_cors_survey_points.geojson")
    
    # Compute exact geographic center
    center_proj_x = (min_x + max_x) / 2.0
    center_proj_y = (min_y + max_y) / 2.0
    calc_transformer = get_transformer(settings.DEFAULT_PROJECTED_CRS, settings.DEFAULT_GEOGRAPHIC_CRS)
    calc_lon, calc_lat = calc_transformer.transform(center_proj_x, center_proj_y)

    # Save AOI Metadata
    metadata = {
        "aoi_id": aoi_id,
        "name": "Varanasi Urban Cadastral Ward 07 (Pilot Drone Survey)",
        "location": "Varanasi, Uttar Pradesh, India",
        "bounds_projected": [min_x, min_y, max_x, max_y],
        "center_lat": round(calc_lat, 6),
        "center_lon": round(calc_lon, 6),
        "crs_projected": settings.DEFAULT_PROJECTED_CRS,
        "crs_geographic": settings.DEFAULT_GEOGRAPHIC_CRS,
        "image_size_px": [img_size, img_size],
        "ground_resolution_m_per_px": pixel_res,
        "total_area_hectares": round((width_m * height_m) / 10000.0, 2),
        "total_gt_parcels": len(parcels_gt),
        "total_gt_buildings": len(buildings_gt),
        "total_gt_roads": len(roads_list),
        "total_gnss_points": len(gnss_points),
        "created_at": "2026-08-28T10:45:00Z"
    }
    
    with open(aoi_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    return metadata
