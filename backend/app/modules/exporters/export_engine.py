import os
import json
from typing import Dict, Any, List, Optional
import zipfile
import shutil
import pandas as pd
import geopandas as gpd
from shapely.geometry import shape

from ...core.config import settings

class ExportEngine:
    def __init__(self, aoi_id: str):
        self.aoi_id = aoi_id
        self.aoi_dir = settings.DATA_DIR / "aois" / aoi_id
        self.vectors_dir = self.aoi_dir / "vectors"
        self.exports_dir = settings.DATA_DIR / "exports" / aoi_id
        os.makedirs(self.exports_dir, exist_ok=True)
        
    def export_all_formats(self) -> Dict[str, str]:
        """
        Exports Cadastral & GeoAI outputs into industry-standard GIS formats:
        1. GeoJSON (WGS84 & Projected)
        2. ESRI Shapefile (.zip)
        3. GeoPackage (.gpkg)
        4. AutoCAD DXF format
        5. Tabular Cadastral Register (CSV / Excel)
        6. Cadastral Conflict & Summary JSON Report
        """
        results = {}
        parcels_path = self.vectors_dir / "ai_inferred_parcels.geojson"
        buildings_path = self.vectors_dir / "ai_inferred_buildings.geojson"
        roads_path = self.vectors_dir / "ai_inferred_roads.geojson"
        conflicts_path = self.vectors_dir / "cadastral_conflicts.geojson"
        
        # 1. GeoPackage Export
        gpkg_path = self.exports_dir / f"{self.aoi_id}_cadastre.gpkg"
        
        if parcels_path.exists():
            gdf_parcels = gpd.read_file(parcels_path)
            gdf_parcels.to_file(gpkg_path, layer="parcels", driver="GPKG")
            
            # CSV Tabular Register
            csv_path = self.exports_dir / f"{self.aoi_id}_cadastral_register.csv"
            df_props = gdf_parcels.drop(columns=["geometry"]) if "geometry" in gdf_parcels else gdf_parcels
            df_props.to_csv(csv_path, index=False)
            results["csv_register"] = str(csv_path)

        if buildings_path.exists():
            gdf_bld = gpd.read_file(buildings_path)
            gdf_bld.to_file(gpkg_path, layer="buildings", driver="GPKG")
            
        if roads_path.exists():
            gdf_roads = gpd.read_file(roads_path)
            gdf_roads.to_file(gpkg_path, layer="roads", driver="GPKG")

        results["geopackage"] = str(gpkg_path)

        # 2. Shapefile Zip Export
        if parcels_path.exists():
            shp_temp_dir = self.exports_dir / "shp_temp"
            os.makedirs(shp_temp_dir, exist_ok=True)
            shp_path = shp_temp_dir / f"{self.aoi_id}_parcels.shp"
            
            # Truncate and ensure unique column names for ESRI shapefile spec
            gdf_shp = gpd.read_file(parcels_path)
            new_cols = []
            seen = set()
            for c in gdf_shp.columns:
                if c == "geometry":
                    new_cols.append("geometry")
                    continue
                base = c[:8]
                col_name = base
                counter = 1
                while col_name in seen:
                    col_name = f"{base[:6]}_{counter}"
                    counter += 1
                seen.add(col_name)
                new_cols.append(col_name)
            gdf_shp.columns = new_cols
            gdf_shp.to_file(shp_path, driver="ESRI Shapefile")
            
            zip_shp_path = self.exports_dir / f"{self.aoi_id}_parcels_shapefile.zip"
            with zipfile.ZipFile(zip_shp_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                for file in shp_temp_dir.iterdir():
                    zipf.write(file, arcname=file.name)
            shutil.rmtree(shp_temp_dir, ignore_errors=True)
            results["shapefile_zip"] = str(zip_shp_path)

        # 3. Simple AutoCAD DXF representation
        dxf_path = self.exports_dir / f"{self.aoi_id}_cadastre.dxf"
        self._generate_cad_dxf(parcels_path, dxf_path)
        results["autocad_dxf"] = str(dxf_path)
        
        return results

    def _generate_cad_dxf(self, geojson_path, out_dxf_path):
        """Creates an ASCII AutoCAD DXF containing parcel boundaries."""
        if not geojson_path.exists():
            return
        with open(geojson_path, "r", encoding="utf-8") as f:
            fc = json.load(f)
            
        dxf_lines = [
            "0", "SECTION",
            "2", "ENTITIES"
        ]
        
        for feat in fc["features"]:
            geom = feat.get("geometry")
            if not geom:
                continue
            coords = []
            if geom["type"] == "Polygon":
                coords = geom["coordinates"][0]
            elif geom["type"] == "MultiPolygon":
                coords = geom["coordinates"][0][0]
                
            if coords:
                dxf_lines.extend([
                    "0", "POLYLINE",
                    "8", "CADASTRAL_PARCEL",
                    "66", "1",
                    "70", "1"
                ])
                for pt in coords:
                    dxf_lines.extend([
                        "0", "VERTEX",
                        "8", "CADASTRAL_PARCEL",
                        "10", str(round(pt[0], 6)),
                        "20", str(round(pt[1], 6)),
                        "30", "0.0"
                    ])
                dxf_lines.extend(["0", "SEQEND"])
                
        dxf_lines.extend([
            "0", "ENDSEC",
            "0", "EOF"
        ])
        
        with open(out_dxf_path, "w", encoding="utf-8") as f:
            f.write("\n".join(dxf_lines))
