import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrivacyControls from '../PrivacyControls';

// Mock fetch globally
global.fetch = jest.fn();

// Mock URL.createObjectURL and related APIs
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock document.createElement and related DOM APIs
const mockLink = {
  href: '',
  download: '',
  click: jest.fn(),
};
document.createElement = jest.fn((tagName) => {
  if (tagName === 'a') {
    return mockLink;
  }
  return {};
});
document.body.appendChild = jest.fn();
document.body.removeChild = jest.fn();

// Mock alert
global.alert = jest.fn();

describe('PrivacyControls', () => {
  beforeEach(() => {
    fetch.mockClear();
    global.alert.mockClear();
    mockLink.click.mockClear();
  });

  const mockDataSummary = {
    data_counts: {
      emotion_readings: 150,
      tasks: 25,
      user_feedback: 30,
      music_recommendations: 45,
      user_preferences: 1,
      youtube_playlists: 10
    },
    privacy_settings: {
      encryption_enabled: true,
      retention_policy_days: 90,
      local_processing_only: true
    }
  };

  const mockEncryptionStatus = {
    encryption_enabled: true,
    local_processing_only: true,
    data_location: 'Local SQLite database',
    privacy_compliance: {
      no_cloud_processing: true,
      no_external_transmission: true,
      user_controlled_deletion: true,
      data_portability: true
    }
  };

  const mockRetentionPolicy = {
    retention_days: 90,
    description: 'Data is automatically deleted after 90 days'
  };

  const setupMockResponses = () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDataSummary)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEncryptionStatus)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRetentionPolicy)
      });
  };

  test('renders privacy controls with loading state', () => {
    fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<PrivacyControls />);
    
    expect(screen.getByText('Loading privacy controls...')).toBeInTheDocument();
  });

  test('loads and displays privacy data on mount', async () => {
    setupMockResponses();
    
    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Check data summary
    expect(screen.getByText('150')).toBeInTheDocument(); // Emotion readings
    expect(screen.getByText('25')).toBeInTheDocument(); // Tasks
    expect(screen.getByText('30')).toBeInTheDocument(); // Feedback entries
    expect(screen.getByText('45')).toBeInTheDocument(); // Music recommendations

    // Check privacy status
    expect(screen.getByText('Enabled')).toBeInTheDocument(); // Encryption status
    expect(screen.getByText('Local SQLite database')).toBeInTheDocument();

    // Check retention policy
    expect(screen.getByText(/Data is automatically deleted after 90 days/)).toBeInTheDocument();
  });

  test('handles export data functionality', async () => {
    setupMockResponses();
    
    const mockExportData = {
      export_timestamp: '2024-01-01T00:00:00Z',
      data: { tasks: [], emotions: [] },
      summary: { total_records: 100 }
    };

    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Mock export response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockExportData)
    });

    const exportButton = screen.getByText('Export All Data (Including Emotions)');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/privacy/export_data/?include_emotions=true');
    });

    expect(mockLink.download).toBe('sideeye-data-export-2024-01-01.json');
    expect(mockLink.click).toHaveBeenCalled();
  });

  test('handles export data without emotions', async () => {
    setupMockResponses();
    
    const mockExportData = {
      export_timestamp: '2024-01-01T00:00:00Z',
      data: { tasks: [] },
      summary: { total_records: 50 }
    };

    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Mock export response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockExportData)
    });

    const exportButton = screen.getByText('Export Data (Excluding Raw Emotions)');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/privacy/export_data/?include_emotions=false');
    });
  });

  test('handles retention policy update', async () => {
    setupMockResponses();
    
    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Change retention days
    const retentionInput = screen.getByLabelText('Retention Period (days):');
    fireEvent.change(retentionInput, { target: { value: '60' } });

    // Mock update response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Success' })
    });

    const updateButton = screen.getByText('Update Policy');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/privacy/set_retention_policy/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retention_days: 60 })
      });
    });

    expect(global.alert).toHaveBeenCalledWith('Retention policy updated successfully');
  });

  test('handles apply retention policy', async () => {
    setupMockResponses();
    
    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Mock apply response
    const mockApplyResult = {
      message: 'Success',
      deleted_counts: { emotion_readings: 10, tasks: 5 }
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApplyResult)
    });

    const applyButton = screen.getByText('Apply Retention Policy Now');
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/privacy/apply_retention_policy/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retention_days: 90 })
      });
    });

    expect(global.alert).toHaveBeenCalledWith(
      'Retention policy applied successfully. Deleted: {"emotion_readings":10,"tasks":5}'
    );
  });

  test('handles cleanup orphaned data', async () => {
    setupMockResponses();
    
    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Mock cleanup response
    const mockCleanupResult = {
      message: 'Success',
      cleanup_counts: { orphaned_recommendations: 3, invalid_emotions: 1 }
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCleanupResult)
    });

    const cleanupButton = screen.getByText('Cleanup Orphaned Data');
    fireEvent.click(cleanupButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/privacy/cleanup_orphaned_data/', {
        method: 'POST'
      });
    });

    expect(global.alert).toHaveBeenCalledWith(
      'Cleanup completed. Cleaned: {"orphaned_recommendations":3,"invalid_emotions":1}'
    );
  });

  test('handles data integrity validation', async () => {
    setupMockResponses();
    
    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Mock integrity response
    const mockIntegrityReport = {
      checks_passed: 5,
      checks_failed: 1,
      issues: ['Found 2 invalid emotion readings'],
      recommendations: ['Run cleanup to fix issues']
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockIntegrityReport)
    });

    const validateButton = screen.getByText('Validate Data Integrity');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/privacy/validate_integrity/');
    });

    expect(global.alert).toHaveBeenCalledWith(
      expect.stringContaining('Integrity Check Results:')
    );
  });

  test('handles delete all data with confirmation', async () => {
    setupMockResponses();
    
    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByText('Delete All Data');
    fireEvent.click(deleteButton);

    // Should show confirmation
    expect(screen.getByText('Type "DELETE_ALL_DATA" to confirm permanent deletion:')).toBeInTheDocument();

    // Type confirmation
    const confirmationInput = screen.getByPlaceholderText('DELETE_ALL_DATA');
    fireEvent.change(confirmationInput, { target: { value: 'DELETE_ALL_DATA' } });

    // Mock delete response
    const mockDeleteResult = {
      message: 'Success',
      deleted_counts: { emotion_readings: 150, tasks: 25 }
    };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDeleteResult)
    });

    const confirmButton = screen.getByText('Confirm Delete All');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/privacy/secure_delete_all/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE_ALL_DATA' })
      });
    });

    expect(global.alert).toHaveBeenCalledWith(
      'All data deleted successfully. Counts: {"emotion_readings":150,"tasks":25}'
    );
  });

  test('prevents delete all data without proper confirmation', async () => {
    setupMockResponses();
    
    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByText('Delete All Data');
    fireEvent.click(deleteButton);

    // Type wrong confirmation
    const confirmationInput = screen.getByPlaceholderText('DELETE_ALL_DATA');
    fireEvent.change(confirmationInput, { target: { value: 'wrong' } });

    const confirmButton = screen.getByText('Confirm Delete All');
    fireEvent.click(confirmButton);

    // Should show error
    await waitFor(() => {
      expect(screen.getByText('Please type "DELETE_ALL_DATA" to confirm')).toBeInTheDocument();
    });

    expect(fetch).not.toHaveBeenCalledWith('/api/privacy/secure_delete_all/', expect.any(Object));
  });

  test('handles API errors gracefully', async () => {
    // Mock failed responses
    fetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));
    
    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load privacy data: Network error')).toBeInTheDocument();
    });
  });

  test('shows loading overlay during operations', async () => {
    setupMockResponses();
    
    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Mock slow response
    fetch.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' })
      }), 100);
    }));

    const cleanupButton = screen.getByText('Cleanup Orphaned Data');
    fireEvent.click(cleanupButton);

    // Should show loading overlay
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  test('cancels delete confirmation', async () => {
    setupMockResponses();
    
    render(<PrivacyControls />);
    
    await waitFor(() => {
      expect(screen.getByText('Privacy & Data Controls')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByText('Delete All Data');
    fireEvent.click(deleteButton);

    // Should show confirmation
    expect(screen.getByText('Type "DELETE_ALL_DATA" to confirm permanent deletion:')).toBeInTheDocument();

    // Click cancel
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Should hide confirmation
    expect(screen.queryByText('Type "DELETE_ALL_DATA" to confirm permanent deletion:')).not.toBeInTheDocument();
    expect(screen.getByText('Delete All Data')).toBeInTheDocument();
  });
});