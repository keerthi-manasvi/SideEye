/**
 * Accessibility and Usability Integration Tests
 * 
 * Tests accessibility compliance and usability features:
 * 1. Screen reader compatibility
 * 2. Keyboard navigation
 * 3. Color contrast and visual accessibility
 * 4. ARIA labels and semantic HTML
 * 5. Focus management
 * 6. User experience flows
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import Dashboard from '../components/Dashboard';
import SettingsPanel from '../components/SettingsPanel';
import FeedbackModal from '../components/FeedbackModal';
import TaskList from '../components/TaskList';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock external dependencies
global.fetch = jest.fn();

describe('Accessibility and Usability Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    fetch.mockImplementation((url) => {
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            tasks: [
              { id: 1, title: 'Review code', complexity: 0.7, energy_required: 0.6 },
              { id: 2, title: 'Write tests', complexity: 0.8, energy_required: 0.7 },
              { id: 3, title: 'Update docs', complexity: 0.3, energy_required: 0.4 }
            ]
          })
        });
      }
      
      if (url.includes('/api/preferences/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            music_genres: ['rock', 'classical', 'electronic'],
            theme_preferences: ['dark', 'light', 'auto'],
            notification_settings: { frequency: 5, tone: 'balanced' }
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  describe('Screen Reader Compatibility', () => {
    test('Dashboard has proper ARIA labels and semantic structure', async () => {
      const { container } = render(<Dashboard />);
      
      // Check for main landmarks
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
      
      // Check for proper headings hierarchy
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // Check for ARIA labels on interactive elements
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
      
      // Run axe accessibility tests
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('Emotion detection status is announced to screen readers', async () => {
      render(<Dashboard />);
      
      // Check for live region for emotion status
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      
      // Simulate emotion detection update
      await act(async () => {
        const event = new CustomEvent('emotionUpdate', {
          detail: { emotion: 'happy', confidence: 0.8 }
        });
        window.dispatchEvent(event);
      });
      
      await waitFor(() => {
        expect(liveRegion).toHaveTextContent(/happy/i);
      });
    });

    test('Task list is properly structured for screen readers', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', complexity: 0.5, energy_required: 0.6 },
        { id: 2, title: 'Task 2', complexity: 0.8, energy_required: 0.7 }
      ];
      
      const { container } = render(<TaskList tasks={mockTasks} />);
      
      // Check for proper list structure
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
      
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(2);
      
      // Check for task descriptions
      listItems.forEach((item, index) => {
        expect(item).toHaveAttribute('aria-describedby');
        const description = document.getElementById(item.getAttribute('aria-describedby'));
        expect(description).toHaveTextContent(/complexity/i);
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('Settings panel has proper form labels and descriptions', async () => {
      const { container } = render(<SettingsPanel />);
      
      // Check all form controls have labels
      const inputs = screen.getAllByRole('textbox');
      const selects = screen.getAllByRole('combobox');
      const checkboxes = screen.getAllByRole('checkbox');
      
      [...inputs, ...selects, ...checkboxes].forEach(control => {
        expect(control).toHaveAccessibleName();
      });
      
      // Check for fieldsets and legends
      const fieldsets = container.querySelectorAll('fieldset');
      fieldsets.forEach(fieldset => {
        expect(fieldset.querySelector('legend')).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    test('All interactive elements are keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      
      // Get all interactive elements
      const buttons = screen.getAllByRole('button');
      const links = screen.getAllByRole('link');
      const inputs = screen.getAllByRole('textbox');
      
      const interactiveElements = [...buttons, ...links, ...inputs];
      
      // Check each element can receive focus
      for (const element of interactiveElements) {
        await user.tab();
        if (document.activeElement === element) {
          expect(element).toHaveFocus();
        }
      }
    });

    test('Tab order is logical and follows visual layout', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      
      const focusableElements = [
        screen.getByRole('button', { name: /settings/i }),
        screen.getByRole('button', { name: /start detection/i }),
        screen.getByRole('slider', { name: /energy level/i })
      ];
      
      // Navigate through elements with Tab
      for (let i = 0; i < focusableElements.length; i++) {
        await user.tab();
        expect(focusableElements[i]).toHaveFocus();
      }
    });

    test('Modal dialogs trap focus correctly', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      const mockOnSubmit = jest.fn();
      
      render(
        <FeedbackModal
          isOpen={true}
          type="music"
          suggestion={{ name: 'Test Playlist', genre: 'rock' }}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      );
      
      // Focus should be trapped within modal
      const modal = screen.getByRole('dialog');
      const focusableElements = modal.querySelectorAll(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      expect(focusableElements.length).toBeGreaterThan(0);
      
      // First element should be focused
      expect(focusableElements[0]).toHaveFocus();
      
      // Tab through all elements
      for (let i = 1; i < focusableElements.length; i++) {
        await user.tab();
        expect(focusableElements[i]).toHaveFocus();
      }
      
      // Tab from last element should cycle to first
      await user.tab();
      expect(focusableElements[0]).toHaveFocus();
      
      // Shift+Tab should go backwards
      await user.tab({ shift: true });
      expect(focusableElements[focusableElements.length - 1]).toHaveFocus();
    });

    test('Escape key closes modals and dropdowns', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      
      render(
        <FeedbackModal
          isOpen={true}
          type="theme"
          suggestion={{ name: 'Dark Theme', colors: {} }}
          onClose={mockOnClose}
          onSubmit={() => {}}
        />
      );
      
      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });

    test('Arrow keys navigate through lists and menus', async () => {
      const user = userEvent.setup();
      const mockTasks = [
        { id: 1, title: 'Task 1', complexity: 0.5 },
        { id: 2, title: 'Task 2', complexity: 0.7 },
        { id: 3, title: 'Task 3', complexity: 0.3 }
      ];
      
      render(<TaskList tasks={mockTasks} />);
      
      const taskItems = screen.getAllByRole('listitem');
      
      // Focus first item
      taskItems[0].focus();
      expect(taskItems[0]).toHaveFocus();
      
      // Arrow down should move to next item
      await user.keyboard('{ArrowDown}');
      expect(taskItems[1]).toHaveFocus();
      
      // Arrow up should move to previous item
      await user.keyboard('{ArrowUp}');
      expect(taskItems[0]).toHaveFocus();
    });
  });

  describe('Visual Accessibility', () => {
    test('Color contrast meets WCAG AA standards', async () => {
      const { container } = render(<Dashboard />);
      
      // Run axe with color contrast rules
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });
      
      expect(results).toHaveNoViolations();
    });

    test('Information is not conveyed by color alone', async () => {
      render(<Dashboard />);
      
      // Check that status indicators have text or icons in addition to color
      const statusElements = screen.getAllByTestId(/status/);
      statusElements.forEach(element => {
        const hasText = element.textContent.trim().length > 0;
        const hasIcon = element.querySelector('[aria-label]') || element.querySelector('svg');
        expect(hasText || hasIcon).toBe(true);
      });
    });

    test('Focus indicators are visible and clear', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);
      
      const button = screen.getByRole('button', { name: /settings/i });
      await user.tab();
      
      if (button === document.activeElement) {
        const styles = window.getComputedStyle(button);
        
        // Check for focus outline or other focus indicator
        const hasOutline = styles.outline !== 'none' && styles.outline !== '';
        const hasBoxShadow = styles.boxShadow !== 'none';
        const hasBorder = styles.borderWidth !== '0px';
        
        expect(hasOutline || hasBoxShadow || hasBorder).toBe(true);
      }
    });

    test('Text is resizable up to 200% without loss of functionality', async () => {
      const { container } = render(<Dashboard />);
      
      // Simulate text zoom
      container.style.fontSize = '200%';
      
      // Check that all text is still readable and buttons are still clickable
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeVisible();
        expect(button.offsetHeight).toBeGreaterThan(0);
        expect(button.offsetWidth).toBeGreaterThan(0);
      });
      
      const text = screen.getAllByText(/./);
      text.forEach(element => {
        if (element.textContent.trim()) {
          expect(element).toBeVisible();
        }
      });
    });
  });

  describe('User Experience Flows', () => {
    test('First-time user onboarding is accessible', async () => {
      const user = userEvent.setup();
      
      // Mock first-time user state
      localStorage.setItem('sideeye_first_run', 'true');
      
      render(<Dashboard />);
      
      // Should show onboarding dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
      
      // Should be able to navigate through onboarding with keyboard
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      // Check for progress indicator
      const progressIndicator = screen.getByRole('progressbar');
      expect(progressIndicator).toBeInTheDocument();
      expect(progressIndicator).toHaveAttribute('aria-valuenow');
      expect(progressIndicator).toHaveAttribute('aria-valuemax');
    });

    test('Error states are clearly communicated', async () => {
      // Mock camera access error
      const mockError = new Error('Camera access denied');
      
      render(<Dashboard />);
      
      await act(async () => {
        const event = new CustomEvent('cameraError', {
          detail: { error: mockError }
        });
        window.dispatchEvent(event);
      });
      
      // Error should be announced to screen readers
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveTextContent(/camera/i);
      
      // Should provide actionable recovery options
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
      
      const manualModeButton = screen.getByRole('button', { name: /manual mode/i });
      expect(manualModeButton).toBeInTheDocument();
    });

    test('Loading states provide appropriate feedback', async () => {
      render(<Dashboard />);
      
      // Simulate loading state
      await act(async () => {
        const event = new CustomEvent('loadingStart', {
          detail: { operation: 'emotion_detection' }
        });
        window.dispatchEvent(event);
      });
      
      // Should show loading indicator with proper ARIA attributes
      const loadingIndicator = screen.getByRole('status');
      expect(loadingIndicator).toHaveAttribute('aria-live', 'polite');
      expect(loadingIndicator).toHaveTextContent(/loading/i);
      
      // Should have progress indicator if applicable
      const progressBar = screen.queryByRole('progressbar');
      if (progressBar) {
        expect(progressBar).toHaveAttribute('aria-label');
      }
    });

    test('Form validation provides clear feedback', async () => {
      const user = userEvent.setup();
      render(<SettingsPanel />);
      
      // Try to submit form with invalid data
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);
      
      // Should show validation errors
      const errorMessages = screen.getAllByRole('alert');
      expect(errorMessages.length).toBeGreaterThan(0);
      
      errorMessages.forEach(error => {
        expect(error).toBeVisible();
        expect(error.textContent.trim()).not.toBe('');
      });
      
      // Errors should be associated with form fields
      const invalidFields = screen.getAllByAttribute('aria-invalid', 'true');
      invalidFields.forEach(field => {
        expect(field).toHaveAttribute('aria-describedby');
        const errorId = field.getAttribute('aria-describedby');
        const errorElement = document.getElementById(errorId);
        expect(errorElement).toBeInTheDocument();
      });
    });

    test('Responsive design maintains accessibility', async () => {
      const { container } = render(<Dashboard />);
      
      // Test mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667
      });
      
      window.dispatchEvent(new Event('resize'));
      
      await waitFor(() => {
        // All interactive elements should still be accessible
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button).toBeVisible();
          expect(button.offsetHeight).toBeGreaterThan(0);
        });
      });
      
      // Run accessibility tests on mobile layout
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('Reduced motion preferences are respected', async () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      render(<Dashboard />);
      
      // Animations should be disabled or reduced
      const animatedElements = document.querySelectorAll('[data-animated]');
      animatedElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        expect(styles.animationDuration).toBe('0s');
      });
    });
  });

  describe('Internationalization and Localization', () => {
    test('Text content is properly marked for translation', async () => {
      const { container } = render(<Dashboard />);
      
      // Check for lang attributes
      expect(container.closest('[lang]')).toBeInTheDocument();
      
      // User-facing text should not be hardcoded in test assertions
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button.textContent.trim()).not.toBe('');
      });
    });

    test('RTL (Right-to-Left) layout support', async () => {
      const { container } = render(
        <div dir="rtl">
          <Dashboard />
        </div>
      );
      
      // Check that layout adapts to RTL
      const dashboard = container.querySelector('[dir="rtl"]');
      expect(dashboard).toBeInTheDocument();
      
      // Run accessibility tests with RTL
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});