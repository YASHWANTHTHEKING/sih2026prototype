import json
import math
from typing import Dict, Any, List, Tuple, Optional
import numpy as np
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, LineString, MultiLineString, Point, box
from shapely.ops import transform, unary_union, polygonize
from shapely.validation import make_valid
import pyproj

# Cache transformers for performance
_transformer_cache: Dict[Tuple[str, str], pyproj.Transformer] = {}

def get_transformer(from_crs: str, to_crs: str) -> pyproj.Transformer:
    key = (from_crs, to_crs)
    if key not in _transformer_cache:
        _transformer_cache[key] = pyproj.Transformer.from_crs(from_crs, to_crs, always_xy=True)
    return _transformer_cache[key]

def reproject_geometry(geom: Any, from_crs: str, to_crs: str) -> Any:
    if from_crs.upper() == to_crs.upper():
        return geom
    transformer = get_transformer(from_crs, to_crs)
    return transform(transformer.transform, geom)

def reproject_geojson(geojson_dict: Dict[str, Any], from_crs: str, to_crs: str) -> Dict[str, Any]:
    if from_crs.upper() == to_crs.upper():
        return geojson_dict
    
    transformer = get_transformer(from_crs, to_crs)
    
    def _transform_coords(coords):
        if isinstance(coords[0], (int, float)):
            x, y = coords[0], coords[1]
            tx, ty = transformer.transform(x, y)
            return [tx, ty] + list(coords[2:])
        return [_transform_coords(c) for c in coords]

    result = json.loads(json.dumps(geojson_dict))
    
    if result.get("type") == "FeatureCollection":
        for feat in result.get("features", []):
            if feat.get("geometry"):
                feat["geometry"]["coordinates"] = _transform_coords(feat["geometry"]["coordinates"])
    elif result.get("type") == "Feature":
        if result.get("geometry"):
            result["geometry"]["coordinates"] = _transform_coords(result["geometry"]["coordinates"])
    elif "coordinates" in result:
        result["coordinates"] = _transform_coords(result["coordinates"])
        
    return result

def regularize_polygon(poly: Polygon, angle_tolerance_deg: float = 15.0, distance_tolerance_m: float = 0.5) -> Polygon:
    """
    Orthogonal right-angle regularization and simplification for building footprints.
    Snaps nearly perpendicular/parallel edges to exact 90-degree corners.
    """
    if not poly.is_valid:
        poly = make_valid(poly)
    if poly.geom_type != "Polygon" or poly.is_empty:
        return poly
    
    simplified = poly.simplify(distance_tolerance_m, preserve_topology=True)
    if simplified.geom_type != "Polygon" or simplified.is_empty:
        return poly
    
    coords = list(simplified.exterior.coords)
    if len(coords) < 4:
        return poly
    
    # Calculate dominant orientation angle
    angles = []
    for i in range(len(coords) - 1):
        dx = coords[i+1][0] - coords[i][0]
        dy = coords[i+1][1] - coords[i][1]
        length = math.hypot(dx, dy)
        if length > 0.5:
            angle = math.degrees(math.atan2(dy, dx)) % 90.0
            angles.append((angle, length))
            
    if not angles:
        return simplified
        
    # Weighted average angle
    total_len = sum(l for _, l in angles)
    if total_len == 0:
        return simplified
    dominant_angle = sum(a * l for a, l in angles) / total_len
    
    # Try right-angle snapping of segments close to dominant_angle or dominant_angle + 90
    new_coords = [coords[0]]
    for i in range(len(coords) - 1):
        p1 = new_coords[-1]
        p2 = coords[i+1]
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        seg_angle = math.degrees(math.atan2(dy, dx))
        
        # Check delta from closest 90-deg increment of dominant_angle
        diff = (seg_angle - dominant_angle) % 90.0
        if diff > 45.0:
            diff -= 90.0
            
        if abs(diff) < angle_tolerance_deg:
            corrected_angle = math.radians(seg_angle - diff)
            length = math.hypot(dx, dy)
            nx = p1[0] + length * math.cos(corrected_angle)
            ny = p1[1] + length * math.sin(corrected_angle)
            new_coords.append((nx, ny))
        else:
            new_coords.append(p2)
            
    # Close polygon
    new_coords[-1] = new_coords[0]
    
    try:
        reg_poly = Polygon(new_coords)
        if reg_poly.is_valid and reg_poly.area > 0.5 * poly.area:
            return reg_poly
    except Exception:
        pass
        
    return simplified

def compute_polygon_metrics(poly: Polygon) -> Dict[str, float]:
    """Computes area, perimeter, compactness/circularity ratio."""
    if not poly.is_valid:
        poly = make_valid(poly)
    area = poly.area
    length = poly.length
    # Compactness (Polsby-Popper ratio): 4 * pi * area / perimeter^2
    compactness = (4 * math.pi * area) / (length ** 2) if length > 0 else 0.0
    return {
        "area_m2": round(area, 2),
        "perimeter_m": round(length, 2),
        "compactness": round(compactness, 4)
    }

def get_geojson_feature_collection(features: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": features
    }
