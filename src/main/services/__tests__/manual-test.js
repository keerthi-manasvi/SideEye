/**
 * Manual test script for Django Service Manager
 * This script can be run independently to test the service manager functionality
 */

const DjangoServiceManager = require('../DjangoServiceManager');

async function runManualTest() {
  console.log('Starting Django Service Manager Manual Test...\n');

  // Create service manager instance
  const serviceManager = new DjangoServiceManager({
    port: 8000,
    host: 'localhost',
    isDev: false, // Set to true to test dev mode
    maxRestartAttempts: 2,
    restartDelay: 1000,
    healthCheckInterval: 5000,
    startupTimeout: 10000,
    shutdownTimeout: 5000
  });

  // Set up event listeners
  serviceManager.on('starting', () => {
    console.log('✓ Event: Service is starting...');
  });

  serviceManager.on('started', () => {
    console.log('✓ Event: Service started successfully');
  });

  serviceManager.on('stopping', () => {
    console.log('✓ Event: Service is stopping...');
  });

  serviceManager.on('stopped', () => {
    console.log('✓ Event: Service stopped');
  });

  serviceManager.on('restarting', () => {
    console.log('✓ Event: Service is restarting...');
  });

  serviceManager.on('healthy', () => {
    console.log('✓ Event: Health check passed');
  });

  serviceManager.on('unhealthy', (data) => {
    console.log('⚠ Event: Health check failed:', data);
  });

  serviceManager.on('error', (error) => {
    console.log('✗ Event: Error occurred:', error);
  });

  serviceManager.on('warning', (message) => {
    console.log('⚠ Event: Warning:', message);
  });

  serviceManager.on('info', (message) => {
    console.log('ℹ Event: Info:', message);
  });

  serviceManager.on('stdout', (data) => {
    console.log('📤 Django stdout:', data);
  });

  serviceManager.on('stderr', (data) => {
    console.log('📥 Django stderr:', data);
  });

  serviceManager.on('process-exit', (data) => {
    console.log('🔄 Process exit:', data);
  });

  serviceManager.on('api-error', (data) => {
    console.log('🌐 API error:', data);
  });

  try {
    // Test 1: Check initial status
    console.log('\n--- Test 1: Initial Status ---');
    const initialStatus = serviceManager.getStatus();
    console.log('Initial status:', JSON.stringify(initialStatus, null, 2));

    // Test 2: Start service
    console.log('\n--- Test 2: Start Service ---');
    const startResult = await serviceManager.start();
    console.log('Start result:', startResult);

    if (startResult) {
      // Test 3: Check status after start
      console.log('\n--- Test 3: Status After Start ---');
      const runningStatus = serviceManager.getStatus();
      console.log('Running status:', JSON.stringify(runningStatus, null, 2));

      // Test 4: Health check
      console.log('\n--- Test 4: Health Check ---');
      const healthResult = await serviceManager.healthCheck();
      console.log('Health check result:', healthResult);

      // Test 5: API call
      console.log('\n--- Test 5: API Call ---');
      try {
        const apiResult = await serviceManager.apiCall('/health/', 'GET');
        console.log('API call result:', JSON.stringify(apiResult, null, 2));
      } catch (error) {
        console.log('API call error:', error.message);
      }

      // Test 6: Wait a bit to see health monitoring
      console.log('\n--- Test 6: Health Monitoring (waiting 10 seconds) ---');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Test 7: Stop service
      console.log('\n--- Test 7: Stop Service ---');
      const stopResult = await serviceManager.stop();
      console.log('Stop result:', stopResult);

      // Test 8: Check final status
      console.log('\n--- Test 8: Final Status ---');
      const finalStatus = serviceManager.getStatus();
      console.log('Final status:', JSON.stringify(finalStatus, null, 2));
    }

  } catch (error) {
    console.error('Test error:', error);
  }

  console.log('\n✅ Manual test completed');
}

// Run the test if this file is executed directly
if (require.main === module) {
  runManualTest().catch(console.error);
}

module.exports = { runManualTest };