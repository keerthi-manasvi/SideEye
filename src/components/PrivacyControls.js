import React, { useState, useEffect } from 'react';
import './PrivacyControls.css';

const PrivacyControls = () => {
  const [dataSummary, setDataSummary] = useState(null);
  const [encryptionStatus, setEncryptionStatus] = useState(null);
  const [retentionPolicy, setRetentionPolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [newRetentionDays, setNewRetentionDays] = useState(90);

  useEffect(() => {
    loadPrivacyData();
  }, []);

  const loadPrivacyData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load data summary
      const summaryResponse = await fetch('/api/privacy/data_summary/');
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setDataSummary(summaryData);
      }

      // Load encryption status
      const encryptionResponse = await fetch('/api/privacy/encryption_status/');
      if (encryptionResponse.ok) {
        const encryptionData = await encryptionResponse.json();
        setEncryptionStatus(encryptionData);
      }

      // Load retention policy
      const retentionResponse = await fetch('/api/privacy/retention_policy/');
      if (retentionResponse.ok) {
        const retentionData = await retentionResponse.json();
        setRetentionPolicy(retentionData);
        setNewRetentionDays(retentionData.retention_days);
      }
    } catch (err) {
      setError('Failed to load privacy data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async (includeEmotions = true) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/privacy/export_data/?include_emotions=${includeEmotions}`);
      if (response.ok) {
        const exportData = await response.json();
        
        // Create and download file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sideeye-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Export failed');
      }
    } catch (err) {
      setError('Failed to export data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRetentionPolicy = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/privacy/apply_retention_policy/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          retention_days: newRetentionDays
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Retention policy applied successfully. Deleted: ${JSON.stringify(result.deleted_counts)}`);
        loadPrivacyData(); // Refresh data
      } else {
        throw new Error('Failed to apply retention policy');
      }
    } catch (err) {
      setError('Failed to apply retention policy: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetRetentionPolicy = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/privacy/set_retention_policy/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          retention_days: newRetentionDays
        })
      });

      if (response.ok) {
        alert('Retention policy updated successfully');
        loadPrivacyData(); // Refresh data
      } else {
        throw new Error('Failed to set retention policy');
      }
    } catch (err) {
      setError('Failed to set retention policy: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmationText !== 'DELETE_ALL_DATA') {
      setError('Please type "DELETE_ALL_DATA" to confirm');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/privacy/secure_delete_all/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmation: deleteConfirmationText
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`All data deleted successfully. Counts: ${JSON.stringify(result.deleted_counts)}`);
        setShowDeleteConfirmation(false);
        setDeleteConfirmationText('');
        loadPrivacyData(); // Refresh data
      } else {
        throw new Error('Failed to delete data');
      }
    } catch (err) {
      setError('Failed to delete data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupOrphanedData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/privacy/cleanup_orphaned_data/', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Cleanup completed. Cleaned: ${JSON.stringify(result.cleanup_counts)}`);
        loadPrivacyData(); // Refresh data
      } else {
        throw new Error('Failed to cleanup data');
      }
    } catch (err) {
      setError('Failed to cleanup data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateIntegrity = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/privacy/validate_integrity/');
      if (response.ok) {
        const report = await response.json();
        
        let message = `Integrity Check Results:\n`;
        message += `Checks Passed: ${report.checks_passed}\n`;
        message += `Checks Failed: ${report.checks_failed}\n`;
        
        if (report.issues.length > 0) {
          message += `\nIssues Found:\n${report.issues.join('\n')}`;
        }
        
        if (report.recommendations.length > 0) {
          message += `\nRecommendations:\n${report.recommendations.join('\n')}`;
        }
        
        alert(message);
      } else {
        throw new Error('Failed to validate integrity');
      }
    } catch (err) {
      setError('Failed to validate integrity: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !dataSummary) {
    return (
      <div className="privacy-controls">
        <div className="loading">Loading privacy controls...</div>
      </div>
    );
  }

  return (
    <div className="privacy-controls">
      <h2>Privacy & Data Controls</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Data Summary Section */}
      {dataSummary && (
        <div className="privacy-section">
          <h3>Data Summary</h3>
          <div className="data-counts">
            <div className="count-item">
              <span className="count">{dataSummary.data_counts.emotion_readings}</span>
              <span className="label">Emotion Readings</span>
            </div>
            <div className="count-item">
              <span className="count">{dataSummary.data_counts.tasks}</span>
              <span className="label">Tasks</span>
            </div>
            <div className="count-item">
              <span className="count">{dataSummary.data_counts.user_feedback}</span>
              <span className="label">Feedback Entries</span>
            </div>
            <div className="count-item">
              <span className="count">{dataSummary.data_counts.music_recommendations}</span>
              <span className="label">Music Recommendations</span>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Status Section */}
      {encryptionStatus && (
        <div className="privacy-section">
          <h3>Privacy Status</h3>
          <div className="privacy-status">
            <div className="status-item">
              <span className="status-label">Encryption:</span>
              <span className={`status-value ${encryptionStatus.encryption_enabled ? 'enabled' : 'disabled'}`}>
                {encryptionStatus.encryption_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Local Processing:</span>
              <span className="status-value enabled">
                {encryptionStatus.local_processing_only ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Data Location:</span>
              <span className="status-value">{encryptionStatus.data_location}</span>
            </div>
          </div>
        </div>
      )}

      {/* Data Retention Section */}
      {retentionPolicy && (
        <div className="privacy-section">
          <h3>Data Retention Policy</h3>
          <div className="retention-controls">
            <p>Current policy: Data is automatically deleted after {retentionPolicy.retention_days} days</p>
            
            <div className="retention-input">
              <label htmlFor="retention-days">Retention Period (days):</label>
              <input
                id="retention-days"
                type="number"
                min="1"
                max="3650"
                value={newRetentionDays}
                onChange={(e) => setNewRetentionDays(parseInt(e.target.value))}
              />
              <button 
                onClick={handleSetRetentionPolicy}
                disabled={loading}
                className="btn-secondary"
              >
                Update Policy
              </button>
            </div>
            
            <button 
              onClick={handleApplyRetentionPolicy}
              disabled={loading}
              className="btn-warning"
            >
              Apply Retention Policy Now
            </button>
          </div>
        </div>
      )}

      {/* Data Export Section */}
      <div className="privacy-section">
        <h3>Data Export</h3>
        <p>Export your data for backup or portability</p>
        <div className="export-controls">
          <button 
            onClick={() => handleExportData(true)}
            disabled={loading}
            className="btn-primary"
          >
            Export All Data (Including Emotions)
          </button>
          <button 
            onClick={() => handleExportData(false)}
            disabled={loading}
            className="btn-secondary"
          >
            Export Data (Excluding Raw Emotions)
          </button>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="privacy-section">
        <h3>Data Management</h3>
        <div className="management-controls">
          <button 
            onClick={handleCleanupOrphanedData}
            disabled={loading}
            className="btn-secondary"
          >
            Cleanup Orphaned Data
          </button>
          <button 
            onClick={handleValidateIntegrity}
            disabled={loading}
            className="btn-secondary"
          >
            Validate Data Integrity
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="privacy-section danger-zone">
        <h3>Danger Zone</h3>
        <p>Permanently delete all your data. This action cannot be undone.</p>
        
        {!showDeleteConfirmation ? (
          <button 
            onClick={() => setShowDeleteConfirmation(true)}
            className="btn-danger"
          >
            Delete All Data
          </button>
        ) : (
          <div className="delete-confirmation">
            <p>Type "DELETE_ALL_DATA" to confirm permanent deletion:</p>
            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="DELETE_ALL_DATA"
            />
            <div className="confirmation-buttons">
              <button 
                onClick={handleDeleteAllData}
                disabled={loading || deleteConfirmationText !== 'DELETE_ALL_DATA'}
                className="btn-danger"
              >
                Confirm Delete All
              </button>
              <button 
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setDeleteConfirmationText('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Processing...</div>
        </div>
      )}
    </div>
  );
};

export default PrivacyControls;