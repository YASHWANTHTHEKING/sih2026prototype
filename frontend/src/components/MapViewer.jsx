import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Rectangle, useMap, useMapEvents, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { Layers, Eye, EyeOff, Sliders, SplitSquareVertical, MapPin, Maximize2, ShieldAlert, CheckCircle2, XCircle, Crop, Sparkles, Loader2, MousePointerClick, PlusCircle, Download, FileText } from 'lucide-react';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapController({ aoiId, center, geojson, isSelecting, flyToCity }) {
  const map = useMap();

  useEffect(() => {
    if (flyToCity && flyToCity.lat && flyToCity.lon) {
      map.flyTo([flyToCity.lat, flyToCity.lon], 16, { duration: 1.8 });
    }
  }, [flyToCity, map]);

  useEffect(() => {
    if (isSelecting) return;
    if (geojson && geojson.features && geojson.features.length > 0) {
      try {
        const layer = L.geoJSON(geojson);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 18, duration: 1.2 });
          return;
        }
      } catch (e) {
        console.error('fitBounds error', e);
      }
    }
    if (center) {
      map.flyTo(center, 17, { duration: 1.2 });
    }
  }, [aoiId, geojson, center, isSelecting, map]);
  return null;
}

function isPointInPolygon(pt, ring) {
  const x = pt[0], y = pt[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function findParcelAtCoordinates(lng, lat, parcelsFc) {
  if (!parcelsFc || !parcelsFc.features) return null;
  for (const feat of parcelsFc.features) {
    const geom = feat.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon') {
      if (isPointInPolygon([lng, lat], geom.coordinates[0])) {
        return feat;
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        if (isPointInPolygon([lng, lat], poly[0])) {
          return feat;
        }
      }
    }
  }
  return null;
}

function MapClickHandler({ isSelecting, onSelectPoint, onSelectParcel, parcelsGeoJSON }) {
  useMapEvents({
    click(e) {
      if (isSelecting) {
        onSelectPoint([e.latlng.lat, e.latlng.lng]);
        return;
      }
      // Spatial lookup for parcel at clicked coordinate
      const matched = findParcelAtCoordinates(e.latlng.lng, e.latlng.lat, parcelsGeoJSON);
      if (matched) {
        onSelectParcel(matched);
      }
    },
  });
  return null;
}

export default function MapViewer({
  aoiId,
  flyToCity,
  metadata,
  parcelsGeoJSON,
  buildingsGeoJSON,
  roadsGeoJSON,
  conflictsGeoJSON,
  legacyGeoJSON,
  gnssGeoJSON,
  gtParcelsGeoJSON,
  selectedParcel,
  onSelectParcel,
  onOpenGtSignoff,
  onOpenSplit,
  onActionPolygon,
  onCreateCustomAoi,
  onOpenExports,
  onOpenTitleDeed,
  onAutoTrimConflict,
  onSnapGnss
}) {
  // Custom Area Selection States
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [selectedAreaCenter, setSelectedAreaCenter] = useState(null);
  const [areaSizeMeters, setAreaSizeMeters] = useState(600);
  const [customZoneName, setCustomZoneName] = useState('');
  const [isExtractingArea, setIsExtractingArea] = useState(false);

  useEffect(() => {
    if (flyToCity && flyToCity.lat && flyToCity.lon) {
      setIsSelectingArea(true);
      setSelectedAreaCenter([flyToCity.lat, flyToCity.lon]);
      setCustomZoneName(`${flyToCity.name} (${flyToCity.state || 'Urban'})`);
    }
  }, [flyToCity]);
  // Layer visibility states
  const [layers, setLayers] = useState({
    droneOrthomosaic: true,
    parcels: true,
    buildings: true,
    roads: true,
    conflicts: true,
    legacy: false,
    gnss: true,
    gtParcels: false
  });

  // Basemap selector state ('satellite', 'osm', 'dark', 'topo')
  const [basemap, setBasemap] = useState('satellite');

  // Layer styling & panel states
  const [parcelColorBy, setParcelColorBy] = useState('landuse'); // 'landuse' or 'confidence'
  const [opacity, setOpacity] = useState(0.85);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [splitPos, setSplitPos] = useState(50); // percentage

  const basemapUrls = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    },
    topo: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin'
    }
  };

  // Default Map center (Varanasi / Delhi sample coordinates)
  const defaultCenter = metadata?.center_lat && metadata?.center_lon
    ? [metadata.center_lat, metadata.center_lon]
    : [28.6139, 77.2090];

  // Professional GIS Land-use & Status Palette (Muted, Survey-Grade)
  const landUseColors = {
    'Residential': '#38bdf8',     // Technical Sky Blue
    'Commercial': '#a855f7',      // Muted Purple
    'Mixed-Use': '#6366f1',       // Indigo
    'Institutional': '#f59e0b',   // Muted Amber
    'Vacant/Green': '#10b981',    // Forest/Emerald
    'Industrial': '#64748b',      // Neutral Slate
    'Road/ROW': '#475569'         // Corridor Gray
  };

  const getParcelStyle = (feature) => {
    const isSelected = selectedParcel?.properties?.parcel_id === feature?.properties?.parcel_id;
    let fill = '#38bdf8';
    
    if (parcelColorBy === 'landuse') {
      const lu = feature?.properties?.landuse_class || 'Residential';
      fill = landUseColors[lu] || '#38bdf8';
    } else {
      const conf = feature?.properties?.confidence_score || 0.85;
      if (conf >= 0.85) fill = '#10b981'; // High
      else if (conf >= 0.70) fill = '#f59e0b'; // Medium
      else fill = '#ef4444'; // Low
    }

    const isGtNeeded = feature?.properties?.verification_status === 'Needs GT Verification';

    return {
      fillColor: fill,
      fillOpacity: isSelected ? 0.45 : opacity * 0.22,
      color: isSelected ? '#fbbf24' : (isGtNeeded ? '#f59e0b' : '#38bdf8'),
      weight: isSelected ? 3.0 : (isGtNeeded ? 1.8 : 1.5),
      dashArray: isGtNeeded ? '5, 5' : ''
    };
  };

  // Building footprints: subtle architectural linework
  const buildingStyle = {
    fillColor: '#94a3b8',
    fillOpacity: 0.30,
    color: '#f1f5f9',
    weight: 1.0
  };

  // Road corridors: clean neutral casing
  const roadStyle = (feature) => {
    const h = feature?.properties?.hierarchy;
    const isMajor = h === 'Major Arterial';
    return {
      color: isMajor ? '#38bdf8' : '#64748b',
      weight: isMajor ? 3.5 : 2.0,
      opacity: 0.75
    };
  };

  // Conflict boundaries: prominent warning overlay
  const conflictStyle = (feature) => {
    const sev = feature?.properties?.severity;
    return {
      fillColor: sev === 'Critical' ? '#ef4444' : '#f97316',
      fillOpacity: 0.35,
      color: '#ef4444',
      weight: 2.2,
      dashArray: '4, 4'
    };
  };



  const legacyStyle = {
    fillColor: 'transparent',
    color: '#ec4899',
    weight: 2.0,
    dashArray: '6, 6'
  };

  const gtParcelsStyle = {
    fillColor: 'transparent',
    color: '#06b6d4',
    weight: 2.0,
    dashArray: '2, 4'
  };

  const onEachParcel = (feature, layer) => {
    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectParcel(feature);
      }
    });
  };

  const onEachConflict = (feature, layer) => {
    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        const pId = feature?.properties?.parcel_1 || feature?.properties?.parcel_id || feature?.properties?.parcel_2;
        let matched = null;
        if (parcelsGeoJSON?.features) {
          matched = parcelsGeoJSON.features.find((p) => p.properties?.parcel_id === pId);
        }
        if (matched) {
          const enriched = {
            ...matched,
            properties: {
              ...matched.properties,
              active_conflict: feature.properties
            }
          };
          onSelectParcel(enriched);
        } else {
          // If no parcel directly linked, wrap conflict feature as inspectable item
          onSelectParcel({
            type: 'Feature',
            properties: {
              parcel_id: feature.properties?.parcel_1 || feature.properties?.conflict_id,
              survey_number: feature.properties?.survey_number_1 || 'Conflict Hotspot',
              owner_record: 'Disputed Ownership',
              area_sqm: feature.properties?.overlap_area_sqm || 120,
              landuse_class: 'Commercial',
              confidence_score: 0.65,
              verification_status: 'Needs GT Verification',
              active_conflict: feature.properties
            },
            geometry: feature.geometry
          });
        }
      }
    });
  };

  const onEachBuilding = (feature, layer) => {
    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        const pId = feature?.properties?.parcel_id;
        let matched = null;
        if (parcelsGeoJSON?.features) {
          if (pId) {
            matched = parcelsGeoJSON.features.find((p) => p.properties?.parcel_id === pId);
          }
          if (!matched && e.latlng) {
            matched = findParcelAtCoordinates(e.latlng.lng, e.latlng.lat, parcelsGeoJSON);
          }
        }
        if (matched) {
          onSelectParcel(matched);
        }
      }
    });
  };

  // Helper to compute bounding box from center lat/lon and size in meters
  const getAreaBounds = (center, sizeM) => {
    if (!center) return null;
    const lat = center[0];
    const lon = center[1];
    const deltaLat = (sizeM / 2.0) / 111320.0;
    const deltaLon = (sizeM / 2.0) / (111320.0 * Math.cos((lat * Math.PI) / 180.0));
    return [
      [lat - deltaLat, lon - deltaLon],
      [lat + deltaLat, lon + deltaLon]
    ];
  };

  const handleStartAreaSelection = () => {
    setIsSelectingArea(!isSelectingArea);
    if (!selectedAreaCenter) {
      setSelectedAreaCenter(defaultCenter);
    }
  };

  const handleConfirmCustomAoi = async () => {
    if (!selectedAreaCenter || !onCreateCustomAoi) return;
    setIsExtractingArea(true);
    try {
      await onCreateCustomAoi({
        name: customZoneName.trim() || undefined,
        center_lat: selectedAreaCenter[0],
        center_lon: selectedAreaCenter[1],
        width_m: areaSizeMeters,
        height_m: areaSizeMeters
      });
      setIsSelectingArea(false);
      setSelectedAreaCenter(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExtractingArea(false);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col bg-slate-950">
      {/* Top Banner when Area Selection Mode is active */}
      {isSelectingArea && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-cyan-950/95 border border-cyan-500/50 px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-top duration-200">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping"></div>
          <span className="text-xs font-bold text-cyan-200">
            📍 Click anywhere on the map to place the parceling zone
          </span>
          <button
            onClick={() => setIsSelectingArea(false)}
            className="text-cyan-400 hover:text-white text-xs font-semibold px-2 py-0.5 rounded bg-cyan-900/60 border border-cyan-700/50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Floating Map Controls / Layer Switcher Button */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={handleStartAreaSelection}
          className={`p-2.5 rounded-xl border shadow-lg backdrop-blur-md transition-all flex items-center justify-center ${
            isSelectingArea
              ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-cyan-500/40 ring-2 ring-cyan-400 animate-pulse'
              : 'bg-slate-900/90 text-cyan-400 border-cyan-500/30 hover:bg-slate-800'
          }`}
          title="Select Custom Area to Parcel"
        >
          <Crop className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          className={`p-2.5 rounded-xl border shadow-lg backdrop-blur-md transition-all ${
            showLayerPanel
              ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/20'
              : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="Layer Visibility & Styles"
        >
          <Layers className="w-5 h-5" />
        </button>

        <button
          onClick={() => setSplitView(!splitView)}
          className={`p-2.5 rounded-xl border shadow-lg backdrop-blur-md transition-all ${
            splitView
              ? 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-500/20'
              : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="Toggle Split-Screen Imagery Comparison"
        >
          <SplitSquareVertical className="w-5 h-5" />
        </button>

        {onOpenExports && (
          <button
            onClick={onOpenExports}
            className="p-2.5 rounded-xl border border-indigo-500/30 bg-gradient-to-tr from-indigo-900/90 to-violet-900/90 text-indigo-300 hover:text-white shadow-lg backdrop-blur-md hover:bg-indigo-800 transition-all active:scale-95"
            title="Download GIS Datasets (Shapefile, GeoPackage, DXF, CSV)"
          >
            <Download className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Layer Switcher Panel Drawer */}
      {showLayerPanel && (
        <div className="absolute top-16 right-4 z-[1000] w-80 bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-xs text-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" /> Layer Controls
            </h3>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
              EPSG:4326 / UTM 43N
            </span>
          </div>

          {/* Layer toggles */}
          <div className="space-y-2.5">
            <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-800/60">
              <span className="flex items-center gap-2 font-medium text-slate-200">
                <span className="w-3 h-3 rounded bg-blue-500 inline-block"></span> AI Cadastral Parcels
              </span>
              <input
                type="checkbox"
                checked={layers.parcels}
                onChange={(e) => setLayers({ ...layers, parcels: e.target.checked })}
                className="rounded text-blue-600 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-800/60">
              <span className="flex items-center gap-2 font-medium text-slate-200">
                <span className="w-3 h-3 rounded bg-orange-500 inline-block"></span> Building Footprints (nDSM)
              </span>
              <input
                type="checkbox"
                checked={layers.buildings}
                onChange={(e) => setLayers({ ...layers, buildings: e.target.checked })}
                className="rounded text-blue-600 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-800/60">
              <span className="flex items-center gap-2 font-medium text-slate-200">
                <span className="w-3 h-3 rounded bg-sky-400 inline-block"></span> Road Corridors & Centerlines
              </span>
              <input
                type="checkbox"
                checked={layers.roads}
                onChange={(e) => setLayers({ ...layers, roads: e.target.checked })}
                className="rounded text-blue-600 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-800/60">
              <span className="flex items-center gap-2 font-medium text-slate-200">
                <span className="w-3 h-3 rounded bg-red-500 inline-block animate-pulse"></span> Conflict Hotspots
              </span>
              <input
                type="checkbox"
                checked={layers.conflicts}
                onChange={(e) => setLayers({ ...layers, conflicts: e.target.checked })}
                className="rounded text-blue-600 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-800/60">
              <span className="flex items-center gap-2 font-medium text-slate-200">
                <span className="w-3 h-3 rounded border border-dashed border-pink-500 inline-block"></span> Legacy Cadastral Map
              </span>
              <input
                type="checkbox"
                checked={layers.legacy}
                onChange={(e) => setLayers({ ...layers, legacy: e.target.checked })}
                className="rounded text-blue-600 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-slate-800/60">
              <span className="flex items-center gap-2 font-medium text-slate-200">
                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span> GNSS CORS Control Points
              </span>
              <input
                type="checkbox"
                checked={layers.gnss}
                onChange={(e) => setLayers({ ...layers, gnss: e.target.checked })}
                className="rounded text-blue-600 focus:ring-0"
              />
            </label>
          </div>

          {/* Basemap Selection */}
          <div className="mt-3 pt-3 border-t border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase mb-2">Base Imagery / Canvas</div>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setBasemap('satellite')}
                className={`py-1 rounded text-[11px] font-semibold transition-all ${
                  basemap === 'satellite' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Satellite / Drone
              </button>
              <button
                onClick={() => setBasemap('osm')}
                className={`py-1 rounded text-[11px] font-semibold transition-all ${
                  basemap === 'osm' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                OpenStreetMap
              </button>
              <button
                onClick={() => setBasemap('dark')}
                className={`py-1 rounded text-[11px] font-semibold transition-all ${
                  basemap === 'dark' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Dark Canvas
              </button>
              <button
                onClick={() => setBasemap('topo')}
                className={`py-1 rounded text-[11px] font-semibold transition-all ${
                  basemap === 'topo' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Topographic
              </button>
            </div>
          </div>

          {/* Thematic Symbology Switch */}
          <div className="mt-3 pt-3 border-t border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase mb-2">Parcel Symbology</div>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setParcelColorBy('landuse')}
                className={`py-1 rounded text-[11px] font-semibold transition-all ${
                  parcelColorBy === 'landuse' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Land-Use
              </button>
              <button
                onClick={() => setParcelColorBy('confidence')}
                className={`py-1 rounded text-[11px] font-semibold transition-all ${
                  parcelColorBy === 'confidence' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                AI Confidence
              </button>
            </div>
          </div>

          {/* Opacity slider */}
          <div className="mt-3 pt-3 border-t border-slate-800">
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase mb-1.5">
              <span>Vector Opacity</span>
              <span className="font-mono text-slate-300">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      )}

      {/* Main Map Container */}
      <MapContainer
        center={defaultCenter}
        zoom={17}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <MapController aoiId={aoiId} center={defaultCenter} geojson={parcelsGeoJSON || gtParcelsGeoJSON} isSelecting={isSelectingArea} flyToCity={flyToCity} />

        {/* Base Tile Layer */}
        <TileLayer
          key={basemap}
          attribution={basemapUrls[basemap].attribution}
          url={basemapUrls[basemap].url}
          maxZoom={20}
        />

        {/* Legacy Cadastre GeoJSON */}
        {layers.legacy && legacyGeoJSON && (
          <GeoJSON
            key={`legacy-${aoiId}-${legacyGeoJSON?.features?.[0]?.geometry?.coordinates?.[0]?.[0] || 'empty'}`}
            data={legacyGeoJSON}
            style={legacyStyle}
          />
        )}

        {/* Ground Truth Parcels GeoJSON */}
        {layers.gtParcels && gtParcelsGeoJSON && (
          <GeoJSON
            key={`gtparcels-${aoiId}-${gtParcelsGeoJSON?.features?.[0]?.geometry?.coordinates?.[0]?.[0] || 'empty'}`}
            data={gtParcelsGeoJSON}
            style={gtParcelsStyle}
          />
        )}

        {/* Inferred Parcels GeoJSON */}
        {layers.parcels && parcelsGeoJSON && (
          <GeoJSON
            key={`parcels-${aoiId}-${parcelColorBy}-${opacity}-${parcelsGeoJSON?.features?.[0]?.geometry?.coordinates?.[0]?.[0] || 'empty'}`}
            data={parcelsGeoJSON}
            style={getParcelStyle}
            onEachFeature={onEachParcel}
          />
        )}

        {/* Building Footprints GeoJSON */}
        {layers.buildings && buildingsGeoJSON && (
          <GeoJSON
            key={`buildings-${aoiId}-${buildingsGeoJSON?.features?.[0]?.geometry?.coordinates?.[0]?.[0] || 'empty'}`}
            data={buildingsGeoJSON}
            style={buildingStyle}
            onEachFeature={onEachBuilding}
          />
        )}

        {/* Road Corridors GeoJSON */}
        {layers.roads && roadsGeoJSON && (
          <GeoJSON
            key={`roads-${aoiId}-${roadsGeoJSON?.features?.[0]?.geometry?.coordinates?.[0]?.[0] || 'empty'}`}
            data={roadsGeoJSON}
            style={roadStyle}
            interactive={false}
          />
        )}

        {/* Conflicts GeoJSON */}
        {layers.conflicts && conflictsGeoJSON && (
          <GeoJSON
            key={`conflicts-${aoiId}-${conflictsGeoJSON?.features?.[0]?.geometry?.coordinates?.[0]?.[0] || 'empty'}`}
            data={conflictsGeoJSON}
            style={conflictStyle}
            onEachFeature={onEachConflict}
          />
        )}

        {/* GNSS Control Points */}
        {layers.gnss && gnssGeoJSON?.features && (
          gnssGeoJSON.features.map((feat, idx) => {
            const coords = feat.geometry?.coordinates;
            if (!coords) return null;
            return (
              <CircleMarker
                key={`gnss-${idx}`}
                center={[coords[1], coords[0]]}
                radius={4}
                pathOptions={{
                  fillColor: '#10b981',
                  fillOpacity: 1,
                  color: '#ffffff',
                  weight: 1.5
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-emerald-400">{feat.properties?.point_id}</div>
                    <div>Accuracy: <span className="font-mono">{feat.properties?.accuracy_cm} cm</span></div>
                    <div>Elevation: <span className="font-mono">{feat.properties?.elevation_m} m</span></div>
                    <div>Status: <span className="font-semibold text-emerald-300">{feat.properties?.surveyor_status}</span></div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })
        )}

        {/* Custom Area Selection Rectangle Preview */}
        {isSelectingArea && selectedAreaCenter && (
          <Rectangle
            bounds={getAreaBounds(selectedAreaCenter, areaSizeMeters)}
            pathOptions={{
              color: '#06b6d4',
              weight: 3,
              dashArray: '8, 8',
              fillColor: '#06b6d4',
              fillOpacity: 0.28
            }}
          />
        )}

        <MapClickHandler
          isSelecting={isSelectingArea}
          onSelectPoint={(pt) => setSelectedAreaCenter(pt)}
          onSelectParcel={onSelectParcel}
          parcelsGeoJSON={parcelsGeoJSON}
        />
      </MapContainer>

      {/* Custom Area Selection / Parceling Card */}
      {isSelectingArea && selectedAreaCenter && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-lg bg-slate-900/95 border border-cyan-500/50 rounded-3xl p-5 shadow-2xl backdrop-blur-xl text-slate-200 animate-in slide-in-from-bottom duration-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                <Crop className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Extract Parcels in Selected Area</h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Center: {selectedAreaCenter[0].toFixed(5)}°N, {selectedAreaCenter[1].toFixed(5)}°E
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSelectingArea(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Zone / Ward Name</label>
              <input
                type="text"
                placeholder="e.g. South Extension Ward 12"
                value={customZoneName}
                onChange={(e) => setCustomZoneName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Area Size</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {[
                  { label: '400m', size: 400 },
                  { label: '600m', size: 600 },
                  { label: '1000m', size: 1000 }
                ].map((s) => (
                  <button
                    key={s.size}
                    type="button"
                    onClick={() => setAreaSizeMeters(s.size)}
                    className={`py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      areaSizeMeters === s.size
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-[11px]">
            <span className="text-slate-400">Coverage: <span className="font-mono text-cyan-300 font-bold">{((areaSizeMeters * areaSizeMeters) / 10000).toFixed(1)} hectares</span></span>
            <span className="text-slate-400">Est. Parcels: <span className="font-mono text-emerald-400 font-bold">~{Math.round((areaSizeMeters * areaSizeMeters) / 2200)} units</span></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSelectingArea(false)}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmCustomAoi}
              disabled={isExtractingArea}
              className="flex-[2] py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
            >
              {isExtractingArea ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Parceling Selected Area...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Generate & Parcel This Area
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Selected Parcel Inspector Floating Card */}
      {selectedParcel && (
        <div className="absolute bottom-6 left-6 z-[1000] w-96 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-slate-200">
          <div className="flex items-start justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {selectedParcel.properties?.parcel_id}
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  {selectedParcel.properties?.survey_number}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Owner: {selectedParcel.properties?.owner_record || 'Citizen Record'}
              </div>
            </div>
            <button
              onClick={() => onSelectParcel(null)}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 my-3 text-xs">
            <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Parcel Area</div>
              <div className="text-sm font-mono font-bold text-white">
                {selectedParcel.properties?.area_sqm} <span className="text-xs text-slate-400 font-normal">sqm</span>
              </div>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Land Use</div>
              <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 mt-0.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: landUseColors[selectedParcel.properties?.landuse_class] || '#3b82f6' }}
                ></span>
                {selectedParcel.properties?.landuse_class || 'Residential'}
              </div>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-bold">AI Confidence</div>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                {Math.round((selectedParcel.properties?.confidence_score || 0.85) * 100)}%
              </div>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Tax Valuation</div>
              <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                ₹{(selectedParcel.properties?.tax_assessment_annual_inr || selectedParcel.properties?.area_sqm * 2200).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Active Conflict Notice if clicked on red conflict plot */}
          {selectedParcel.properties?.active_conflict && (
            <div className="mb-3 p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
              <div className="flex items-center justify-between font-bold text-red-400 mb-1">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  {selectedParcel.properties?.active_conflict?.type || 'Topological Conflict'}
                </span>
                <span className="text-[10px] bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30 font-mono">
                  {selectedParcel.properties?.active_conflict?.severity} Severity
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                {selectedParcel.properties?.active_conflict?.description}
              </p>
              {selectedParcel.properties?.active_conflict?.suggested_action && (
                <div className="mt-1.5 pt-1.5 border-t border-red-900/60 text-[10px] text-amber-300/90 font-medium">
                  💡 Action: {selectedParcel.properties?.active_conflict?.suggested_action}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-950/40 rounded-lg border border-slate-800/80 mb-3">
            <span className="text-[11px] text-slate-400">Status:</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              selectedParcel.properties?.verification_status === 'Needs GT Verification'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {selectedParcel.properties?.verification_status || 'AI Confirmed'}
            </span>
          </div>

          {/* Dispute Auto-Resolvers & Quick Actions */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            {selectedParcel.properties?.active_conflict && onAutoTrimConflict && (
              <button
                onClick={() => onAutoTrimConflict(selectedParcel.properties?.parcel_id)}
                className="w-full py-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-[11px] rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" /> ⚡ 1-Click Auto-Trim Overlap
              </button>
            )}

            {onSnapGnss && (
              <button
                onClick={() => onSnapGnss(selectedParcel.properties?.parcel_id)}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px] rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> 🎯 Snap to CORS Benchmark (±1.2cm)
              </button>
            )}

            {onOpenTitleDeed && (
              <button
                onClick={() => onOpenTitleDeed(selectedParcel)}
                className="w-full py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-[11px] rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <FileText className="w-3.5 h-3.5" /> 📄 Generate Land Title Deed (RoR / Patta)
              </button>
            )}
          </div>

          {/* Parcel Primary Actions */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <button
              onClick={() => onOpenSplit(selectedParcel)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold py-1.5 rounded-lg border border-slate-700 transition-all"
            >
              Split Parcel
            </button>
            <button
              onClick={() => onOpenGtSignoff(selectedParcel)}
              className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3" /> GT Sign-off
            </button>
            <button
              onClick={() => onActionPolygon(selectedParcel.properties?.parcel_id, 'ACCEPT')}
              className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold py-1.5 rounded-lg transition-all"
            >
              Approve AI
            </button>
          </div>
        </div>
      )}

      {/* Professional GIS Map Legend & Instrument Readout */}
      <div className="absolute bottom-4 right-4 z-[900] flex flex-col items-end gap-2">
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl text-xs text-slate-200 w-80">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
            <span className="font-bold text-xs text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-blue-400" /> Cadastral Survey Legend
            </span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-1.5 py-0.5 rounded">
              RMSE: 0.32m
            </span>
          </div>

          {/* Survey Status & Confidence Tiers */}
          <div className="space-y-1.5 mb-2.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Survey Status</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-sky-400 inline-block"></span>
                <span>AI Confirmed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-b-2 border-dashed border-amber-400 inline-block"></span>
                <span className="text-amber-300">Needs GT Review</span>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <span className="w-4 h-2 border border-red-500 bg-red-500/30 inline-block"></span>
                <span className="text-red-300 font-medium">Topological / Legal Conflict</span>
              </div>
            </div>
          </div>

          {/* LULC Thematic Classes */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Land-Use (LULC)</div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-sky-400/80 border border-sky-300 inline-block"></span> Residential
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-purple-500/80 border border-purple-300 inline-block"></span> Commercial
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-indigo-500/80 border border-indigo-300 inline-block"></span> Mixed-Use
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-500/80 border border-amber-300 inline-block"></span> Institutional
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500/80 border border-emerald-300 inline-block"></span> Vacant/Green
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span> GNSS CORS
              </div>
            </div>
          </div>

          {/* Instrument Coordinate Readout */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>CRS: EPSG:4326 / UTM 43N</span>
            <span>Res: 0.50 m/px</span>
          </div>
        </div>
      </div>
    </div>
  );
}
