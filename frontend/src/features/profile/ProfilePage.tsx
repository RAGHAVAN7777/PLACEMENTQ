import CandidateProfile from './CandidateProfile';
import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../services/store';
import { interviewApi, type InterviewReport } from '../../services/interviewApi';
import { ROUTES } from '../../config';
import { User, Download, Trash2, AlertTriangle, HardDrive, Shield, ArrowUpRight, MessageSquare } from 'lucide-react';
import './ProfilePage.css';

export default function ProfilePage() {
  const preferences = useStore((s) => s.preferences);
  const updatePreferences = useStore((s) => s.updatePreferences);
  const exportData = useStore((s) => s.exportData);
  const clearAllData = useStore((s) => s.clearAllData);
  const assessments = useStore((s) => s.assessments);
  const tasks = useStore((s) => s.tasks);
  const scenarios = useStore((s) => s.scenarios);

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [displayName, setDisplayName] = useState(preferences.displayName ?? '');
  const [reports, setReports] = useState<InterviewReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setReportsLoading(true);
    setReportsError('');
    interviewApi.reports().then(({ reports }) => { if (active) setReports(reports); })
      .catch((error) => { if (active) setReportsError(error instanceof Error ? error.message : 'Could not load interview records.'); })
      .finally(() => { if (active) setReportsLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const handleSaveName = useCallback(() => {
    updatePreferences({ displayName: displayName.trim() || undefined });
  }, [displayName, updatePreferences]);

  const handleExport = useCallback(() => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `placementiq-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportData]);

  const handleClear = useCallback(() => {
    clearAllData();
    setShowClearDialog(false);
    setDisplayName('');
  }, [clearAllData]);

  return (
    <div className="profile-page"><CandidateProfile/>
      {/* Display name */}
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">
            <User size={16} style={{ marginRight: 8 }} />
            Display name
          </h3>
        </div>
        <div className="profile-name-form">
          <input
            type="text"
            className="form-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Optional display name"
            style={{ maxWidth: 300 }}
          />
          <button className="btn btn-secondary btn-sm" onClick={handleSaveName}>
            Save
          </button>
        </div>
        <p className="form-hint" style={{ marginTop: 8 }}>
          Optional. Used only for display within this browser.
        </p>
      </section>

      <section className="card profile-interview-card">
        <div className="card-header">
          <h3 className="card-title"><MessageSquare size={16} style={{ marginRight: 8 }} />Interview assessments</h3>
          <Link className="profile-report-link" to={ROUTES.interviewReports}>View all <ArrowUpRight size={14} /></Link>
        </div>
        <p className="form-hint">Your interview and baseline snapshots are linked in the integrated readiness assessment.</p>
        {reportsLoading ? <p className="profile-record-status" role="status">Loading interview records…</p> : reportsError ? <div className="notice notice-warning profile-record-status" role="alert"><span>{reportsError} Start the local API to load saved interviews.</span><button className="btn btn-secondary btn-sm" onClick={() => setReload((value) => value + 1)}>Retry</button></div> : reports.length ? <div className="profile-interview-records">{reports.slice(0, 3).map((report) => <Link key={report.id} className="profile-interview-record" to={`${ROUTES.interviewReports}?report=${encodeURIComponent(report.id)}`}><div><strong>{report.selectedDomain}</strong><span>{new Date(report.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })} · {report.questions.length} questions</span></div><b>{report.assessment.score}<small>/100</small></b><ArrowUpRight size={15} /></Link>)}</div> : <div className="profile-record-status"><p>No interview assessment yet. Your first completed interview will appear here.</p><Link className="btn btn-primary btn-sm" to={ROUTES.assessment}>Tell Your Success <ArrowUpRight size={14} /></Link></div>}
      </section>

      {/* Storage info */}
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">
            <HardDrive size={16} style={{ marginRight: 8 }} />
            Local data
          </h3>
        </div>
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          <Shield size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Placement predictions, tasks, and preferences are stored in this browser.
            Interview sessions, résumé text, and reports are stored by the local API on this computer.
            This browser holds the access key for those reports; clearing browser storage or switching browsers removes that access.
          </span>
        </div>
        <div className="profile-storage-stats">
          <div className="profile-storage-stat">
            <span className="font-mono">{assessments.length}</span>
            <span className="text-tertiary">Prediction{assessments.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="profile-storage-stat">
            <span className="font-mono">{tasks.length}</span>
            <span className="text-tertiary">Task{tasks.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="profile-storage-stat">
            <span className="font-mono">{scenarios.length}</span>
            <span className="text-tertiary">Scenario{scenarios.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="profile-storage-stat"><span className="font-mono">{reportsLoading || reportsError ? '—' : reports.length}</span><span className="text-tertiary">Interview{reports.length !== 1 ? 's' : ''}</span></div>
        </div>
      </section>

      {/* Data management */}
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Data management</h3>
        </div>
        <div className="profile-actions">
          <button className="btn btn-secondary" onClick={handleExport}>
            <Download size={16} />
            Export browser workspace
          </button>
          <button className="btn btn-danger" onClick={() => setShowClearDialog(true)}>
            <Trash2 size={16} />
            Clear browser workspace
          </button>
        </div>
        <p className="form-hint" style={{ marginTop: 12 }}>These actions apply to predictions, tasks, scenarios, and preferences. Export individual interview reports from Saved reports. Clearing the workspace keeps your interview access key and saved reports.</p>
      </section>

      {/* Clear dialog */}
      {showClearDialog && (
        <div className="dialog-overlay" onClick={() => setShowClearDialog(false)}>
          <div
            className="dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-label="Clear browser workspace"
          >
            <h3>Clear browser workspace?</h3>
            <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
              This permanently removes browser predictions, tasks, scenarios, and preferences.
              Interview sessions and saved reports remain available. Export this workspace first if you need a copy.
            </p>
            <div className="notice notice-warning" style={{ marginTop: 12 }}>
              <AlertTriangle size={14} />
              <span>Consider exporting your data first.</span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setShowClearDialog(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleClear}>
                Clear browser workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
