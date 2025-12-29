# Integration Testing Documentation

## Overview

This document describes the comprehensive integration testing suite for the SideEye workspace application. The testing suite covers end-to-end workflows, performance characteristics, accessibility compliance, and system reliability.

## Test Categories

### 1. Complete Emotion-to-Action Workflows

**File:** `src/__tests__/CompleteEmotionToActionWorkflow.test.js`

Tests the full pipeline from emotion detection through workspace actions:

- Emotion detection from webcam input
- Energy level calculation and analysis
- Task reordering based on detected energy levels
- Music playlist recommendations based on emotions
- Theme changes triggered by mood
- Notification generation and delivery
- Graceful handling of camera access denial
- Partial failure recovery (continues with available services)
- Confidence-based action triggering

**Key Test Scenarios:**

- High energy emotions → Complex tasks prioritized, upbeat music, bright themes
- Low energy emotions → Simple tasks prioritized, calming music, comfortable themes
- Camera access denied → Manual mode fallback
- Service failures → Graceful degradation
- Low confidence detection → No actions triggered

### 2. User Feedback and Learning Cycles

**File:** `src/__tests__/UserFeedbackLearningCycle.test.js`

Tests the complete feedback loop and machine learning aspects:

- System recommendation generation
- User feedback collection (accept/reject)
- Learning algorithm updates
- Improved future recommendations
- Conflicting feedback handling
- Feedback modal accessibility and usability
- Performance with multiple feedback cycles

**Key Test Scenarios:**

- Music feedback cycle: Reject rock → Prefer jazz → Get jazz recommendations
- Theme feedback cycle: Reject bright → Prefer dark → Get dark themes
- Positive feedback reinforcement
- Conflicting preference resolution
- Rapid feedback processing performance

### 3. Real-time Emotion Processing Performance

**File:** `src/__tests__/EmotionProcessingPerformance.test.js`

Tests performance characteristics of the emotion detection system:

- Processing latency (target: <100ms)
- Frame rate maintenance (target: 10 FPS)
- Memory usage stability during continuous processing
- CPU usage optimization with frame skipping
- Resource cleanup and memory leak prevention
- Performance degradation under extreme load
- Adaptive frame rate based on system performance

**Performance Targets:**

- Emotion detection latency: <100ms
- Processing frame rate: 8-12 FPS
- Memory growth: <50MB during extended use
- Memory variance: <20MB fluctuation
- Concurrent processing: Handle 10+ simultaneous requests

### 4. Notification Rate Limiting and Queue Management

**File:** `src/__tests__/NotificationRateLimitingIntegration.test.js`

Tests the notification system's rate limiting and queue management:

- Action notification rate limiting (2 per 5 minutes)
- Wellness notification rate limiting (5 per hour)
- Queue management and prioritization
- Rate limit reset after time windows
- Notification delivery scheduling
- Queue cleanup and memory management
- Concurrent notification handling

**Rate Limiting Rules:**

- Action notifications: Maximum 2 per 5-minute window
- Wellness notifications: Maximum 5 per 1-hour window
- High priority notifications get queue precedence
- Automatic cleanup of old queued notifications

### 5. Accessibility and Usability

**File:** `src/__tests__/AccessibilityUsability.test.js`

Tests accessibility compliance and usability features:

- Screen reader compatibility (ARIA labels, semantic HTML)
- Keyboard navigation and focus management
- Color contrast compliance (WCAG AA standards)
- Visual accessibility (no color-only information)
- Modal focus trapping
- Error state communication
- Loading state feedback
- Form validation and error messages
- Responsive design accessibility
- Reduced motion preferences
- Internationalization support

**Accessibility Standards:**

- WCAG 2.1 AA compliance
- Full keyboard navigation support
- Screen reader compatibility
- Color contrast ratios meet standards
- Focus indicators clearly visible

## Backend Integration Tests

### Django API Integration

**File:** `backend/api/tests/test_integration_workflows.py`

Tests complete backend workflows:

- Complete emotion-to-action API workflows
- User feedback and learning cycle APIs
- Notification rate limiting enforcement
- Performance under concurrent load
- Error handling and recovery scenarios
- Database transaction integrity
- External service failure handling

**Test Categories:**

- `CompleteWorkflowIntegrationTests`: End-to-end API workflows
- `UserFeedbackLearningIntegrationTests`: Learning system APIs
- `NotificationRateLimitingIntegrationTests`: Rate limiting enforcement
- `PerformanceIntegrationTests`: Load and performance testing
- `ErrorHandlingIntegrationTests`: Error scenarios and recovery

## Running Integration Tests

### Prerequisites

```bash
# Install dependencies
npm install
npm install --save-dev jest-axe @testing-library/jest-dom @testing-library/user-event

# For backend tests
pip install -r backend/requirements.txt
```

### Running Individual Test Suites

```bash
# Frontend integration tests
npm test -- --testPathPattern=CompleteEmotionToActionWorkflow --watchAll=false
npm test -- --testPathPattern=UserFeedbackLearningCycle --watchAll=false
npm test -- --testPathPattern=EmotionProcessingPerformance --watchAll=false
npm test -- --testPathPattern=NotificationRateLimitingIntegration --watchAll=false
npm test -- --testPathPattern=AccessibilityUsability --watchAll=false

# Backend integration tests
python backend/manage.py test api.tests.test_integration_workflows --verbosity=2

# All integration tests
node scripts/run-integration-tests.js
```

### Test Runner Script

The `scripts/run-integration-tests.js` script provides comprehensive test execution:

```bash
node scripts/run-integration-tests.js
```

**Features:**

- Runs all frontend and backend integration tests
- Provides detailed progress reporting
- Generates comprehensive test results summary
- Handles test failures gracefully
- Measures execution time and performance
- Supports verbose output for debugging

**Output Example:**

```
🚀 Starting SideEye Integration Test Suite...
📱 Running Frontend Integration Tests...
🐍 Running Backend Integration Tests...
⚡ Running Performance Tests...
♿ Running Accessibility Tests...

📊 INTEGRATION TEST RESULTS
============================================================
📱 Frontend      ✅ 45/45 (100.0%)
🐍 Backend       ✅ 28/28 (100.0%)
⚡ Performance   ✅ 12/12 (100.0%)
♿ Accessibility ✅ 15/15 (100.0%)
------------------------------------------------------------
🎯 Overall Result   ✅ 100/100 (100.0%)
⏱️  Duration: 45.2s
```

## Test Environment Setup

### Mock Configuration

The test environment includes comprehensive mocking:

- **TensorFlow.js**: Mocked for emotion detection
- **Face-api.js**: Mocked for facial analysis
- **PoseNet**: Mocked for posture detection
- **Canvas API**: Mocked for image processing
- **MediaDevices API**: Mocked for camera access
- **Fetch API**: Mocked for HTTP requests
- **Performance API**: Mocked for timing measurements

### Test Data

Tests use realistic mock data:

- Emotion detection results with confidence scores
- Posture analysis data with alignment metrics
- User preference configurations
- Task lists with complexity ratings
- Music playlist metadata
- Theme configuration objects

## Continuous Integration

### GitHub Actions Integration

```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "18"
      - uses: actions/setup-python@v2
        with:
          python-version: "3.9"
      - run: npm install
      - run: pip install -r backend/requirements.txt
      - run: node scripts/run-integration-tests.js
```

### Pre-commit Hooks

```bash
# Install pre-commit hooks
npm install --save-dev husky
npx husky add .husky/pre-commit "node scripts/run-integration-tests.js"
```

## Performance Benchmarks

### Target Performance Metrics

- **Emotion Detection Latency**: <100ms per frame
- **Processing Frame Rate**: 8-12 FPS sustained
- **Memory Usage**: <50MB growth during extended use
- **API Response Time**: <200ms for all endpoints
- **Notification Processing**: <10ms per notification
- **Database Query Time**: <50ms for complex queries

### Load Testing Scenarios

- **Concurrent Users**: 10+ simultaneous emotion processing
- **High Frequency Feedback**: 50+ feedback submissions per minute
- **Notification Burst**: 100+ notifications in queue
- **Extended Runtime**: 8+ hours continuous operation

## Troubleshooting

### Common Issues

**Test Timeouts:**

```bash
# Increase timeout for slow tests
npm test -- --testTimeout=30000
```

**Memory Issues:**

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

**Canvas Mocking Issues:**

- Canvas API mocking can be complex in Jest
- Use `jest-canvas-mock` for advanced canvas testing
- Consider using `jsdom-canvas` for more realistic canvas behavior

**Accessibility Test Failures:**

- Ensure all interactive elements have proper ARIA labels
- Check color contrast ratios meet WCAG standards
- Verify keyboard navigation works for all components

### Debugging Tips

1. **Use Verbose Output:**

   ```bash
   npm test -- --verbose --testPathPattern=YourTest
   ```

2. **Run Single Tests:**

   ```bash
   npm test -- --testNamePattern="specific test name"
   ```

3. **Debug Mode:**

   ```bash
   node --inspect-brk node_modules/.bin/jest --runInBand
   ```

4. **Mock Debugging:**
   ```javascript
   console.log("Mock calls:", mockFunction.mock.calls);
   ```

## Contributing

### Adding New Integration Tests

1. **Create Test File:**

   ```javascript
   // src/__tests__/NewFeatureIntegration.test.js
   describe("New Feature Integration", () => {
     test("should handle complete workflow", async () => {
       // Test implementation
     });
   });
   ```

2. **Update Test Runner:**
   Add new test file to `scripts/run-integration-tests.js`

3. **Document Test:**
   Update this documentation with test description and scenarios

### Test Writing Guidelines

1. **Use Descriptive Names:**

   ```javascript
   test("Complete workflow: High energy emotion leads to appropriate actions");
   ```

2. **Test Real Scenarios:**

   ```javascript
   // Good: Tests actual user workflow
   test("User rejects music, provides feedback, gets improved recommendation");

   // Bad: Tests implementation details
   test("MusicService.recommend() returns playlist object");
   ```

3. **Include Error Scenarios:**

   ```javascript
   test("Workflow continues with partial failures");
   test("Handles invalid input gracefully");
   ```

4. **Verify Performance:**
   ```javascript
   const startTime = performance.now();
   // ... test operations
   const duration = performance.now() - startTime;
   expect(duration).toBeLessThan(1000); // 1 second max
   ```

## Maintenance

### Regular Tasks

1. **Update Dependencies:**

   ```bash
   npm update
   npm audit fix
   ```

2. **Review Performance Metrics:**

   - Monitor test execution times
   - Check for memory leaks in long-running tests
   - Update performance targets as needed

3. **Accessibility Compliance:**

   - Run accessibility audits regularly
   - Update ARIA labels and semantic HTML
   - Test with actual screen readers

4. **Test Coverage:**
   ```bash
   npm test -- --coverage --testPathPattern=Integration
   ```

### Monitoring and Alerts

Set up monitoring for:

- Test execution time trends
- Test failure rates
- Performance regression detection
- Accessibility compliance scores

This comprehensive integration testing suite ensures the SideEye application maintains high quality, performance, and accessibility standards throughout development and deployment.
