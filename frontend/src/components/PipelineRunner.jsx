import React, { useState } from 'react';
import { Play, Cpu, CheckCircle2, Loader2, Sparkles, X, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { runFullPipeline } from '../services/api';

export default function PipelineRunner({ aoiId, onClose, onComplete }) {
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Configuration options
  const [minBuildingHeight, setMinBuildingHeight] = useState(2.5);
  const [regularizeBuildings, setRegularizeBuildings] = useState(true);
  const [useLegacyConflation, setUseLegacyConflation] = useState(true);
  const [useGnssAnchors, setUseGnssAnchors] = useState(true);

  const steps = [
    { name: '1. Ingestion & Preprocessing', desc: 'CRS check, nDSM height generation, and chip tiling' },
    { name: '2. Building Footprint Extraction', desc: 'Multi-channel nDSM + RGB segmentation & right-angle snapping' },
    { name: '3. Road Network Extraction', desc: 'Centerline skeletonization and topological graph construction' },
    { name: '4. Cadastral Boundary Delineation', desc: 'Block partition, setback inference, and legacy conflation' },
    { name: '5. Land-Use (LULC) Classification', desc: 'Multi-class parcel profiling and tax assessment valuation' },
    { name: '6. Planar Topology & Conflict Engine', desc: 'Overlap, encroachment, and sliver detection' },
    { name: '7. Benchmarking & Accuracy Evaluation', desc: 'IoU, F1-Score, and manual effort savings calculation' }
  ];

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setCurrentStep(1);

    // Simulate step progress while API executes
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length ? prev + 1 : prev));
    }, 1200);

    try {
      const data = await runFullPipeline({
        aoi_id: aoiId,
        min_building_height: minBuildingHeight,
        regularize_buildings: regularizeBuildings,
        use_legacy_conflation: useLegacyConflation,
        use_gnss_anchors: useGnssAnchors
      });

      clearInterval(interval);
      setCurrentStep(steps.length);
      setResult(data);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      onComplete();
    } catch (err) {
      clearInterval(interval);
      setError(err.response?.data?.detail || err.message || 'Pipeline execution failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">GeoAI Cadastral Extraction Pipeline</h2>
              <p className="text-xs text-slate-400">
                Automated Modules 1–9 Execution Engine
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Execution Steps */}
          <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
            {steps.map((step, idx) => {
              const stepNum = idx + 1;
              const isDone = currentStep > stepNum || result !== null;
              const isCurrent = currentStep === stepNum && running;

              return (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-xl">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[9px] text-slate-500 shrink-0 font-mono">
                      {stepNum}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className={`font-semibold ${isDone ? 'text-slate-200' : isCurrent ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>
                      {step.name}
                    </div>
                    <div className="text-[10px] text-slate-500">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hyperparameters / Options */}
          {!running && !result && (
            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <label className="flex items-center justify-between p-1.5 cursor-pointer">
                <span className="text-slate-300">Orthogonal Regularization</span>
                <input
                  type="checkbox"
                  checked={regularizeBuildings}
                  onChange={(e) => setRegularizeBuildings(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-1.5 cursor-pointer">
                <span className="text-slate-300">Legacy Cadastre Conflation</span>
                <input
                  type="checkbox"
                  checked={useLegacyConflation}
                  onChange={(e) => setUseLegacyConflation(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-1.5 cursor-pointer">
                <span className="text-slate-300">GNSS CORS Geodetic Anchors</span>
                <input
                  type="checkbox"
                  checked={useGnssAnchors}
                  onChange={(e) => setUseGnssAnchors(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
              </label>

              <div className="flex items-center justify-between p-1.5">
                <span className="text-slate-300">Min Building Height</span>
                <span className="font-mono text-blue-400">{minBuildingHeight}m</span>
              </div>
            </div>
          )}

          {/* Success Summary */}
          {result && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Sparkles className="w-4 h-4" /> Pipeline Completed Successfully!
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400">Parcels</div>
                  <div className="text-white font-bold text-sm">{result.summary?.parcels_delineated}</div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400">Buildings</div>
                  <div className="text-white font-bold text-sm">{result.summary?.buildings_extracted}</div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="text-slate-400">Time Saved</div>
                  <div className="text-emerald-400 font-bold text-sm">{result.summary?.time_saved_pct}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Trigger */}
          <button
            onClick={result ? onClose : handleRun}
            disabled={running}
            className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
              result
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 active:scale-95 disabled:opacity-50'
            }`}
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing Area of Interest...
              </>
            ) : result ? (
              'Close and Inspect Map'
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" /> Execute Full GeoAI Pipeline
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
