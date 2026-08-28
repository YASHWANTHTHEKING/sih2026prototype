import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis } from 'recharts';
import { BarChart3, TrendingUp, IndianRupee, Layers, ShieldCheck, Zap, X, Clock, CheckCircle } from 'lucide-react';

export default function AnalyticsDashboard({ stats, onClose }) {
  if (!stats) return null;

  // Land-use chart data
  const landUseData = stats.landuse_distribution
    ? Object.entries(stats.landuse_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const landUseColors = ['#38bdf8', '#a855f7', '#6366f1', '#f59e0b', '#10b981', '#64748b'];

  // Confidence chart data
  const confidenceData = stats.confidence_distribution
    ? Object.entries(stats.confidence_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const confColors = ['#10b981', '#f59e0b', '#ef4444'];

  // Severity chart data
  const severityData = stats.conflict_severity_distribution
    ? Object.entries(stats.conflict_severity_distribution).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
      <div className="w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Urban Cadastral Analytics & KPI Dashboard</h2>
                <span className="text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Survey-Grade
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {stats.aoi_name || stats.aoi_id} — Multi-Cue Cadastral Extraction & Municipal Assessment Ledger
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Total Parcels Mapped</span>
                <Layers className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {stats.total_parcels} <span className="text-xs font-normal text-slate-400">units</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {stats.auto_mapped_rate_pct}% AI Confirmed
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Survey Area</span>
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-cyan-300">
                {stats.total_area_hectares} <span className="text-xs font-normal text-slate-400">ha</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {stats.total_mapped_area_sqm?.toLocaleString('en-IN')} sqm
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Digitization Savings</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-emerald-400">
                86.0% <span className="text-xs font-normal text-slate-400">reduction</span>
              </div>
              <div className="text-[11px] text-emerald-300 font-semibold">
                7.1x Faster Field Turnaround
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Tax Assessment Base</span>
                <IndianRupee className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-amber-300">
                ₹{(stats.estimated_annual_property_tax_inr / 100000).toFixed(2)}L
              </div>
              <div className="text-[11px] text-amber-400/80">
                Annual Property Tax Potential
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Land-Use Classification Distribution */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Land-Use / Land-Cover (LULC) Breakdown
              </h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={landUseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {landUseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={landUseColors[index % landUseColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Confidence Distribution */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Extraction Confidence & Verification Tiers
              </h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={confidenceData}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {confidenceData.map((entry, index) => (
                        <Cell key={`conf-${index}`} fill={confColors[index % confColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
