import { useState, useCallback } from 'react';
import { useStore } from '../../services/store';
import { User, Download, Trash2, AlertTriangle, HardDrive, Shield } from 'lucide-react';
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
    <div className="profile-page">
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

      {/* Storage info */}
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">
            <HardDrive size={16} style={{ marginRight: 8 }} />
            Local storage
          </h3>
        </div>
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          <Shield size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            All data is stored locally in your browser. Nothing is sent to a server.
            Clearing browser data or switching browsers will remove your saved data.
          </span>
        </div>
        <div className="profile-storage-stats">
          <div className="profile-storage-stat">
            <span className="font-mono">{assessments.length}</span>
            <span className="text-tertiary">Assessment{assessments.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="profile-storage-stat">
            <span className="font-mono">{tasks.length}</span>
            <span className="text-tertiary">Task{tasks.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="profile-storage-stat">
            <span className="font-mono">{scenarios.length}</span>
            <span className="text-tertiary">Scenario{scenarios.length !== 1 ? 's' : ''}</span>
          </div>
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
            Export data as JSON
          </button>
          <button className="btn btn-danger" onClick={() => setShowClearDialog(true)}>
            <Trash2 size={16} />
            Clear all data
          </button>
        </div>
      </section>

      {/* Clear dialog */}
      {showClearDialog && (
        <div className="dialog-overlay" onClick={() => setShowClearDialog(false)}>
          <div
            className="dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-label="Clear all data"
          >
            <h3>Clear all data?</h3>
            <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
              This will permanently remove all assessments, tasks, scenarios, and preferences.
              This action cannot be undone.
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
                Clear all data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
