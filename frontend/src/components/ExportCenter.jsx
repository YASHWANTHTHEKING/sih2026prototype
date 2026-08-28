import React, { useState } from 'react';
import { Download, FileCode, Database, FileSpreadsheet, Layers, X, CheckCircle2 } from 'lucide-react';
import { generateExports } from '../services/api';

export default function ExportCenter({ aoiId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await generateExports(aoiId);
      setGenerated(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (type) => {
    window.open(`/api/export/download/${aoiId}/${type}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">GIS Data & CAD Export Center</h2>
              <p className="text-xs text-slate-400">
                Industry-Standard Geospatial Formats
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div className="space-y-2.5">
            {/* GeoPackage */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">OGC GeoPackage (.gpkg)</div>
                  <div className="text-[10px] text-slate-400">All layers (Parcels, Buildings, Roads)</div>
                </div>
              </div>
              <button
                onClick={() => downloadFile('geopackage')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all"
              >
                Download
              </button>
            </div>

            {/* Shapefile */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">ESRI Shapefile (.zip)</div>
                  <div className="text-[10px] text-slate-400">QGIS / ArcGIS compatible package</div>
                </div>
              </div>
              <button
                onClick={() => downloadFile('shapefile')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-all"
              >
                Download
              </button>
            </div>

            {/* AutoCAD DXF */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">AutoCAD Drawing (.dxf)</div>
                  <div className="text-[10px] text-slate-400">CAD engineering vector format</div>
                </div>
              </div>
              <button
                onClick={() => downloadFile('dxf')}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg transition-all"
              >
                Download
              </button>
            </div>

            {/* CSV Register */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">Cadastral Register (.csv)</div>
                  <div className="text-[10px] text-slate-400">Tabular property records & tax valuation</div>
                </div>
              </div>
              <button
                onClick={() => downloadFile('csv')}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-all"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
