import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import MapViewer from './components/MapViewer';
import CadastralEditor from './components/CadastralEditor';
import ConflictResolutionCenter from './components/ConflictResolutionCenter';
import GroundTruthingModal from './components/GroundTruthingModal';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import PipelineRunner from './components/PipelineRunner';
import BenchmarkModal from './components/BenchmarkModal';
import ExportCenter from './components/ExportCenter';
import TitleDeedModal from './components/TitleDeedModal';

import {
  getAOIList,
  getAOIMetadata,
  getLayerGeoJSON,
  getAnalyticsSummary,
  actionAiPolygon,
  createCustomAOI,
  autoTrimConflict,
  snapToGnssAnchor
} from './services/api';

export default function App() {
  const [language, setLanguage] = useState('EN');
  const [aoiList, setAoiList] = useState([]);
  const [selectedAoi, setSelectedAoi] = useState('aoi_urban_ward_07');
  const [metadata, setMetadata] = useState(null);
  const [stats, setStats] = useState(null);

  // Layers GeoJSON state
  const [parcels, setParcels] = useState(null);
  const [buildings, setBuildings] = useState(null);
  const [roads, setRoads] = useState(null);
  const [conflicts, setConflicts] = useState(null);
  const [legacy, setLegacy] = useState(null);
  const [gnss, setGnss] = useState(null);
  const [gtParcels, setGtParcels] = useState(null);

  // Interactive selection state
  const [selectedParcel, setSelectedParcel] = useState(null);

  // Modal open states
  const [showPipeline, setShowPipeline] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [showGT, setShowGT] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showBenchmarks, setShowBenchmarks] = useState(false);
  const [showExports, setShowExports] = useState(false);
  const [showTitleDeed, setShowTitleDeed] = useState(false);

  // Toast / notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAutoTrimConflict = async (parcelOrId) => {
    try {
      const pId = typeof parcelOrId === 'string'
        ? parcelOrId
        : (parcelOrId?.properties?.conflict_id || parcelOrId?.properties?.parcel_id || parcelOrId?.properties?.parcel_1 || 'CONF');
      showToast(`Auto-trimming conflict on ${pId}...`, 'info');
      const res = await autoTrimConflict({ aoi_id: selectedAoi, parcel_id: pId });
      showToast(res.message);
      loadAOIData(selectedAoi);
      setSelectedParcel(null);
    } catch (e) {
      showToast(e.response?.data?.detail || 'Auto-trim failed', 'error');
    }
  };

  const handleSnapGnss = async (parcelOrId) => {
    try {
      const pId = typeof parcelOrId === 'string'
        ? parcelOrId
        : (parcelOrId?.properties?.parcel_id || parcelOrId?.properties?.conflict_id || parcelOrId?.properties?.parcel_1 || 'GNSS');
      showToast(`Snapping ${pId} to CORS station...`, 'info');
      const res = await snapToGnssAnchor({ aoi_id: selectedAoi, parcel_id: pId });
      showToast(res.message);
      loadAOIData(selectedAoi);
      setSelectedParcel(null);
    } catch (e) {
      showToast(e.response?.data?.detail || 'GNSS snap failed', 'error');
    }
  };

  // Initial Load
  useEffect(() => {
    loadAOIs();
  }, []);

  useEffect(() => {
    if (selectedAoi) {
      loadAOIData(selectedAoi);
    }
  }, [selectedAoi]);

  const loadAOIs = async () => {
    try {
      const res = await getAOIList();
      setAoiList(res.aois || []);
      if (res.aois?.length > 0 && !selectedAoi) {
        setSelectedAoi(res.aois[0].aoi_id);
      }
    } catch (e) {
      console.error('Failed to load AOIs', e);
    }
  };

  const loadAOIData = async (aoiId) => {
    try {
      const [
        metaRes,
        statsRes,
        parcelsRes,
        bldRes,
        roadsRes,
        conflictsRes,
        legacyRes,
        gnssRes,
        gtRes
      ] = await Promise.all([
        getAOIMetadata(aoiId).catch(() => null),
        getAnalyticsSummary(aoiId).catch(() => null),
        getLayerGeoJSON(aoiId, 'parcels').catch(() => null),
        getLayerGeoJSON(aoiId, 'buildings').catch(() => null),
        getLayerGeoJSON(aoiId, 'roads').catch(() => null),
        getLayerGeoJSON(aoiId, 'conflicts').catch(() => null),
        getLayerGeoJSON(aoiId, 'legacy').catch(() => null),
        getLayerGeoJSON(aoiId, 'gnss').catch(() => null),
        getLayerGeoJSON(aoiId, 'gt_parcels').catch(() => null)
      ]);

      setMetadata(metaRes);
      setStats(statsRes);
      setParcels(parcelsRes);
      setBuildings(bldRes);
      setRoads(roadsRes);
      setConflicts(conflictsRes);
      setLegacy(legacyRes);
      setGnss(gnssRes);
      setGtParcels(gtRes);
    } catch (e) {
      console.error('Error loading AOI layers', e);
    }
  };

  const handleActionAiPolygon = async (parcelId, action) => {
    try {
      const res = await actionAiPolygon({
        aoi_id: selectedAoi,
        parcel_id: parcelId,
        action: action
      });
      showToast(res.message);
      loadAOIData(selectedAoi);
      setSelectedParcel(null);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Action failed', 'error');
    }
  };

  const handleResolveConflict = (conflictId) => {
    if (!conflicts) return;
    const updatedFeatures = conflicts.features.filter(
      (f) => f.properties?.conflict_id !== conflictId
    );
    setConflicts({ ...conflicts, features: updatedFeatures });
    showToast(`Conflict ${conflictId} resolved and dismissed.`);
  };

  const [flyToCity, setFlyToCity] = useState(null);

  const handleJumpToCity = (city) => {
    setFlyToCity({ ...city, timestamp: Date.now() });
    showToast(`Flying camera to ${city.name}...`);
  };

  const handleCreateCustomAoi = async (params) => {
    try {
      showToast('Generating AI parcels for selected area...', 'info');
      const res = await createCustomAOI(params);
      if (res.status === 'success') {
        showToast(res.message);
        // Refresh AOI list and select new AOI
        const aoisRes = await getAOIList();
        setAoiList(aoisRes.aois || []);
        setSelectedAoi(res.aoi_id);
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to parcel selected area', 'error');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation */}
      <Navbar
        aoiList={aoiList}
        selectedAoi={selectedAoi}
        onSelectAoi={setSelectedAoi}
        onOpenPipeline={() => setShowPipeline(true)}
        onOpenAnalytics={() => setShowAnalytics(true)}
        onOpenConflicts={() => setShowConflicts(!showConflicts)}
        onOpenGT={() => setShowGT(true)}
        onOpenExports={() => setShowExports(true)}
        onOpenBenchmarks={() => setShowBenchmarks(true)}
        stats={stats}
        refreshData={() => {
          loadAOIData(selectedAoi);
          showToast('Refreshed all GIS layers from server.');
        }}
        onJumpToCity={handleJumpToCity}
        language={language}
        onLanguageChange={setLanguage}
      />

      {/* Main Map Viewer */}
      <main className="flex-1 relative w-full h-full">
        <MapViewer
          aoiId={selectedAoi}
          flyToCity={flyToCity}
          metadata={metadata}
          parcelsGeoJSON={parcels}
          buildingsGeoJSON={buildings}
          roadsGeoJSON={roads}
          conflictsGeoJSON={conflicts}
          legacyGeoJSON={legacy}
          gnssGeoJSON={gnss}
          gtParcelsGeoJSON={gtParcels}
          selectedParcel={selectedParcel}
          onSelectParcel={setSelectedParcel}
          language={language}
          onOpenGtSignoff={(parcel) => {
            setSelectedParcel(parcel);
            setShowGT(true);
          }}
          onOpenSplit={(parcel) => {
            setSelectedParcel(parcel);
            setShowEditor(true);
          }}
          onActionPolygon={handleActionAiPolygon}
          onCreateCustomAoi={handleCreateCustomAoi}
          onOpenExports={() => setShowExports(true)}
          onOpenTitleDeed={(parcel) => {
            setSelectedParcel(parcel);
            setShowTitleDeed(true);
          }}
          onAutoTrimConflict={handleAutoTrimConflict}
          onSnapGnss={handleSnapGnss}
        />
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[3000] bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom duration-200">
          <div className={`w-2.5 h-2.5 rounded-full ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-400'}`}></div>
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Modals & Drawers */}
      {showTitleDeed && selectedParcel && (
        <TitleDeedModal
          parcel={selectedParcel}
          aoiMetadata={metadata}
          onClose={() => setShowTitleDeed(false)}
        />
      )}

      {showPipeline && (
        <PipelineRunner
          aoiId={selectedAoi}
          onClose={() => setShowPipeline(false)}
          onComplete={() => {
            loadAOIData(selectedAoi);
            showToast('GeoAI Extraction completed!');
          }}
        />
      )}

      {showEditor && selectedParcel && (
        <CadastralEditor
          aoiId={selectedAoi}
          selectedParcel={selectedParcel}
          onClose={() => setShowEditor(false)}
          onSuccess={(msg) => {
            setShowEditor(false);
            setSelectedParcel(null);
            showToast(msg);
            loadAOIData(selectedAoi);
          }}
        />
      )}

      {showConflicts && (
        <ConflictResolutionCenter
          conflicts={conflicts?.features || []}
          onSelectConflict={(c) => {
            // Find related parcel if any
            showToast(`Inspecting conflict ${c.properties?.conflict_id}`);
          }}
          onClose={() => setShowConflicts(false)}
          onResolveConflict={handleResolveConflict}
        />
      )}

      {showGT && selectedParcel && (
        <GroundTruthingModal
          aoiId={selectedAoi}
          selectedParcel={selectedParcel}
          onClose={() => setShowGT(false)}
          onSuccess={(msg) => {
            setShowGT(false);
            showToast(msg);
            loadAOIData(selectedAoi);
          }}
        />
      )}

      {showAnalytics && (
        <AnalyticsDashboard
          stats={stats}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {showBenchmarks && (
        <BenchmarkModal
          aoiId={selectedAoi}
          onClose={() => setShowBenchmarks(false)}
        />
      )}

      {showExports && (
        <ExportCenter
          aoiId={selectedAoi}
          onClose={() => setShowExports(false)}
        />
      )}
    </div>
  );
}
