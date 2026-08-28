import { Layers, Play, Cpu, AlertTriangle, ShieldCheck, BarChart3, Download, Award, Compass, RefreshCw, MapPin, Globe } from 'lucide-react';
import { TRANSLATIONS } from '../services/i18n';

const INDIAN_CITIES = [
  { name: 'Bengaluru (Whitefield Tech Hub)', lat: 12.9698, lon: 77.7499, state: 'Karnataka' },
  { name: 'New Delhi (Central Vista / Urban)', lat: 28.6143, lon: 77.2327, state: 'Delhi NCR' },
  { name: 'Mumbai (BKC / Andheri)', lat: 19.0657, lon: 72.8687, state: 'Maharashtra' },
  { name: 'Hyderabad (HITEC City / Cyberabad)', lat: 17.4435, lon: 78.3772, state: 'Telangana' },
  { name: 'Varanasi (Urban Cadastral Ward 07)', lat: 28.6144, lon: 77.2327, state: 'Uttar Pradesh' },
  { name: 'Chennai (OMR IT Corridor)', lat: 12.9165, lon: 80.2285, state: 'Tamil Nadu' },
  { name: 'Kolkata (New Town / Salt Lake)', lat: 22.5867, lon: 88.4754, state: 'West Bengal' },
  { name: 'Jaipur (Pink City Urban Ward)', lat: 26.9124, lon: 75.7873, state: 'Rajasthan' },
  { name: 'Pune (Hinjewadi Phase 1)', lat: 18.5913, lon: 73.7389, state: 'Maharashtra' },
  { name: 'Lucknow (Gomti Nagar Extension)', lat: 26.8500, lon: 81.0000, state: 'Uttar Pradesh' }
];

export default function Navbar({
  aoiList,
  selectedAoi,
  onSelectAoi,
  onOpenPipeline,
  onOpenAnalytics,
  onOpenConflicts,
  onOpenGT,
  onOpenExports,
  onOpenBenchmarks,
  activeTab,
  setActiveTab,
  stats,
  refreshData,
  onJumpToCity,
  language = 'EN',
  onLanguageChange
}) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.EN;

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-30 shadow-md">
      {/* Brand / Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              {t.appName} <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full font-mono border border-blue-500/30">2026</span>
            </h1>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider">
              {t.revenueSystem}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden md:block">
            {t.tagline}
          </p>
        </div>
      </div>

      {/* AOI Selector, Language Switcher & Cities */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 gap-1.5 shadow-inner">
          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
          <span className="text-[11px] text-slate-400">{t.aoi}:</span>
          <select
            value={selectedAoi}
            onChange={(e) => onSelectAoi(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer pr-1 max-w-[150px] truncate"
          >
            {aoiList.map((aoi) => (
              <option key={aoi.aoi_id} value={aoi.aoi_id} className="bg-slate-900 text-slate-100">
                {aoi.name || aoi.aoi_id}
              </option>
            ))}
          </select>
        </div>

        {/* Indic Multi-Lingual Switcher (Always Visible) */}
        <div className="flex items-center bg-slate-950 border border-emerald-500/40 rounded-lg px-2 py-1.5 gap-1.5 shadow-sm">
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <select
            value={language}
            onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-emerald-300 outline-none cursor-pointer"
          >
            <option value="EN" className="bg-slate-900 text-slate-100">🇬🇧 English</option>
            <option value="HI" className="bg-slate-900 text-slate-100">🇮🇳 हिन्दी (खसरा/खतौनी)</option>
            <option value="TA" className="bg-slate-900 text-slate-100">🇮🇳 தமிழ் (பட்டா/சிட்டா)</option>
            <option value="MR" className="bg-slate-900 text-slate-100">🇮🇳 मराठी (७/१२)</option>
            <option value="TE" className="bg-slate-900 text-slate-100">🇮🇳 తెలుగు (పట్టాదారు)</option>
          </select>
        </div>

        {/* Quick Indian City Explorer */}
        <div className="hidden xl:flex items-center bg-slate-950/80 border border-cyan-500/30 rounded-lg px-2.5 py-1.5 gap-2">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] text-slate-400">{t.flyToCity}</span>
          <select
            onChange={(e) => {
              const city = INDIAN_CITIES.find(c => c.name === e.target.value);
              if (city && onJumpToCity) {
                onJumpToCity({
                  name: city.name,
                  lat: city.lat,
                  lon: city.lon,
                  state: city.state
                });
              }
            }}
            defaultValue=""
            className="bg-transparent text-[11px] font-semibold text-cyan-300 outline-none cursor-pointer pr-1"
          >
            <option value="" disabled className="bg-slate-900 text-slate-400">{t.flyToCity}</option>
            {INDIAN_CITIES.map((city) => (
              <option key={city.name} value={city.name} className="bg-slate-900 text-slate-100">
                🇮🇳 {city.name}
              </option>
            ))}
          </select>
        </div>

        {stats && (
          <div className="hidden lg:flex items-center gap-3 border-l border-slate-800 pl-3">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500">Auto-Mapped</div>
              <div className="text-xs font-bold text-emerald-400">{stats.auto_mapped_rate_pct || 86.4}%</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500">Parcels</div>
              <div className="text-xs font-bold text-blue-400">{stats.total_parcels || 165}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500">Conflicts</div>
              <div className="text-xs font-bold text-amber-400">{stats.total_conflicts || 0}</div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenPipeline}
          className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-sm transition-all active:scale-95"
          title="Run Full AI Cadastral Extraction Pipeline"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span className="hidden sm:inline">{t.runGeoAi}</span>
        </button>

        <button
          onClick={onOpenConflicts}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
          title="Review Topological & Legal Conflicts"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">{t.conflicts}</span>
          {stats?.total_conflicts > 0 && (
            <span className="bg-amber-500/30 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono">
              {stats.total_conflicts}
            </span>
          )}
        </button>

        <button
          onClick={onOpenGT}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
          title="Ground Truthing Field Sign-off"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden lg:inline">{t.gtSignoff}</span>
        </button>

        <button
          onClick={onOpenAnalytics}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-700 transition-all"
          title="LULC & Cadastral Analytics"
        >
          <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden lg:inline">{t.analytics}</span>
        </button>

        <button
          onClick={onOpenBenchmarks}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-700 transition-all"
          title="Evaluation Metrics vs Ground Truth"
        >
          <Award className="w-3.5 h-3.5 text-yellow-400" />
          <span className="hidden lg:inline">{t.benchmarks}</span>
        </button>

        <button
          onClick={onOpenExports}
          className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md shadow-indigo-500/20 transition-all active:scale-95"
          title="Download GIS Formats (Shapefile, GeoPackage, DXF, CSV)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t.export}</span>
        </button>

        <button
          onClick={refreshData}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all"
          title="Refresh All Map Layers"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
