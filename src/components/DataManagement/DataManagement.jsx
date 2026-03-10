import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Download,
  Upload,
  Cloud,
  CloudOff,
  ArrowDownToLine,
  ArrowUpFromLine,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import './DataManagement.css';

export default function DataManagement() {
  const {
    showDataManagement,
    setShowDataManagement,
    exportAllData,
    importAllData,
    syncFromCloud,
    pushAllToCloud,
    isSyncing,
    goals,
    tasks,
    reflections,
    routines,
    journalEntries,
    lifeScoreData,
    weeklyPlanningData,
  } = useApp();

  const { user, isConfigured } = useAuth();
  const fileInputRef = useRef(null);

  // Local UI state
  const [importConfirm, setImportConfirm] = useState(null); // holds parsed JSON for confirmation
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text }
  const [isProcessing, setIsProcessing] = useState(false);

  if (!showDataManagement) return null;

  const handleClose = () => {
    setShowDataManagement(false);
    setImportConfirm(null);
    setStatusMessage(null);
  };

  // ── EXPORT ────────────────────────────────
  const handleExport = () => {
    try {
      const data = exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `goal-planner-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      localStorage.setItem('lastExportDate', new Date().toISOString());
      setStatusMessage({ type: 'success', text: 'Backup exported successfully!' });
    } catch (err) {
      console.error('[Export] Failed:', err);
      setStatusMessage({ type: 'error', text: 'Export failed: ' + err.message });
    }
  };

  // ── IMPORT ────────────────────────────────
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);

        // Validate basic structure
        if (!parsed.data || typeof parsed.data !== 'object') {
          setStatusMessage({ type: 'error', text: 'Invalid backup file — missing data section.' });
          return;
        }

        // Show confirmation with details
        const d = parsed.data;
        const counts = {
          goals: Array.isArray(d.goals) ? d.goals.length : 0,
          tasks: Array.isArray(d.tasks) ? d.tasks.length : 0,
          reflections: Array.isArray(d.reflections) ? d.reflections.length : 0,
          journal: Array.isArray(d.journalEntries) ? d.journalEntries.length : 0,
          routines: d.routines ? Object.keys(d.routines).length : 0,
        };

        setImportConfirm({
          data: parsed,
          exportDate: parsed.exportDate || 'Unknown',
          version: parsed.version || 'Unknown',
          counts,
        });
        setStatusMessage(null);
      } catch (err) {
        setStatusMessage({ type: 'error', text: 'Could not parse file — not a valid JSON backup.' });
      }
    };
    reader.readAsText(file);

    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  const handleImportConfirm = () => {
    if (!importConfirm?.data) return;

    setIsProcessing(true);
    try {
      importAllData(importConfirm.data);
      setStatusMessage({ type: 'success', text: 'Data restored successfully! All data has been imported.' });
      setImportConfirm(null);
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Import failed: ' + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── CLOUD SYNC ────────────────────────────
  const handlePullFromCloud = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const results = await syncFromCloud();
      if (results.errors.length > 0) {
        setStatusMessage({ type: 'error', text: `Pulled ${results.pulled} items with ${results.errors.length} error(s).` });
      } else {
        setStatusMessage({ type: 'success', text: `Successfully pulled ${results.pulled} items from cloud.` });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Cloud sync failed: ' + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePushToCloud = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const results = await pushAllToCloud();
      if (results.errors.length > 0) {
        const firstErrors = results.errors.slice(0, 3).join('; ');
        const moreCount = results.errors.length > 3 ? ` (+${results.errors.length - 3} more)` : '';
        setStatusMessage({ type: 'error', text: `Pushed ${results.pushed} items with ${results.errors.length} error(s): ${firstErrors}${moreCount}` });
      } else {
        setStatusMessage({ type: 'success', text: `Successfully pushed ${results.pushed} items to cloud!` });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Cloud push failed: ' + err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── DATA COUNTS ───────────────────────────
  const dataCounts = {
    goals: goals.length,
    tasks: tasks.length,
    reflections: reflections.length,
    journal: journalEntries.length,
    routines: Object.keys(routines).length,
    lifeScore: lifeScoreData ? 1 : 0,
    weeklyPlans: Array.isArray(weeklyPlanningData) ? weeklyPlanningData.length : 0,
  };

  const lastExport = localStorage.getItem('lastExportDate');

  return (
    <div className="data-management-overlay" onClick={handleClose}>
      <div className="data-management-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="data-mgmt-header">
          <div className="data-mgmt-header-left">
            <Database size={22} />
            <h2>Data Management</h2>
          </div>
          <button className="data-mgmt-close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="data-mgmt-body">
          {/* Status Message */}
          {statusMessage && (
            <div className={`data-mgmt-status ${statusMessage.type}`}>
              {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Data Overview */}
          <div className="data-mgmt-section">
            <h3><HardDrive size={16} /> Your Data</h3>
            <div className="data-mgmt-stats">
              <div className="stat-item">
                <span className="stat-value">{dataCounts.goals}</span>
                <span className="stat-label">Goals</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{dataCounts.tasks}</span>
                <span className="stat-label">Tasks</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{dataCounts.reflections}</span>
                <span className="stat-label">Reflections</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{dataCounts.journal}</span>
                <span className="stat-label">Journal</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{dataCounts.routines}</span>
                <span className="stat-label">Routines</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{dataCounts.weeklyPlans}</span>
                <span className="stat-label">Plans</span>
              </div>
            </div>
            {lastExport && (
              <p className="data-mgmt-last-export">
                Last backup: {format(new Date(lastExport), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>

          {/* Local Backup Section */}
          <div className="data-mgmt-section">
            <h3><Shield size={16} /> Local Backup</h3>
            <p className="data-mgmt-description">
              Export your data as a JSON file to keep a safe backup. Import a backup to restore your data anytime.
            </p>
            <div className="data-mgmt-actions">
              <button className="data-mgmt-btn primary" onClick={handleExport}>
                <Download size={16} />
                <span>Export Backup</span>
              </button>
              <button className="data-mgmt-btn secondary" onClick={handleImportClick}>
                <Upload size={16} />
                <span>Import Backup</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>
          </div>

          {/* Import Confirmation */}
          {importConfirm && (
            <div className="data-mgmt-section confirm-section">
              <h3><AlertCircle size={16} /> Confirm Import</h3>
              <p className="data-mgmt-description">
                This will replace your current data with the backup from{' '}
                <strong>
                  {importConfirm.exportDate !== 'Unknown'
                    ? format(new Date(importConfirm.exportDate), 'MMM d, yyyy h:mm a')
                    : 'Unknown date'}
                </strong>.
              </p>
              <div className="import-preview-stats">
                <span>{importConfirm.counts.goals} goals</span>
                <span>{importConfirm.counts.tasks} tasks</span>
                <span>{importConfirm.counts.reflections} reflections</span>
                <span>{importConfirm.counts.journal} journal entries</span>
                <span>{importConfirm.counts.routines} routines</span>
              </div>
              <div className="data-mgmt-actions">
                <button
                  className="data-mgmt-btn danger"
                  onClick={handleImportConfirm}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
                  <span>Yes, Restore This Backup</span>
                </button>
                <button className="data-mgmt-btn secondary" onClick={() => setImportConfirm(null)}>
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {/* Cloud Sync Section */}
          <div className="data-mgmt-section">
            <h3>
              {isConfigured ? <Cloud size={16} /> : <CloudOff size={16} />}
              {' '}Cloud Sync
            </h3>
            {isConfigured && user ? (
              <>
                <div className="data-mgmt-cloud-status">
                  <div className="cloud-status-dot connected" />
                  <span>Connected as {user.email}</span>
                </div>
                <p className="data-mgmt-description">
                  Pull data from the cloud to restore on a new device, or push your local data to the cloud for safekeeping.
                </p>
                <div className="data-mgmt-actions">
                  <button
                    className="data-mgmt-btn primary"
                    onClick={handlePullFromCloud}
                    disabled={isProcessing || isSyncing}
                  >
                    {(isProcessing || isSyncing) ? <Loader2 size={16} className="spin" /> : <ArrowDownToLine size={16} />}
                    <span>Pull from Cloud</span>
                  </button>
                  <button
                    className="data-mgmt-btn secondary"
                    onClick={handlePushToCloud}
                    disabled={isProcessing || isSyncing}
                  >
                    {(isProcessing || isSyncing) ? <Loader2 size={16} className="spin" /> : <ArrowUpFromLine size={16} />}
                    <span>Push to Cloud</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="data-mgmt-cloud-offline">
                <div className="data-mgmt-cloud-status">
                  <div className="cloud-status-dot disconnected" />
                  <span>Local mode — cloud sync not configured</span>
                </div>
                <p className="data-mgmt-description">
                  Connect a Supabase backend to enable cross-device sync. Your data is currently stored only in this browser.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
