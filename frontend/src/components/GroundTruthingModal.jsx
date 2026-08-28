import React, { useState, useEffect } from 'react';
import { ShieldCheck, MapPin, CheckCircle2, XCircle, AlertCircle, FileText, History, X } from 'lucide-react';
import { submitGtSignoff, getAuditTrail } from '../services/api';

export default function GroundTruthingModal({
  aoiId,
  selectedParcel,
  onClose,
  onSuccess
}) {
  const [surveyorName, setSurveyorName] = useState('Rajesh Sharma (Sr. Cadastral Officer)');
  const [surveyorId, setSurveyorId] = useState('GT-SURV-IND-0428');
  const [status, setStatus] = useState('Approved');
  const [notes, setNotes] = useState('GNSS CORS base-station check confirmed physical boundary alignment with 1.4cm tolerance.');
  const [gnssDelta, setGnssDelta] = useState(1.4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadAudit();
  }, [aoiId]);

  const loadAudit = async () => {
    try {
      const res = await getAuditTrail(aoiId);
      setAuditLogs(res.audit_trail || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedParcel) return;
    setLoading(true);
    setError(null);
    try {
      const res = await submitGtSignoff({
        aoi_id: aoiId,
        parcel_id: selectedParcel.properties?.parcel_id,
        surveyor_name: surveyorName,
        surveyor_id: surveyorId,
        status: status,
        notes: notes,
        gnss_delta_cm: parseFloat(gnssDelta)
      });

      if (res.status === 'success') {
        onSuccess(res.message);
      } else {
        setError(res.message || 'Sign-off failed');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Submission error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Ground Truthing (GT) Sign-off</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {selectedParcel?.properties?.parcel_id} — {selectedParcel?.properties?.survey_number}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: Sign-off vs Audit History */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 text-xs">
          <button
            onClick={() => setShowHistory(false)}
            className={`flex-1 py-2 font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              !showHistory ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Field Verification Form
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`flex-1 py-2 font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              showHistory ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Audit Trail ({auditLogs.length})
          </button>
        </div>

        {/* Form Body */}
        {!showHistory ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* GNSS Validation Preview */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" /> GNSS CORS Precision Anchor
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">RTK Fixed</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="text-slate-400">Parcel Area: <span className="text-white font-mono">{selectedParcel?.properties?.area_sqm} sqm</span></div>
                <div className="text-slate-400">Position Delta: <span className="text-emerald-400 font-mono">{gnssDelta} cm</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Surveyor Name</label>
                <input
                  type="text"
                  value={surveyorName}
                  onChange={(e) => setSurveyorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Officer Badge ID</label>
                <input
                  type="text"
                  value={surveyorId}
                  onChange={(e) => setSurveyorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Verification Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                >
                  <option value="Approved">Approved (Official Sign-off)</option>
                  <option value="Field Verified">Field Verified (Provisional)</option>
                  <option value="Rejected">Rejected (Re-survey Needed)</option>
                  <option value="Modified">Modified in Field</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">GNSS Delta (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={gnssDelta}
                  onChange={(e) => setGnssDelta(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Field Surveyor Observations</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500 resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? 'Submitting Sign-off...' : 'Submit Official GT Sign-off'}
            </button>
          </form>
        ) : (
          <div className="p-5 max-h-96 overflow-y-auto space-y-2.5 text-xs">
            {auditLogs.length === 0 ? (
              <div className="text-center text-slate-500 py-8">No audit logs found for this AOI.</div>
            ) : (
              auditLogs.map((log, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-emerald-400 font-bold">{log.action}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{log.timestamp}</span>
                  </div>
                  <div className="text-slate-300">
                    Parcel: <span className="font-mono text-blue-400">{log.parcel_id}</span>
                  </div>
                  {log.surveyor_name && (
                    <div className="text-slate-400 text-[11px]">
                      Surveyor: {log.surveyor_name} ({log.surveyor_id})
                    </div>
                  )}
                  {log.notes && (
                    <div className="text-slate-400 text-[11px] italic bg-slate-900 p-1.5 rounded">
                      "{log.notes}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
