import React, { useState } from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle, ShieldAlert, X, ArrowRight, Filter, Eye } from 'lucide-react';

export default function ConflictResolutionCenter({
  conflicts,
  onSelectConflict,
  onClose,
  onResolveConflict
}) {
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const filteredConflicts = conflicts.filter((c) => {
    if (filterSeverity === 'ALL') return true;
    return c.properties?.severity === filterSeverity;
  });

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'High':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'Medium':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[1500] w-96 bg-slate-900/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Conflict Resolution Center</h2>
            <p className="text-[11px] text-slate-400">
              {conflicts.length} topological & legal discrepancies detected
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Severity Filter Pills */}
      <div className="px-4 py-2.5 bg-slate-950/50 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
        {['ALL', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
              filterSeverity === sev
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Conflict List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredConflicts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <CheckCircle className="w-10 h-10 text-emerald-400 mb-2" />
            <div className="text-sm font-bold text-slate-200">No Active Conflicts</div>
            <div className="text-xs text-slate-500 mt-1">
              All parcel boundaries satisfy planar topology and match legal records.
            </div>
          </div>
        ) : (
          filteredConflicts.map((c, idx) => {
            const props = c.properties;
            return (
              <div
                key={props?.conflict_id || idx}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all space-y-2.5 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSeverityBadge(props?.severity)}`}>
                      {props?.severity}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {props?.type}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {props?.conflict_id}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {props?.description}
                </p>

                {props?.overlap_area_sqm && (
                  <div className="text-[11px] text-amber-300 font-mono bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                    Overlap Area: {props.overlap_area_sqm} sqm
                  </div>
                )}

                {props?.discrepancy_percentage && (
                  <div className="text-[11px] text-amber-300 font-mono bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                    Area Discrepancy: {props.discrepancy_percentage}% ({props.area_discrepancy_sqm} sqm)
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 truncate max-w-[160px]">
                    Action: {props?.suggested_action}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onSelectConflict(c)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-all"
                      title="Zoom to location"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onResolveConflict(props?.conflict_id)}
                      className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-lg font-semibold transition-all"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
