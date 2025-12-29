#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * Runs all integration tests for the SideEye application:
 * - Frontend React/Jest tests
 * - Backend Django tests
 * - Performance benchmarks
 * - Accessibility tests
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class IntegrationTestRunner {
  constructor() {
    this.results = {
      frontend: { passed: 0, failed: 0, total: 0 },
      backend: { passed: 0, failed: 0, total: 0 },
      performance: { passed: 0, failed: 0, total: 0 },
      accessibility: { passed: 0, failed: 0, total: 0 }
    };
    this.startTime = Date.now();
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`\n🔄 Running: ${command} ${args.join(' ')}`);
      
      const process = spawn(command, args, {
        stdio: 'pipe',
        shell: true,
        ...options
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
        if (options.verbose) {
          console.log(data.toString());
        }
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
        if (options.verbose) {
          console.error(data.toString());
        }
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject({ stdout, stderr, code });
        }
      });

      process.on('error', (error) => {
        reject({ error, stdout, stderr });
      });
    });
  }

  parseJestResults(output) {
    const lines = output.split('\n');
    let passed = 0;
    let failed = 0;
    let total = 0;

    for (const line of lines) {
      if (line.includes('Tests:')) {
        const match = line.match(/(\d+) passed.*?(\d+) failed.*?(\d+) total/);
        if (match) {
          passed = parseInt(match[1]);
          failed = parseInt(match[2]);
          total = parseInt(match[3]);
        } else {
          const passedMatch = line.match(/(\d+) passed/);
          if (passedMatch) {
            passed = parseInt(passedMatch[1]);
            total = passed;
          }
        }
      }
    }

    return { passed, failed, total };
  }

  parseDjangoResults(output) {
    const lines = output.split('\n');
    let passed = 0;
    let failed = 0;
    let total = 0;

    for (const line of lines) {
      if (line.includes('Ran ')) {
        const match = line.match(/Ran (\d+) test/);
        if (match) {
          total = parseInt(match[1]);
        }
      }
      if (line.includes('FAILED')) {
        const match = line.match(/FAILED \(.*?failures=(\d+)/);
        if (match) {
          failed = parseInt(match[1]);
        }
      }
      if (line.includes('OK')) {
        passed = total;
      }
    }

    if (failed === 0 && total > 0) {
      passed = total;
    }

    return { passed, failed, total };
  }

  async runFrontendTests() {
    console.log('\n📱 Running Frontend Integration Tests...');
    
    try {
      // Run specific integration test files
      const testFiles = [
        'src/__tests__/CompleteEmotionToActionWorkflow.test.js',
        'src/__tests__/UserFeedbackLearningCycle.test.js',
        'src/__tests__/EmotionProcessingPerformance.test.js',
        'src/__tests__/NotificationRateLimitingIntegration.test.js',
        'src/__tests__/AccessibilityUsability.test.js'
      ];

      for (const testFile of testFiles) {
        if (fs.existsSync(testFile)) {
          console.log(`\n  Running ${path.basename(testFile)}...`);
          
          try {
            const result = await this.runCommand('npm', ['test', '--', '--testPathPattern=' + testFile, '--watchAll=false', '--verbose']);
            const stats = this.parseJestResults(result.stdout);
            
            this.results.frontend.passed += stats.passed;
            this.results.frontend.failed += stats.failed;
            this.results.frontend.total += stats.total;
            
            console.log(`  ✅ ${stats.passed} passed, ${stats.failed} failed`);
          } catch (error) {
            console.log(`  ❌ Test file failed: ${testFile}`);
            const stats = this.parseJestResults(error.stdout || '');
            this.results.frontend.failed += Math.max(1, stats.failed);
            this.results.frontend.total += Math.max(1, stats.total);
          }
        } else {
          console.log(`  ⚠️  Test file not found: ${testFile}`);
        }
      }
    } catch (error) {
      console.error('❌ Frontend tests failed:', error.message);
      this.results.frontend.failed += 1;
      this.results.frontend.total += 1;
    }
  }

  async runBackendTests() {
    console.log('\n🐍 Running Backend Integration Tests...');
    
    try {
      // Check if Django is available
      if (!fs.existsSync('backend/manage.py')) {
        console.log('  ⚠️  Django backend not found, skipping backend tests');
        return;
      }

      // Run Django integration tests
      const result = await this.runCommand('python', ['backend/manage.py', 'test', 'api.tests.test_integration_workflows', '--verbosity=2'], {
        cwd: process.cwd()
      });

      const stats = this.parseDjangoResults(result.stdout);
      this.results.backend = stats;
      
      console.log(`  ✅ ${stats.passed} passed, ${stats.failed} failed`);
    } catch (error) {
      console.error('❌ Backend tests failed:', error.message);
      const stats = this.parseDjangoResults(error.stdout || '');
      this.results.backend = stats;
      
      if (stats.total === 0) {
        this.results.backend.failed = 1;
        this.results.backend.total = 1;
      }
    }
  }

  async runPerformanceTests() {
    console.log('\n⚡ Running Performance Tests...');
    
    try {
      // Run performance-specific tests
      const result = await this.runCommand('npm', ['test', '--', '--testPathPattern=Performance', '--watchAll=false']);
      const stats = this.parseJestResults(result.stdout);
      
      this.results.performance = stats;
      console.log(`  ✅ ${stats.passed} passed, ${stats.failed} failed`);
    } catch (error) {
      console.log('  ❌ Performance tests failed');
      const stats = this.parseJestResults(error.stdout || '');
      this.results.performance = stats;
      
      if (stats.total === 0) {
        this.results.performance.failed = 1;
        this.results.performance.total = 1;
      }
    }
  }

  async runAccessibilityTests() {
    console.log('\n♿ Running Accessibility Tests...');
    
    try {
      // Install jest-axe if not present
      try {
        require.resolve('jest-axe');
      } catch (e) {
        console.log('  📦 Installing jest-axe...');
        await this.runCommand('npm', ['install', '--save-dev', 'jest-axe']);
      }

      const result = await this.runCommand('npm', ['test', '--', '--testPathPattern=Accessibility', '--watchAll=false']);
      const stats = this.parseJestResults(result.stdout);
      
      this.results.accessibility = stats;
      console.log(`  ✅ ${stats.passed} passed, ${stats.failed} failed`);
    } catch (error) {
      console.log('  ❌ Accessibility tests failed');
      const stats = this.parseJestResults(error.stdout || '');
      this.results.accessibility = stats;
      
      if (stats.total === 0) {
        this.results.accessibility.failed = 1;
        this.results.accessibility.total = 1;
      }
    }
  }

  generateReport() {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 INTEGRATION TEST RESULTS');
    console.log('='.repeat(60));
    
    const categories = [
      { name: 'Frontend', key: 'frontend', icon: '📱' },
      { name: 'Backend', key: 'backend', icon: '🐍' },
      { name: 'Performance', key: 'performance', icon: '⚡' },
      { name: 'Accessibility', key: 'accessibility', icon: '♿' }
    ];

    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    categories.forEach(category => {
      const result = this.results[category.key];
      const status = result.failed === 0 ? '✅' : '❌';
      const percentage = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0.0';
      
      console.log(`${category.icon} ${category.name.padEnd(12)} ${status} ${result.passed}/${result.total} (${percentage}%)`);
      
      totalPassed += result.passed;
      totalFailed += result.failed;
      totalTests += result.total;
    });

    console.log('-'.repeat(60));
    
    const overallPercentage = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
    const overallStatus = totalFailed === 0 ? '✅' : '❌';
    
    console.log(`🎯 Overall Result   ${overallStatus} ${totalPassed}/${totalTests} (${overallPercentage}%)`);
    console.log(`⏱️  Duration: ${duration}s`);
    
    if (totalFailed > 0) {
      console.log('\n⚠️  Some tests failed. Check the output above for details.');
      console.log('💡 Tips:');
      console.log('   - Run individual test files to debug specific failures');
      console.log('   - Check that all dependencies are installed');
      console.log('   - Ensure Django backend is running for backend tests');
    } else {
      console.log('\n🎉 All integration tests passed!');
    }
    
    console.log('='.repeat(60));
    
    return totalFailed === 0;
  }

  async run() {
    console.log('🚀 Starting SideEye Integration Test Suite...');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    
    try {
      await this.runFrontendTests();
      await this.runBackendTests();
      await this.runPerformanceTests();
      await this.runAccessibilityTests();
    } catch (error) {
      console.error('💥 Test suite encountered an error:', error);
    }
    
    const success = this.generateReport();
    process.exit(success ? 0 : 1);
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.run().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTestRunner;