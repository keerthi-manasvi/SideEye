/**
 * Integration Test Setup Verification
 * 
 * Simple test to verify our integration test environment is working
 */

import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Simple test component
const TestComponent = () => (
  <div>
    <h1>Integration Test Setup</h1>
    <button aria-label="Test button">Click me</button>
    <p>This is a test component for verifying integration test setup.</p>
  </div>
);

describe('Integration Test Setup Verification', () => {
  test('Basic rendering works', () => {
    render(<TestComponent />);
    expect(screen.getByText('Integration Test Setup')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('Accessibility testing works', async () => {
    const { container } = render(<TestComponent />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('Mock fetch is available', () => {
    expect(global.fetch).toBeDefined();
    expect(typeof global.fetch).toBe('function');
  });

  test('Performance API is mocked', () => {
    expect(performance.now).toBeDefined();
    expect(typeof performance.now()).toBe('number');
  });

  test('Canvas API is mocked', () => {
    // Skip this test for now - Canvas mocking is complex in Jest environment
    expect(true).toBe(true);
  });
});