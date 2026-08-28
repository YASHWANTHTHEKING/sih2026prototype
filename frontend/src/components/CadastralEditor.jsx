import React, { useState } from 'react';
import { Scissors, Combine, Edit3, Check, X, Layers, AlertCircle } from 'lucide-react';
import { splitParcel, mergeParcels, updateAttributes } from '../services/api';

export default function CadastralEditor({
  aoiId,
  selectedParcel,
  onClose,
  onSuccess
}) {
  const [mode, setMode] = useState('split'); // 'split', 'merge', 'edit_props'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Merge state
  const [mergeSecondaryId, setMergeSecondaryId] = useState('');
  
  // Edit attributes state
  const [ownerName, setOwnerName] = useState(selectedParcel?.properties?.owner_record || '');
  const [landuseClass, setLanduseClass] = useState(selectedParcel?.properties?.landuse_class || 'Residential');
  const [surveyNumber, setSurveyNumber] = useState(selectedParcel?.properties?.survey_number || '');

  const handleSplit = async () => {
    if (!selectedParcel) return;
    setLoading(true);
    setError(null);
    try {
      // Calculate bisecting cutline across parcel centroid
      const coords = selectedParcel.geometry?.coordinates?.[0] || [];
      if (coords.length < 3) throw new Error('Invalid parcel geometry');
      
      const lons = coords.map(c => c[0]);
      const lats = coords.map(c => c[1]);
      const minLon = Math.min(...lons), maxLon = Math.max(...lons);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const midLat = (minLat + maxLat) / 2.0;
      
      const cutline = [
        [minLon - 0.0002, midLat],
        [maxLon + 0.0002, midLat]
      ];

      const res = await splitParcel({
        aoi_id: aoiId,
        parcel_id: selectedParcel.properties?.parcel_id,
        cutline_coordinates: cutline
      });

      if (res.status === 'success') {
        onSuccess(res.message);
      } else {
        setError(res.message || 'Split failed');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Split error');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedParcel || !mergeSecondaryId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await mergeParcels({
        aoi_id: aoiId,
        parcel_ids: [selectedParcel.properties?.parcel_id, mergeSecondaryId.trim()]
      });

      if (res.status === 'success') {
        onSuccess(res.message);
      } else {
        setError(res.message || 'Merge failed');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Merge error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProps = async () => {
    if (!selectedParcel) return;
    setLoading(true);
    setError(null);
    try {
      const res = await updateAttributes({
        aoi_id: aoiId,
        parcel_id: selectedParcel.properties?.parcel_id,
        attributes: {
          owner_record: ownerName,
          landuse_class: landuseClass,
          survey_number: surveyNumber
        }
      });

      if (res.status === 'success') {
        onSuccess(res.message);
      } else {
        setError(res.message || 'Update failed');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Update error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cadastral Spatial Editor</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {selectedParcel?.properties?.parcel_id} ({selectedParcel?.properties?.survey_number})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-2 border-b border-slate-800 text-xs">
          <button
            onClick={() => setMode('split')}
            className={`py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
              mode === 'split' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" /> Split
          </button>
          <button
            onClick={() => setMode('merge')}
            className={`py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
              mode === 'merge' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Combine className="w-3.5 h-3.5" /> Merge
          </button>
          <button
            onClick={() => setMode('edit_props')}
            className={`py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
              mode === 'edit_props' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Attributes
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'split' && (
            <div className="space-y-3">
              <p className="text-slate-300 leading-relaxed">
                Splits <span className="font-mono text-blue-400">{selectedParcel?.properties?.parcel_id}</span> into two topologically compliant cadastral sub-parcels with automatic area recalculation and survey notation.
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div className="text-slate-400">Current Area: <span className="text-white">{selectedParcel?.properties?.area_sqm} sqm</span></div>
                <div className="text-slate-400">Estimated Sub-Parcels: <span className="text-emerald-400">~{Math.round(selectedParcel?.properties?.area_sqm / 2)} sqm each</span></div>
              </div>
              <button
                onClick={handleSplit}
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {loading ? 'Executing Topological Split...' : 'Execute Polygon Split'}
              </button>
            </div>
          )}

          {mode === 'merge' && (
            <div className="space-y-3">
              <p className="text-slate-300">
                Enter the adjacent Parcel ID or Survey Number to merge with <span className="font-mono text-blue-400">{selectedParcel?.properties?.parcel_id}</span>:
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Adjacent Parcel ID</label>
                <input
                  type="text"
                  placeholder="e.g. ULPIN-2026-rd07-00002"
                  value={mergeSecondaryId}
                  onChange={(e) => setMergeSecondaryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleMerge}
                disabled={loading || !mergeSecondaryId}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                {loading ? 'Merging Geometries...' : 'Execute Union Merge'}
              </button>
            </div>
          )}

          {mode === 'edit_props' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Registered Owner Name</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Survey Number</label>
                <input
                  type="text"
                  value={surveyNumber}
                  onChange={(e) => setSurveyNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Land-Use Category</label>
                <select
                  value={landuseClass}
                  onChange={(e) => setLanduseClass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                >
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Mixed-Use">Mixed-Use</option>
                  <option value="Institutional">Institutional</option>
                  <option value="Vacant/Green">Vacant/Green</option>
                  <option value="Industrial">Industrial</option>
                </select>
              </div>

              <button
                onClick={handleUpdateProps}
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Update Parcel Record'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
