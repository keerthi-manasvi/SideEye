import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ServiceStatus from '../ServiceStatus';

// Mock the Electron API
const mockElectronAPI = {
  djangoService: {
    getStatus: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    restart: jest.fn(),
    healthCheck: jest.fn(),
    onStatusUpdate: jest.fn(),
    removeStatusListener: jest.fn()
  }
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

describe('ServiceStatus Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockServiceStatus = {
    isRunning: true,
    isStarting: false,
    isStopping: false,
    restartAttempts: 0,
    lastHealthCheck: {
      timestamp: Date.now(),
      healthy: true
    },
    pid: 12345,
    uptime: 60000
  };

  test('renders service status component', () => {
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: mockServiceStatus
    });

    render(<ServiceStatus />);

    expect(screen.getByText('Django Service Status')).toBeInTheDocument();
    expect(screen.getByText('Start Service')).toBeInTheDocument();
    expect(screen.getByText('Stop Service')).toBeInTheDocument();
    expect(screen.getByText('Restart Service')).toBeInTheDocument();
    expect(screen.getByText('Health Check')).toBeInTheDocument();
  });

  test('displays service status information correctly', async () => {
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: mockServiceStatus
    });

    render(<ServiceStatus />);

    await waitFor(() => {
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('12345')).toBeInTheDocument();
      expect(screen.getByText('1m 0s')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  test('handles service start action', async () => {
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: { ...mockServiceStatus, isRunning: false }
    });
    mockElectronAPI.djangoService.start.mockResolvedValue({ success: true });

    render(<ServiceStatus />);

    const startButton = screen.getByText('Start Service');
    fireEvent.click(startButton);

    expect(mockElectronAPI.djangoService.start).toHaveBeenCalled();
    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });

  test('handles service stop action', async () => {
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: mockServiceStatus
    });
    mockElectronAPI.djangoService.stop.mockResolvedValue({ success: true });

    render(<ServiceStatus />);

    await waitFor(() => {
      const stopButton = screen.getByText('Stop Service');
      fireEvent.click(stopButton);
    });

    expect(mockElectronAPI.djangoService.stop).toHaveBeenCalled();
  });

  test('handles service restart action', async () => {
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: mockServiceStatus
    });
    mockElectronAPI.djangoService.restart.mockResolvedValue({ success: true });

    render(<ServiceStatus />);

    await waitFor(() => {
      const restartButton = screen.getByText('Restart Service');
      fireEvent.click(restartButton);
    });

    expect(mockElectronAPI.djangoService.restart).toHaveBeenCalled();
  });

  test('handles health check action', async () => {
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: mockServiceStatus
    });
    mockElectronAPI.djangoService.healthCheck.mockResolvedValue({
      success: true,
      healthy: true
    });

    render(<ServiceStatus />);

    await waitFor(() => {
      const healthButton = screen.getByText('Health Check');
      fireEvent.click(healthButton);
    });

    expect(mockElectronAPI.djangoService.healthCheck).toHaveBeenCalled();
  });

  test('displays error messages correctly', async () => {
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: false,
      error: 'Service connection failed'
    });

    render(<ServiceStatus />);

    await waitFor(() => {
      expect(screen.getByText('Error: Service connection failed')).toBeInTheDocument();
    });
  });

  test('handles API unavailable scenario', async () => {
    // Remove the electronAPI to simulate unavailable API
    delete window.electronAPI;

    render(<ServiceStatus />);

    await waitFor(() => {
      expect(screen.getByText('Error: Django service API not available')).toBeInTheDocument();
    });

    // Restore the API
    window.electronAPI = mockElectronAPI;
  });

  test('disables buttons appropriately based on service state', async () => {
    // Test with service stopped
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: { ...mockServiceStatus, isRunning: false }
    });

    render(<ServiceStatus />);

    await waitFor(() => {
      expect(screen.getByText('Start Service')).not.toBeDisabled();
      expect(screen.getByText('Stop Service')).toBeDisabled();
      expect(screen.getByText('Health Check')).toBeDisabled();
    });
  });

  test('disables buttons when service is starting', async () => {
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: { ...mockServiceStatus, isStarting: true, isRunning: false }
    });

    render(<ServiceStatus />);

    await waitFor(() => {
      expect(screen.getByText('Start Service')).toBeDisabled();
      expect(screen.getByText('Stop Service')).toBeDisabled();
      expect(screen.getByText('Restart Service')).toBeDisabled();
    });
  });

  test('formats uptime correctly', async () => {
    const testCases = [
      { uptime: 5000, expected: '5s' },
      { uptime: 65000, expected: '1m 5s' },
      { uptime: 3665000, expected: '1h 1m 5s' },
      { uptime: 0, expected: 'N/A' }
    ];

    for (const testCase of testCases) {
      mockElectronAPI.djangoService.getStatus.mockResolvedValue({
        success: true,
        status: { ...mockServiceStatus, uptime: testCase.uptime }
      });

      const { rerender } = render(<ServiceStatus />);

      await waitFor(() => {
        expect(screen.getByText(testCase.expected)).toBeInTheDocument();
      });

      rerender(<div />); // Clear the component
    }
  });

  test('sets up and cleans up status update listener', () => {
    const { unmount } = render(<ServiceStatus />);

    expect(mockElectronAPI.djangoService.onStatusUpdate).toHaveBeenCalled();

    unmount();

    expect(mockElectronAPI.djangoService.removeStatusListener).toHaveBeenCalled();
  });

  test('handles status update events', async () => {
    let statusUpdateCallback;
    mockElectronAPI.djangoService.onStatusUpdate.mockImplementation((callback) => {
      statusUpdateCallback = callback;
    });

    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: mockServiceStatus
    });

    render(<ServiceStatus />);

    // Simulate status update event
    statusUpdateCallback({ status: 'started' });

    await waitFor(() => {
      expect(screen.getByText('Service status: started')).toBeInTheDocument();
    });
  });

  test('handles status update with error', async () => {
    let statusUpdateCallback;
    mockElectronAPI.djangoService.onStatusUpdate.mockImplementation((callback) => {
      statusUpdateCallback = callback;
    });

    render(<ServiceStatus />);

    // Simulate error status update
    statusUpdateCallback({ status: 'error', error: 'Connection failed' });

    await waitFor(() => {
      expect(screen.getByText('Service status: error')).toBeInTheDocument();
      expect(screen.getByText('Error: Connection failed')).toBeInTheDocument();
    });
  });

  test('periodic status checks work correctly', async () => {
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: mockServiceStatus
    });

    render(<ServiceStatus />);

    // Fast-forward time to trigger periodic check
    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockElectronAPI.djangoService.getStatus).toHaveBeenCalledTimes(2); // Initial + periodic
    });
  });

  test('handles service action errors gracefully', async () => {
    mockElectronAPI.djangoService.getStatus.mockResolvedValue({
      success: true,
      status: { ...mockServiceStatus, isRunning: false }
    });
    mockElectronAPI.djangoService.start.mockResolvedValue({
      success: false,
      error: 'Failed to start service'
    });

    render(<ServiceStatus />);

    const startButton = screen.getByText('Start Service');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Error: Failed to start service')).toBeInTheDocument();
    });
  });

  test('shows correct status colors', async () => {
    const testCases = [
      { status: { isRunning: true }, expectedClass: 'green' },
      { status: { isRunning: false, isStarting: true }, expectedClass: 'orange' },
      { status: { isRunning: false, isStopping: true }, expectedClass: 'orange' },
      { status: { isRunning: false }, expectedClass: 'red' }
    ];

    for (const testCase of testCases) {
      mockElectronAPI.djangoService.getStatus.mockResolvedValue({
        success: true,
        status: { ...mockServiceStatus, ...testCase.status }
      });

      const { container, rerender } = render(<ServiceStatus />);

      await waitFor(() => {
        const statusIndicator = container.querySelector('.status-indicator');
        expect(statusIndicator).toHaveClass(testCase.expectedClass);
      });

      rerender(<div />); // Clear the component
    }
  });
});