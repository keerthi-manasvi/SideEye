import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPanel from '../SettingsPanel';

// Mock window.electronAPI
const mockElectronAPI = {
  callDjangoAPI: jest.fn()
};

// Mock window.confirm
global.confirm = jest.fn();

// Mock URL.createObjectURL and related APIs
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('SettingsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.callDjangoAPI.mockResolvedValue({ success: true, data: {} });
    window.electronAPI = mockElectronAPI;
    global.confirm.mockReturnValue(true);
    
    // Mock localStorage
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
  });

  afterEach(() => {
    delete window.electronAPI;
    jest.restoreAllMocks();
  });

  test('renders settings panel with loading state initially', () => {
    render(<SettingsPanel />);
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Loading your preferences...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('loads and displays settings after initial load', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Configure your SideEye workspace preferences')).toBeInTheDocument();
      expect(screen.getByText('Music Preferences')).toBeInTheDocument();
      expect(screen.getByText('Theme Preferences')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Privacy & Data')).toBeInTheDocument();
    });
  });

  test('loads settings from Django API', async () => {
    const mockSettings = {
      musicEnabled: false,
      preferredGenres: ['jazz', 'classical'],
      notificationFrequency: 10
    };
    
    mockElectronAPI.callDjangoAPI.mockResolvedValue({ 
      success: true, 
      data: mockSettings 
    });
    
    render(<SettingsPanel />);
    
    await waitFor(() => {
      expect(mockElectronAPI.callDjangoAPI).toHaveBeenCalledWith('/preferences/', 'GET');
    });
    
    await waitFor(() => {
      const musicCheckbox = screen.getByLabelText(/Enable automatic music suggestions/);
      expect(musicCheckbox).not.toBeChecked();
      
      const frequencyInput = screen.getByLabelText(/Notification Frequency/);
      expect(frequencyInput).toHaveValue(10);
    });
  });

  test('loads settings from localStorage in browser mode', async () => {
    delete window.electronAPI;
    
    const mockSettings = {
      musicEnabled: false,
      preferredGenres: ['rock', 'pop']
    };
    
    Storage.prototype.getItem.mockReturnValue(JSON.stringify(mockSettings));
    
    render(<SettingsPanel />);
    
    await waitFor(() => {
      expect(localStorage.getItem).toHaveBeenCalledWith('sideeyeSettings');
    });
  });

  test('handles music preferences toggle', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const musicCheckbox = screen.getByLabelText(/Enable automatic music suggestions/);
      expect(musicCheckbox).toBeChecked(); // default is true
    });
    
    const musicCheckbox = screen.getByLabelText(/Enable automatic music suggestions/);
    fireEvent.click(musicCheckbox);
    
    expect(musicCheckbox).not.toBeChecked();
  });

  test('handles genre tag selection', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const jazzTag = screen.getByText('jazz');
      expect(jazzTag).toBeInTheDocument();
    });
    
    const jazzTag = screen.getByText('jazz');
    fireEvent.click(jazzTag);
    
    expect(jazzTag).toHaveClass('selected');
    expect(jazzTag).toHaveAttribute('aria-pressed', 'true');
  });

  test('handles custom genre input', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const customInput = screen.getByPlaceholderText('Add custom genres...');
      expect(customInput).toBeInTheDocument();
    });
    
    const customInput = screen.getByPlaceholderText('Add custom genres...');
    await user.type(customInput, 'synthwave, lo-fi');
    
    expect(customInput).toHaveValue('synthwave, lo-fi');
  });

  test('handles energy level music mappings', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const highEnergyInput = screen.getByPlaceholderText('Genres for high energy...');
      expect(highEnergyInput).toBeInTheDocument();
    });
    
    const highEnergyInput = screen.getByPlaceholderText('Genres for high energy...');
    await user.clear(highEnergyInput);
    await user.type(highEnergyInput, 'metal, punk, hardcore');
    
    expect(highEnergyInput).toHaveValue('metal, punk, hardcore');
  });

  test('handles theme preferences toggle', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const themeCheckbox = screen.getByLabelText(/Enable automatic theme changes/);
      expect(themeCheckbox).toBeChecked(); // default is true
    });
    
    const themeCheckbox = screen.getByLabelText(/Enable automatic theme changes/);
    fireEvent.click(themeCheckbox);
    
    expect(themeCheckbox).not.toBeChecked();
  });

  test('handles theme tag selection', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const darkTag = screen.getByText('dark');
      expect(darkTag).toBeInTheDocument();
    });
    
    const darkTag = screen.getByText('dark');
    fireEvent.click(darkTag);
    
    expect(darkTag).toHaveClass('selected');
    expect(darkTag).toHaveAttribute('aria-pressed', 'true');
  });

  test('handles emotion theme mappings', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const happyInput = screen.getByPlaceholderText('Themes for happy emotion...');
      expect(happyInput).toBeInTheDocument();
    });
    
    const happyInput = screen.getByPlaceholderText('Themes for happy emotion...');
    await user.clear(happyInput);
    await user.type(happyInput, 'rainbow, vibrant, sunny');
    
    expect(happyInput).toHaveValue('rainbow, vibrant, sunny');
  });

  test('handles notification settings', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const frequencyInput = screen.getByLabelText(/Notification Frequency/);
      const maxNotificationsInput = screen.getByLabelText(/Max Notifications per Hour/);
      const wellnessCheckbox = screen.getByLabelText(/Enable wellness reminders/);
      const toneSelect = screen.getByLabelText(/Notification Tone/);
      
      expect(frequencyInput).toBeInTheDocument();
      expect(maxNotificationsInput).toBeInTheDocument();
      expect(wellnessCheckbox).toBeInTheDocument();
      expect(toneSelect).toBeInTheDocument();
    });
    
    const frequencyInput = screen.getByLabelText(/Notification Frequency/);
    await user.clear(frequencyInput);
    await user.type(frequencyInput, '15');
    
    expect(frequencyInput).toHaveValue(15);
  });

  test('handles notification tone selection', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const toneSelect = screen.getByLabelText(/Notification Tone/);
      expect(toneSelect).toHaveValue('balanced');
    });
    
    const toneSelect = screen.getByLabelText(/Notification Tone/);
    await user.selectOptions(toneSelect, 'sarcastic');
    
    expect(toneSelect).toHaveValue('sarcastic');
  });

  test('handles privacy settings', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const cameraCheckbox = screen.getByLabelText(/Enable camera access/);
      const retentionInput = screen.getByLabelText(/Data Retention/);
      const exportCheckbox = screen.getByLabelText(/Enable data export/);
      
      expect(cameraCheckbox).toBeInTheDocument();
      expect(retentionInput).toBeInTheDocument();
      expect(exportCheckbox).toBeInTheDocument();
    });
    
    const retentionInput = screen.getByLabelText(/Data Retention/);
    await user.clear(retentionInput);
    await user.type(retentionInput, '60');
    
    expect(retentionInput).toHaveValue(60);
  });

  test('saves settings successfully', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).toBeInTheDocument();
    });
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    expect(saveButton).toHaveTextContent('Saving...');
    expect(saveButton).toBeDisabled();
    
    await waitFor(() => {
      expect(mockElectronAPI.callDjangoAPI).toHaveBeenCalledWith(
        '/preferences/',
        'POST',
        expect.any(Object)
      );
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
    });
  });

  test('handles save error', async () => {
    mockElectronAPI.callDjangoAPI.mockResolvedValue({ success: false });
    
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).toBeInTheDocument();
    });
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to save settings. Please try again.')).toBeInTheDocument();
    });
  });

  test('saves settings to localStorage in browser mode', async () => {
    delete window.electronAPI;
    
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).toBeInTheDocument();
    });
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'sideeyeSettings',
        expect.any(String)
      );
      expect(screen.getByText('Settings saved locally!')).toBeInTheDocument();
    });
  });

  test('resets settings to defaults', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const resetButton = screen.getByText('Reset to Defaults');
      expect(resetButton).toBeInTheDocument();
    });
    
    // First change a setting
    const musicCheckbox = screen.getByLabelText(/Enable automatic music suggestions/);
    fireEvent.click(musicCheckbox);
    expect(musicCheckbox).not.toBeChecked();
    
    // Then reset
    const resetButton = screen.getByText('Reset to Defaults');
    fireEvent.click(resetButton);
    
    expect(global.confirm).toHaveBeenCalledWith(
      'Are you sure you want to reset all settings to defaults? This cannot be undone.'
    );
    
    // Settings should be back to defaults
    expect(musicCheckbox).toBeChecked();
  });

  test('cancels reset when user declines confirmation', async () => {
    global.confirm.mockReturnValue(false);
    
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const resetButton = screen.getByText('Reset to Defaults');
      expect(resetButton).toBeInTheDocument();
    });
    
    // Change a setting
    const musicCheckbox = screen.getByLabelText(/Enable automatic music suggestions/);
    fireEvent.click(musicCheckbox);
    expect(musicCheckbox).not.toBeChecked();
    
    // Try to reset
    const resetButton = screen.getByText('Reset to Defaults');
    fireEvent.click(resetButton);
    
    // Setting should remain changed
    expect(musicCheckbox).not.toBeChecked();
  });

  test('exports data successfully', async () => {
    // Mock document.createElement and related DOM methods
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn()
    };
    
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const exportButton = screen.getByText('Export My Data');
      expect(exportButton).toBeInTheDocument();
    });
    
    const exportButton = screen.getByText('Export My Data');
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(mockLink.click).toHaveBeenCalled();
      expect(screen.getByText('Data exported successfully!')).toBeInTheDocument();
    });
  });

  test('handles export error', async () => {
    // Mock document.createElement to throw an error
    jest.spyOn(document, 'createElement').mockImplementation(() => {
      throw new Error('Export failed');
    });
    
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const exportButton = screen.getByText('Export My Data');
      expect(exportButton).toBeInTheDocument();
    });
    
    const exportButton = screen.getByText('Export My Data');
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(screen.getByText('Error exporting data. Please try again.')).toBeInTheDocument();
    });
  });

  test('disables export button when data export is disabled', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const exportCheckbox = screen.getByLabelText(/Enable data export/);
      const exportButton = screen.getByText('Export My Data');
      
      expect(exportCheckbox).toBeChecked();
      expect(exportButton).not.toBeDisabled();
    });
    
    const exportCheckbox = screen.getByLabelText(/Enable data export/);
    fireEvent.click(exportCheckbox);
    
    const exportButton = screen.getByText('Export My Data');
    expect(exportButton).toBeDisabled();
  });

  test('clears save status when settings change', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).toBeInTheDocument();
    });
    
    // Save settings to show status
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
    });
    
    // Change a setting
    const musicCheckbox = screen.getByLabelText(/Enable automatic music suggestions/);
    fireEvent.click(musicCheckbox);
    
    // Status should be cleared
    expect(screen.queryByText('Settings saved successfully!')).not.toBeInTheDocument();
  });

  test('handles genre deselection', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const jazzTag = screen.getByText('jazz');
      expect(jazzTag).toBeInTheDocument();
    });
    
    const jazzTag = screen.getByText('jazz');
    
    // Select jazz
    fireEvent.click(jazzTag);
    expect(jazzTag).toHaveClass('selected');
    
    // Deselect jazz
    fireEvent.click(jazzTag);
    expect(jazzTag).not.toHaveClass('selected');
  });

  test('handles theme deselection', async () => {
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const darkTag = screen.getByText('dark');
      expect(darkTag).toBeInTheDocument();
    });
    
    const darkTag = screen.getByText('dark');
    
    // Select dark
    fireEvent.click(darkTag);
    expect(darkTag).toHaveClass('selected');
    
    // Deselect dark
    fireEvent.click(darkTag);
    expect(darkTag).not.toHaveClass('selected');
  });

  test('disables form elements while saving', async () => {
    // Mock a slow save operation
    mockElectronAPI.callDjangoAPI.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    );
    
    render(<SettingsPanel />);
    
    await waitFor(() => {
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).toBeInTheDocument();
    });
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    // Check that form elements are disabled
    const musicCheckbox = screen.getByLabelText(/Enable automatic music suggestions/);
    const jazzTag = screen.getByText('jazz');
    const resetButton = screen.getByText('Reset to Defaults');
    
    expect(musicCheckbox).toBeDisabled();
    expect(jazzTag).toBeDisabled();
    expect(resetButton).toBeDisabled();
    expect(saveButton).toBeDisabled();
  });
});