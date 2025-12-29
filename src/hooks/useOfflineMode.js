import { useState, useEffect, useCallback } from 'react';

const useOfflineMode = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [lastBackendCheck, setLastBackendCheck] = useState(null);

  // Check backend connectivity
  const checkBackendConnectivity = useCallback(async () => {
    try {
      if (!window.electronAPI?.djangoService?.healthCheck) {
        setIsBackendOnline(false);
        return false;
      }

      const result = await window.electronAPI.djangoService.healthCheck();
      const isHealthy = result.success && result.healthy;
      
      setIsBackendOnline(isHealthy);
      setLastBackendCheck(Date.now());
      
      return isHealthy;
    } catch (error) {
      console.warn('Backend connectivity check failed:', error);
      setIsBackendOnline(false);
      setLastBackendCheck(Date.now());
      return false;
    }
  }, []);

  // Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // When coming back online, check backend and process queue
      checkBackendConnectivity().then(backendOnline => {
        if (backendOnline) {
          processOfflineQueue();
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsBackendOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial backend check
    checkBackendConnectivity();

    // Periodic backend health checks
    const healthCheckInterval = setInterval(checkBackendConnectivity, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(healthCheckInterval);
    };
  }, [checkBackendConnectivity]);

  // Add request to offline queue
  const queueOfflineRequest = useCallback((request) => {
    const queueItem = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      ...request
    };

    setOfflineQueue(prev => {
      const newQueue = [...prev, queueItem];
      // Limit queue size to prevent memory issues
      return newQueue.slice(-100);
    });

    // Store in localStorage for persistence
    try {
      const existingQueue = JSON.parse(localStorage.getItem('sideeye_offline_queue') || '[]');
      existingQueue.push(queueItem);
      localStorage.setItem('sideeye_offline_queue', JSON.stringify(existingQueue.slice(-100)));
    } catch (error) {
      console.warn('Failed to persist offline queue:', error);
    }

    return queueItem.id;
  }, []);

  // Process offline queue when back online
  const processOfflineQueue = useCallback(async () => {
    if (!isBackendOnline || offlineQueue.length === 0) {
      return;
    }

    console.log(`Processing ${offlineQueue.length} queued requests...`);
    const processedIds = [];
    const failedRequests = [];

    for (const request of offlineQueue) {
      try {
        if (window.electronAPI?.djangoService?.apiCall) {
          const result = await window.electronAPI.djangoService.apiCall(
            request.endpoint,
            request.method,
            request.data
          );

          if (result.success) {
            processedIds.push(request.id);
            console.log(`Successfully processed queued request: ${request.method} ${request.endpoint}`);
          } else {
            failedRequests.push(request);
          }
        }
      } catch (error) {
        console.warn(`Failed to process queued request: ${request.method} ${request.endpoint}`, error);
        failedRequests.push(request);
      }
    }

    // Remove processed requests from queue
    setOfflineQueue(prev => prev.filter(req => !processedIds.includes(req.id)));

    // Update localStorage
    try {
      const remainingQueue = offlineQueue.filter(req => !processedIds.includes(req.id));
      localStorage.setItem('sideeye_offline_queue', JSON.stringify(remainingQueue));
    } catch (error) {
      console.warn('Failed to update offline queue in localStorage:', error);
    }

    if (processedIds.length > 0) {
      console.log(`Successfully processed ${processedIds.length} queued requests`);
    }

    if (failedRequests.length > 0) {
      console.warn(`${failedRequests.length} requests failed to process and remain queued`);
    }
  }, [isBackendOnline, offlineQueue]);

  // Load offline queue from localStorage on mount
  useEffect(() => {
    try {
      const storedQueue = JSON.parse(localStorage.getItem('sideeye_offline_queue') || '[]');
      if (storedQueue.length > 0) {
        setOfflineQueue(storedQueue);
        console.log(`Loaded ${storedQueue.length} requests from offline queue`);
      }
    } catch (error) {
      console.warn('Failed to load offline queue from localStorage:', error);
    }
  }, []);

  // Clear offline queue
  const clearOfflineQueue = useCallback(() => {
    setOfflineQueue([]);
    try {
      localStorage.removeItem('sideeye_offline_queue');
    } catch (error) {
      console.warn('Failed to clear offline queue from localStorage:', error);
    }
  }, []);

  // Make API call with offline support
  const makeOfflineCapableRequest = useCallback(async (endpoint, method = 'GET', data = null, options = {}) => {
    const { queueIfOffline = true, priority = 'normal', timeout = 10000 } = options;

    // If we're online and backend is available, make the request normally
    if (isOnline && isBackendOnline) {
      try {
        if (window.electronAPI?.djangoService?.apiCall) {
          const result = await Promise.race([
            window.electronAPI.djangoService.apiCall(endpoint, method, data),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]);
          
          return result;
        } else {
          throw new Error('Django service API not available');
        }
      } catch (error) {
        console.warn(`API request failed: ${method} ${endpoint}`, error);
        
        // Check if it's a network/service error that should trigger offline mode
        if (error.message.includes('timeout') || 
            error.message.includes('fetch') || 
            error.message.includes('Network') ||
            error.message.includes('service')) {
          
          // Mark backend as offline
          setIsBackendOnline(false);
          
          // If request fails and queueing is enabled, add to queue
          if (queueIfOffline) {
            const queueId = queueOfflineRequest({ endpoint, method, data, priority });
            return {
              success: false,
              error: 'Service temporarily unavailable - request queued',
              queued: true,
              queueId,
              offline: true
            };
          }
        }
        
        throw error;
      }
    }

    // If offline and queueing is enabled, add to queue
    if (queueIfOffline) {
      const queueId = queueOfflineRequest({ endpoint, method, data, priority });
      return {
        success: false,
        error: isOnline ? 'Backend service unavailable - request queued' : 'Currently offline - request queued',
        queued: true,
        queueId,
        offline: !isOnline
      };
    }

    // Otherwise, return offline error
    return {
      success: false,
      error: isOnline ? 'Backend service unavailable' : 'Currently offline',
      offline: true,
      canRetry: true
    };
  }, [isOnline, isBackendOnline, queueOfflineRequest]);

  // Get offline mode status
  const getOfflineStatus = useCallback(() => {
    return {
      isOnline,
      isBackendOnline,
      isFullyOnline: isOnline && isBackendOnline,
      queuedRequests: offlineQueue.length,
      lastBackendCheck,
      canMakeRequests: isOnline && isBackendOnline
    };
  }, [isOnline, isBackendOnline, offlineQueue.length, lastBackendCheck]);

  return {
    isOnline,
    isBackendOnline,
    isFullyOnline: isOnline && isBackendOnline,
    offlineQueue,
    queuedRequests: offlineQueue.length,
    lastBackendCheck,
    checkBackendConnectivity,
    processOfflineQueue,
    clearOfflineQueue,
    makeOfflineCapableRequest,
    getOfflineStatus
  };
};

export default useOfflineMode;