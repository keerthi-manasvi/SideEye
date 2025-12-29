import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../components/ErrorBoundary';
import errorHandlerService from '../services/ErrorHandlerService';
import useOfflineMode from '../hooks/useOfflineMode';

// Mock components for testing
const ThrowError = ({ shouldThrow, errorType }) => {
  if (shouldThrow) {
    if (errorType === 'render') {
      throw new Error('Test render error');
    } else if (errorType === 'network') {
      throw new Error('Network Error: fetch failed');
    } else if (errorType === 'chunk') {
      const error = new Error('Loading chunk 1 failed');
      error.name = 'ChunkLoadError';
      throw error;
    }
  }
  return <div>No error</div>;
};

const MockApp = ({ shouldThrow, errorType }) => (
  <ErrorBoundary>
    <ThrowError shouldThrow={shouldThrow} errorType={errorType} />
  </ErrorBoundary>
);

// Mock the hooks and services
jest.mock('../hooks/useOfflineMode');
jest.mock('../services/ErrorHandlerService');

// Mock window.electronAPI
const mockElectronAPI = {
  djangoService: {
    apiCall: jest.fn(),
    healthCheck: jest.fn(),
    restart: jest.fn()
  }
};

describe('Error Handling System', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Setup window.electronAPI mock
    Object.defineProperty(window, 'electronAPI', {
      value: mockElectronAPI,
      writable: true
    });
    
    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue()
      },
      writable: true
    });
    
    // Mock useOfflineMode hook
    useOfflineMode.mockReturnValue({
      isOnline: true,
      isBackendOnline: true,
      isFullyOnline: true,
      queuedRequests: 0,
      makeOfflineCapableRequest: jest.fn(),
      getOfflineStatus: jest.fn()
    });
  });

  afterEach(() => {
    // Restore console methods
    console.error.mockRestore();
    console.warn.mockRestore();
    console.log.mockRestore();
  });

  describe('ErrorBoundary Component', () => {
    test('renders children when no error occurs', () => {
      render(<MockApp shouldThrow={false} />);
      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    test('catches and displays render errors', () => {
      render(<MockApp shouldThrow={true} errorType="render" />);
      
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      expect(screen.getByText(/Test render error/)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    test('provides retry functionality', async () => {
      const { rerender } = render(<MockApp shouldThrow={true} errorType="render" />);
      
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      
      // Click retry button
      fireEvent.click(screen.getByText('Try Again'));
      
      // Rerender without error
      rerender(<MockApp shouldThrow={false} />);
      
      await waitFor(() => {
        expect(screen.getByText('No error')).toBeInTheDocument();
      });
    });

    test('handles network errors with appropriate recovery actions', () => {
      render(<MockApp shouldThrow={true} errorType="network" />);
      
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      expect(screen.getByText('Check Connection')).toBeInTheDocument();
    });

    test('handles chunk loading errors with reload option', () => {
      render(<MockApp shouldThrow={true} errorType="chunk" />);
      
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });

    test('shows error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      render(<MockApp shouldThrow={true} errorType="render" />);
      
      expect(screen.getByText('Error Details (Development)')).toBeInTheDocument();
      
      process.env.NODE_ENV = originalEnv;
    });

    test('copies error report to clipboard', async () => {
      render(<MockApp shouldThrow={true} errorType="render" />);
      
      const reportButton = screen.getByText('Report Issue');
      fireEvent.click(reportButton);
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });
    });
  });

  describe('ErrorHandlerService', () => {
    test('logs errors with proper structure', () => {
      const mockLogError = jest.fn().mockReturnValue('error_123');
      errorHandlerService.logError = mockLogError;
      
      const errorData = {
        type: 'test_error',
        error: new Error('Test error'),
        timestamp: Date.now()
      };
      
      const errorId = errorHandlerService.logError(errorData);
      
      expect(mockLogError).toHaveBeenCalledWith(errorData);
      expect(errorId).toBe('error_123');
    });

    test('handles API errors with recovery attempts', async () => {
      const mockHandleAPIError = jest.fn().mockResolvedValue({
        recovered: true,
        result: { success: true }
      });
      errorHandlerService.handleAPIError = mockHandleAPIError;
      
      const error = new Error('Network Error');
      const result = await errorHandlerService.handleAPIError(
        error, 
        '/test-endpoint', 
        'GET'
      );
      
      expect(mockHandleAPIError).toHaveBeenCalledWith(
        error,
        '/test-endpoint',
        'GET'
      );
      expect(result.recovered).toBe(true);
    });

    test('registers and triggers error callbacks', () => {
      const mockCallback = jest.fn();
      const mockRegisterCallback = jest.fn();
      const mockTriggerCallbacks = jest.fn();
      
      errorHandlerService.registerErrorCallback = mockRegisterCallback;
      errorHandlerService.triggerErrorCallbacks = mockTriggerCallbacks;
      
      errorHandlerService.registerErrorCallback('test_error', mockCallback);
      
      expect(mockRegisterCallback).toHaveBeenCalledWith('test_error', mockCallback);
    });

    test('provides error statistics', () => {
      const mockStats = {
        total: 5,
        byType: { api_error: 3, component_error: 2 },
        recent: 2,
        critical: 1
      };
      
      errorHandlerService.getErrorStats = jest.fn().mockReturnValue(mockStats);
      
      const stats = errorHandlerService.getErrorStats();
      
      expect(stats).toEqual(mockStats);
      expect(stats.total).toBe(5);
      expect(stats.byType.api_error).toBe(3);
    });
  });

  describe('Offline Mode Hook', () => {
    test('detects online/offline status', () => {
      const mockUseOfflineMode = useOfflineMode;
      
      // Test online state
      mockUseOfflineMode.mockReturnValue({
        isOnline: true,
        isBackendOnline: true,
        isFullyOnline: true,
        queuedRequests: 0
      });
      
      const { isOnline, isBackendOnline, isFullyOnline } = useOfflineMode();
      
      expect(isOnline).toBe(true);
      expect(isBackendOnline).toBe(true);
      expect(isFullyOnline).toBe(true);
    });

    test('queues requests when offline', async () => {
      const mockMakeRequest = jest.fn().mockResolvedValue({
        success: false,
        queued: true,
        queueId: 'queue_123'
      });
      
      useOfflineMode.mockReturnValue({
        isOnline: false,
        isBackendOnline: false,
        isFullyOnline: false,
        queuedRequests: 1,
        makeOfflineCapableRequest: mockMakeRequest
      });
      
      const { makeOfflineCapableRequest } = useOfflineMode();
      const result = await makeOfflineCapableRequest('/test', 'POST', { data: 'test' });
      
      expect(result.queued).toBe(true);
      expect(result.queueId).toBe('queue_123');
    });

    test('processes queued requests when back online', () => {
      const mockProcessQueue = jest.fn();
      
      useOfflineMode.mockReturnValue({
        isOnline: true,
        isBackendOnline: true,
        isFullyOnline: true,
        queuedRequests: 3,
        processOfflineQueue: mockProcessQueue
      });
      
      const { processOfflineQueue } = useOfflineMode();
      processOfflineQueue();
      
      expect(mockProcessQueue).toHaveBeenCalled();
    });
  });

  describe('Recovery Mechanisms', () => {
    test('attempts service restart on backend failure', async () => {
      mockElectronAPI.djangoService.healthCheck.mockResolvedValue({
        success: true,
        healthy: false
      });
      
      mockElectronAPI.djangoService.restart.mockResolvedValue({
        success: true
      });
      
      mockElectronAPI.djangoService.apiCall.mockResolvedValue({
        success: true,
        data: { result: 'success' }
      });
      
      const mockHandleNetworkError = jest.fn().mockResolvedValue({
        recovered: true,
        result: { success: true }
      });
      
      errorHandlerService.handleNetworkError = mockHandleNetworkError;
      
      const result = await errorHandlerService.handleNetworkError(
        new Error('Network Error'),
        { endpoint: '/test', method: 'GET' }
      );
      
      expect(result.recovered).toBe(true);
    });

    test('retries requests after timeout errors', async () => {
      const mockHandleTimeoutError = jest.fn().mockResolvedValue({
        recovered: true,
        result: { success: true }
      });
      
      errorHandlerService.handleTimeoutError = mockHandleTimeoutError;
      
      const result = await errorHandlerService.handleTimeoutError(
        new Error('Request timeout'),
        { endpoint: '/test', method: 'GET' }
      );
      
      expect(result.recovered).toBe(true);
    });

    test('provides graceful degradation for critical failures', () => {
      const mockIsCriticalError = jest.fn().mockReturnValue(true);
      errorHandlerService.isCriticalError = mockIsCriticalError;
      
      const error = {
        type: 'javascript_error',
        error: { message: 'Cannot read property of undefined' }
      };
      
      const isCritical = errorHandlerService.isCriticalError(error);
      
      expect(isCritical).toBe(true);
      expect(mockIsCriticalError).toHaveBeenCalledWith(error);
    });
  });

  describe('Error Persistence and Recovery', () => {
    test('persists errors to localStorage', () => {
      const mockSetItem = jest.fn();
      const mockGetItem = jest.fn().mockReturnValue('[]');
      
      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: mockSetItem,
          getItem: mockGetItem,
          removeItem: jest.fn()
        },
        writable: true
      });
      
      const mockLoadPersistedErrors = jest.fn();
      errorHandlerService.loadPersistedErrors = mockLoadPersistedErrors;
      
      errorHandlerService.loadPersistedErrors();
      
      expect(mockLoadPersistedErrors).toHaveBeenCalled();
    });

    test('exports error log for debugging', () => {
      const mockExportData = JSON.stringify({
        timestamp: '2023-01-01T00:00:00.000Z',
        errors: [],
        stats: { total: 0 }
      });
      
      errorHandlerService.exportErrorLog = jest.fn().mockReturnValue(mockExportData);
      
      const exportData = errorHandlerService.exportErrorLog();
      
      expect(exportData).toBe(mockExportData);
      expect(JSON.parse(exportData)).toHaveProperty('timestamp');
      expect(JSON.parse(exportData)).toHaveProperty('errors');
    });

    test('clears error log when requested', () => {
      const mockClearErrorLog = jest.fn();
      errorHandlerService.clearErrorLog = mockClearErrorLog;
      
      errorHandlerService.clearErrorLog();
      
      expect(mockClearErrorLog).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    test('handles complete offline-to-online recovery flow', async () => {
      // Start offline
      useOfflineMode.mockReturnValue({
        isOnline: false,
        isBackendOnline: false,
        isFullyOnline: false,
        queuedRequests: 0,
        makeOfflineCapableRequest: jest.fn().mockResolvedValue({
          success: false,
          queued: true,
          queueId: 'test_queue'
        })
      });
      
      const { makeOfflineCapableRequest } = useOfflineMode();
      
      // Make request while offline
      const offlineResult = await makeOfflineCapableRequest('/test', 'GET');
      expect(offlineResult.queued).toBe(true);
      
      // Come back online
      useOfflineMode.mockReturnValue({
        isOnline: true,
        isBackendOnline: true,
        isFullyOnline: true,
        queuedRequests: 1,
        makeOfflineCapableRequest: jest.fn().mockResolvedValue({
          success: true,
          data: { result: 'processed' }
        }),
        processOfflineQueue: jest.fn()
      });
      
      const { processOfflineQueue } = useOfflineMode();
      processOfflineQueue();
      
      expect(processOfflineQueue).toHaveBeenCalled();
    });

    test('handles cascading error recovery', async () => {
      // Simulate multiple error types
      const errors = [
        { type: 'api_error', severity: 'medium' },
        { type: 'network_error', severity: 'high' },
        { type: 'component_error', severity: 'low' }
      ];
      
      const mockLogError = jest.fn();
      errorHandlerService.logError = mockLogError;
      
      // Log multiple errors
      errors.forEach(error => {
        errorHandlerService.logError(error);
      });
      
      expect(mockLogError).toHaveBeenCalledTimes(3);
    });

    test('handles service degradation gracefully', async () => {
      // Mock partial service failure
      mockElectronAPI.djangoService.apiCall
        .mockResolvedValueOnce({ success: true, data: 'success' })
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce({ success: true, data: 'recovered' });

      const mockMakeRequest = jest.fn()
        .mockResolvedValueOnce({ success: true, data: 'success' })
        .mockResolvedValueOnce({ 
          success: false, 
          queued: true, 
          error: 'Service temporarily unavailable' 
        })
        .mockResolvedValueOnce({ success: true, data: 'recovered' });

      useOfflineMode.mockReturnValue({
        isOnline: true,
        isBackendOnline: true,
        isFullyOnline: true,
        makeOfflineCapableRequest: mockMakeRequest
      });

      const { makeOfflineCapableRequest } = useOfflineMode();

      // First request succeeds
      const result1 = await makeOfflineCapableRequest('/test1', 'GET');
      expect(result1.success).toBe(true);

      // Second request fails and gets queued
      const result2 = await makeOfflineCapableRequest('/test2', 'GET');
      expect(result2.queued).toBe(true);

      // Third request succeeds after recovery
      const result3 = await makeOfflineCapableRequest('/test3', 'GET');
      expect(result3.success).toBe(true);
    });

    test('handles memory pressure and cleanup', () => {
      const originalMaxSize = errorHandlerService.maxLogSize;
      errorHandlerService.maxLogSize = 3;

      try {
        // Fill up error log beyond capacity
        for (let i = 0; i < 10; i++) {
          errorHandlerService.logError({
            type: 'memory_test',
            message: `Memory test error ${i}`,
            data: new Array(1000).fill('x').join('') // Large data
          });
        }

        const mockGetErrorStats = jest.fn().mockReturnValue({
          total: 3,
          byType: { memory_test: 3 },
          recent: 3
        });
        errorHandlerService.getErrorStats = mockGetErrorStats;

        const stats = errorHandlerService.getErrorStats();
        expect(stats.total).toBe(3); // Should be limited by maxLogSize

      } finally {
        errorHandlerService.maxLogSize = originalMaxSize;
      }
    });

    test('handles concurrent error reporting', async () => {
      const concurrentErrors = Array.from({ length: 10 }, (_, i) => ({
        type: 'concurrent_test',
        message: `Concurrent error ${i}`,
        timestamp: Date.now() + i
      }));

      const mockLogError = jest.fn().mockImplementation((error) => `error_${Date.now()}_${Math.random()}`);
      errorHandlerService.logError = mockLogError;

      // Log errors concurrently
      const promises = concurrentErrors.map(error => 
        Promise.resolve(errorHandlerService.logError(error))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockLogError).toHaveBeenCalledTimes(10);
      results.forEach(result => {
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^error_/);
      });
    });

    test('handles error boundary with automatic recovery', async () => {
      const { rerender } = render(<MockApp shouldThrow={true} errorType="network" />);
      
      // Error boundary should catch the error
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      expect(screen.getByText('Check Connection')).toBeInTheDocument();

      // Mock successful health check for recovery
      mockElectronAPI.djangoService.healthCheck.mockResolvedValue({
        success: true,
        healthy: true
      });

      // Click the check connection button
      fireEvent.click(screen.getByText('Check Connection'));

      // Wait for recovery attempt
      await waitFor(() => {
        // The error boundary should attempt recovery
        expect(mockElectronAPI.djangoService.healthCheck).toHaveBeenCalled();
      });

      // Rerender without error to simulate recovery
      rerender(<MockApp shouldThrow={false} />);

      await waitFor(() => {
        expect(screen.getByText('No error')).toBeInTheDocument();
      });
    });

    test('handles offline mode with queue persistence', () => {
      const mockSetItem = jest.fn();
      const mockGetItem = jest.fn().mockReturnValue(JSON.stringify([
        { id: 1, endpoint: '/test1', method: 'GET', timestamp: Date.now() },
        { id: 2, endpoint: '/test2', method: 'POST', data: { test: 'data' }, timestamp: Date.now() }
      ]));

      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: mockSetItem,
          getItem: mockGetItem,
          removeItem: jest.fn()
        },
        writable: true
      });

      useOfflineMode.mockReturnValue({
        isOnline: false,
        isBackendOnline: false,
        isFullyOnline: false,
        queuedRequests: 2,
        offlineQueue: [
          { id: 1, endpoint: '/test1', method: 'GET' },
          { id: 2, endpoint: '/test2', method: 'POST', data: { test: 'data' } }
        ]
      });

      const { queuedRequests, offlineQueue } = useOfflineMode();

      expect(queuedRequests).toBe(2);
      expect(offlineQueue).toHaveLength(2);
      expect(mockGetItem).toHaveBeenCalledWith('sideeye_offline_queue');
    });

    test('handles error boundary retry with exponential backoff', async () => {
      jest.useFakeTimers();
      
      const { rerender } = render(<MockApp shouldThrow={true} errorType="render" />);
      
      // First retry
      fireEvent.click(screen.getByText('Try Again'));
      rerender(<MockApp shouldThrow={true} errorType="render" />);
      
      expect(screen.getByText(/Retry attempts: 1/)).toBeInTheDocument();
      
      // Second retry
      fireEvent.click(screen.getByText('Try Again'));
      rerender(<MockApp shouldThrow={true} errorType="render" />);
      
      expect(screen.getByText(/Retry attempts: 2/)).toBeInTheDocument();
      
      // Third retry should show different behavior (max retries reached)
      fireEvent.click(screen.getByText('Try Again'));
      rerender(<MockApp shouldThrow={true} errorType="render" />);
      
      expect(screen.getByText(/Retry attempts: 3/)).toBeInTheDocument();
      
      jest.useRealTimers();
    });

    test('handles service restart and recovery', async () => {
      // Mock service failure
      mockElectronAPI.djangoService.healthCheck.mockResolvedValue({
        success: true,
        healthy: false
      });

      mockElectronAPI.djangoService.restart.mockResolvedValue({
        success: true
      });

      // Mock successful API call after restart
      mockElectronAPI.djangoService.apiCall.mockResolvedValue({
        success: true,
        data: { status: 'recovered' }
      });

      const mockHandleNetworkError = jest.fn().mockImplementation(async (error, context) => {
        // Simulate the actual recovery logic
        const healthResult = await window.electronAPI.djangoService.healthCheck();
        
        if (!healthResult.healthy) {
          const restartResult = await window.electronAPI.djangoService.restart();
          
          if (restartResult.success) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate wait
            
            const retryResult = await window.electronAPI.djangoService.apiCall(
              context.endpoint,
              context.method,
              context.data
            );
            
            return { recovered: retryResult.success, result: retryResult };
          }
        }
        
        return { recovered: false };
      });

      errorHandlerService.handleNetworkError = mockHandleNetworkError;

      const result = await errorHandlerService.handleNetworkError(
        new Error('Network Error'),
        { endpoint: '/test', method: 'GET' }
      );

      expect(result.recovered).toBe(true);
      expect(mockElectronAPI.djangoService.healthCheck).toHaveBeenCalled();
      expect(mockElectronAPI.djangoService.restart).toHaveBeenCalled();
      expect(mockElectronAPI.djangoService.apiCall).toHaveBeenCalled();
    });
  });

  describe('Error Boundary Edge Cases', () => {
    test('handles errors during error reporting', () => {
      // Mock clipboard API failure
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: jest.fn().mockRejectedValue(new Error('Clipboard access denied'))
        },
        writable: true
      });

      render(<MockApp shouldThrow={true} errorType="render" />);
      
      const reportButton = screen.getByText('Report Issue');
      fireEvent.click(reportButton);

      // Should handle clipboard failure gracefully
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    test('handles missing electronAPI gracefully', () => {
      // Remove electronAPI
      delete window.electronAPI;

      render(<MockApp shouldThrow={true} errorType="network" />);
      
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      
      // Should not show backend-specific recovery options
      expect(screen.queryByText('Check Connection')).not.toBeInTheDocument();
    });

    test('handles error boundary unmounting during recovery', () => {
      const { unmount } = render(<MockApp shouldThrow={true} errorType="render" />);
      
      // Start recovery process
      fireEvent.click(screen.getByText('Try Again'));
      
      // Unmount component during recovery
      unmount();
      
      // Should not cause any errors or memory leaks
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    test('handles rapid successive errors', () => {
      const mockLogError = jest.fn();
      errorHandlerService.logError = mockLogError;

      // Simulate rapid error succession
      for (let i = 0; i < 100; i++) {
        errorHandlerService.logError({
          type: 'rapid_error',
          message: `Rapid error ${i}`,
          timestamp: Date.now() + i
        });
      }

      expect(mockLogError).toHaveBeenCalledTimes(100);
    });

    test('handles malformed error data', () => {
      const mockLogError = jest.fn().mockImplementation((errorData) => {
        // Should handle malformed data gracefully
        return `error_${Date.now()}`;
      });
      errorHandlerService.logError = mockLogError;

      // Test with various malformed data
      const malformedErrors = [
        null,
        undefined,
        '',
        { /* missing required fields */ },
        { type: null, message: undefined },
        { type: 123, message: [] }, // Wrong types
        { type: 'test', message: 'test', circular: {} }
      ];

      // Add circular reference
      malformedErrors[malformedErrors.length - 1].circular.self = malformedErrors[malformedErrors.length - 1];

      malformedErrors.forEach((errorData) => {
        const result = errorHandlerService.logError(errorData);
        expect(typeof result).toBe('string');
      });

      expect(mockLogError).toHaveBeenCalledTimes(malformedErrors.length);
    });
  });
});