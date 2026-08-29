import React, { useState } from 'react';
import { Upload, MapPin, Compass, Sparkles, CheckCircle2, Loader2, X, AlertCircle, FileImage, Layers, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { uploadDroneImage } from '../services/api';

export default function UploadDroneImage({ aoiMetadata, onClose, onComplete }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [centerLat, setCenterLat] = useState(aoiMetadata?.center_lat || 28.6144);
  const [centerLon, setCenterLon] = useState(aoiMetadata?.center_lon || 77.2327);
  const [widthM, setWidthM] = useState(300);
  const [heightM, setHeightM] = useState(300);

  const [uploading, setUploading] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
      }
    }
  };

  const handleUseCurrentCenter = () => {
    if (aoiMetadata?.center_lat && aoiMetadata?.center_lon) {
      setCenterLat(aoiMetadata.center_lat);
      setCenterLon(aoiMetadata.center_lon);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a drone photo or orthomosaic image.');
      return;
    }

    setUploading(true);
    setError(null);
    setProgressStage('Uploading & Georeferencing in EPSG:32643...');

    const stages = [
      'Ingesting raster & building tile chips...',
      'Running RGB-only building contour segmentation...',
      'Extracting road corridors & network graph...',
      'Delineating cadastral parcel boundaries via Voronoi setback clustering...',
      'Classifying land-use & validating planar topology...'
    ];

    let stageIdx = 0;
    const interval = setInterval(() => {
      if (stageIdx < stages.length) {
        setProgressStage(stages[stageIdx]);
        stageIdx++;
      }
    }, 1400);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('center_lat', parseFloat(centerLat));
      formData.append('center_lon', parseFloat(centerLon));
      formData.append('width_m', parseFloat(widthM));
      formData.append('height_m', parseFloat(heightM));
      if (name.trim()) {
        formData.append('name', name.trim());
      }
      formData.append('run_pipeline', 'true');

      const data = await uploadDroneImage(formData);

      clearInterval(interval);
      setResult(data);
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });

      if (onComplete && data.aoi_id) {
        onComplete(data.aoi_id);
      }
    } catch (err) {
      clearInterval(interval);
      setError(err.response?.data?.detail || err.message || 'Drone image upload and processing failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 my-auto">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Upload Real Drone Survey
                <span className="bg-cyan-500/20 text-cyan-300 text-[10px] px-2 py-0.5 rounded-full font-mono border border-cyan-500/30">
                  GeoAI Pipeline
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Georeference photo & run automated RGB feature extraction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs text-slate-200">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3.5 rounded-2xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Summary View */}
          {result && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Drone Survey Ingested & Extracted Successfully!</span>
              </div>
              <p className="text-[11px] text-slate-300">
                {result.message}
              </p>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20">
                <div className="bg-slate-900/90 p-2 rounded-xl text-center border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Buildings</div>
                  <div className="text-sm font-bold text-orange-400 font-mono">
                    {result.summary?.buildings_extracted || 0}
                  </div>
                </div>
                <div className="bg-slate-900/90 p-2 rounded-xl text-center border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Roads</div>
                  <div className="text-sm font-bold text-sky-400 font-mono">
                    {result.summary?.roads_extracted || 0}
                  </div>
                </div>
                <div className="bg-slate-900/90 p-2 rounded-xl text-center border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Parcels</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">
                    {result.summary?.parcels_delineated || 0}
                  </div>
                </div>
                <div className="bg-slate-900/90 p-2 rounded-xl text-center border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Conflicts</div>
                  <div className="text-sm font-bold text-rose-400 font-mono">
                    {result.summary?.conflicts_flagged || 0}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>Mode: <strong className="text-cyan-300 font-mono">{result.summary?.extraction_mode}</strong></span>
                <span>AOI: <strong className="text-slate-200 font-mono">{result.aoi_id}</strong></span>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2"
              >
                <span>View Extracted Cadastre on Map</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {!result && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* File Dropzone */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Drone Photograph / Orthomosaic File *
                </label>
                <div className="relative border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-2xl p-4 bg-slate-950/60 transition-all text-center group cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.tif,.tiff"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                      <FileImage className="w-5 h-5" />
                    </div>
                    {file ? (
                      <div>
                        <p className="font-semibold text-cyan-300 text-xs truncate max-w-xs">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for ingestion
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-slate-300 text-xs">
                          Click to browse or drop drone aerial image
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Supports JPG, PNG, TIFF / GeoTIFF (Max 60MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Survey Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Survey Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Varanasi Sector 07 High-Res Flight"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={uploading}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white outline-none focus:border-cyan-500 text-xs font-medium"
                />
              </div>

              {/* Georeferencing Coordinates */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Center Georeference Coordinates (WGS84)
                  </span>
                  {aoiMetadata && (
                    <button
                      type="button"
                      onClick={handleUseCurrentCenter}
                      disabled={uploading}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer"
                    >
                      📍 Use Current Center
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Latitude (°N)</span>
                    <input
                      type="number"
                      step="0.000001"
                      value={centerLat}
                      onChange={(e) => setCenterLat(e.target.value)}
                      disabled={uploading}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white outline-none focus:border-cyan-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Longitude (°E)</span>
                    <input
                      type="number"
                      step="0.000001"
                      value={centerLon}
                      onChange={(e) => setCenterLon(e.target.value)}
                      disabled={uploading}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white outline-none focus:border-cyan-500 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Ground Dimensions */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Ground Width (Meters)</span>
                    <input
                      type="number"
                      step="10"
                      min="50"
                      max="5000"
                      value={widthM}
                      onChange={(e) => setWidthM(e.target.value)}
                      disabled={uploading}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white outline-none focus:border-cyan-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Ground Height (Meters)</span>
                    <input
                      type="number"
                      step="10"
                      min="50"
                      max="5000"
                      value={heightM}
                      onChange={(e) => setHeightM(e.target.value)}
                      disabled={uploading}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white outline-none focus:border-cyan-500 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Progress Indicator */}
              {uploading && (
                <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-2xl p-3.5 flex items-center gap-3 animate-pulse">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-cyan-300 text-xs">GeoAI Pipeline Executing...</p>
                    <p className="text-[10px] text-slate-300 truncate">{progressStage}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={uploading || !file}
                className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                  uploading || !file
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-blue-500/20'
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Real Pixel Ingestion...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-300" />
                    <span>Ingest Drone Photo & Run GeoAI Pipeline</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
