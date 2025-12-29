import React, { useState, useEffect } from 'react';
import './UpdateChecker.css';

/**
 * UpdateChecker Component
 * Handles application updates and displays update notifications
 */
const UpdateChecker = () => {
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  useEffect(() => {
    // Listen for update status from main process
    const handleUpdateStatus = (event, status) => {
      console.log('Update status:', status);
      setUpdateStatus(status.status);
      
      switch (status.status) {
        case 'available':
          setUpdateInfo(status);
          setShowUpdateDialog(true);
          break;
        case 'downloading':
          setDownloadProgress(status.progress);
          break;
        case 'downloaded':
          setUpdateInfo(status);
          setShowUpdateDialog(true);
          break;
        case 'error':
          console.error('Update error:', status.error);
          break;
        default:
          break;
      }
    };

    // Register IPC listener
    if (window.electronAPI) {
      window.electronAPI.onUpdaterStatus(handleUpdateStatus);
    }

    return () => {
      // Cleanup listener if needed
      if (window.electronAPI && window.electronAPI.removeUpdaterListener) {
        window.electronAPI.removeUpdaterListener(handleUpdateStatus);
      }
    };
  }, []);

  const handleCheckForUpdates = async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.checkForUpdates();
        if (!result.success) {
          console.error('Failed to check for updates:', result.error);
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    }
  };

  const handleDownloadUpdate = async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.downloadUpdate();
        if (!result.success) {
          console.error('Failed to download update:', result.error);
        }
      } catch (error) {
        console.error('Error downloading update:', error);
      }
    }
  };

  const handleInstallUpdate = async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.installUpdate();
        if (!result.success) {
          console.error('Failed to install update:', result.error);
        }
      } catch (error) {
        console.error('Error installing update:', error);
      }
    }
  };

  const handleDismissUpdate = () => {
    setShowUpdateDialog(false);
  };

  const renderUpdateDialog = () => {
    if (!showUpdateDialog || !updateInfo) return null;

    const isUpdateAvailable = updateStatus === 'available';
    const isUpdateDownloaded = updateStatus === 'downloaded';

    return (
      <div className="update-dialog-overlay">
        <div className="update-dialog">
          <div className="update-dialog-header">
            <h3>
              {isUpdateAvailable && '🎉 Update Available!'}
              {isUpdateDownloaded && '✅ Update Ready!'}
            </h3>
          </div>
          
          <div className="update-dialog-content">
            {isUpdateAvailable && (
              <>
                <p>
                  A new version of SideEye Workspace is available: <strong>v{updateInfo.version}</strong>
                </p>
                {updateInfo.releaseNotes && (
                  <div className="release-notes">
                    <h4>What's New:</h4>
                    <div dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }} />
                  </div>
                )}
              </>
            )}
            
            {isUpdateDownloaded && (
              <p>
                Update v{updateInfo.version} has been downloaded and is ready to install. 
                The application will restart to complete the installation.
              </p>
            )}
          </div>
          
          <div className="update-dialog-actions">
            {isUpdateAvailable && (
              <>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleDismissUpdate}
                >
                  Later
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleDownloadUpdate}
                >
                  Download Update
                </button>
              </>
            )}
            
            {isUpdateDownloaded && (
              <>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleDismissUpdate}
                >
                  Install Later
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleInstallUpdate}
                >
                  Install & Restart
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDownloadProgress = () => {
    if (updateStatus !== 'downloading' || !downloadProgress) return null;

    const percent = Math.round(downloadProgress.percent);
    const transferred = Math.round(downloadProgress.transferred / 1024 / 1024);
    const total = Math.round(downloadProgress.total / 1024 / 1024);
    const speed = Math.round(downloadProgress.bytesPerSecond / 1024);

    return (
      <div className="download-progress">
        <div className="progress-header">
          <span>Downloading Update...</span>
          <span>{percent}%</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="progress-details">
          <span>{transferred}MB / {total}MB</span>
          <span>{speed} KB/s</span>
        </div>
      </div>
    );
  };

  const renderUpdateStatus = () => {
    if (!updateStatus) return null;

    const statusMessages = {
      checking: '🔍 Checking for updates...',
      'not-available': '✅ You have the latest version',
      downloading: '⬇️ Downloading update...',
      error: '❌ Update check failed'
    };

    const message = statusMessages[updateStatus];
    if (!message) return null;

    return (
      <div className={`update-status ${updateStatus}`}>
        {message}
      </div>
    );
  };

  return (
    <div className="update-checker">
      {renderUpdateStatus()}
      {renderDownloadProgress()}
      {renderUpdateDialog()}
      
      {/* Manual update check button (for settings/help menu) */}
      <button 
        className="btn btn-link update-check-btn" 
        onClick={handleCheckForUpdates}
        title="Check for updates"
      >
        Check for Updates
      </button>
    </div>
  );
};

export default UpdateChecker;