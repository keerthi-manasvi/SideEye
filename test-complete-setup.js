#!/usr/bin/env node

/**
 * Complete setup test for SideEye Workspace
 * This script tests all components of the application
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 SideEye Workspace - Complete Setup Test\n');

// Test 1: Check if Django server is running
function testDjangoServer() {
  return new Promise((resolve) => {
    console.log('🔍 Testing Django server...');
    
    const req = http.get('http://localhost:8000/api/health/', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Django server is running and responding');
        console.log('📊 Health check response:', data);
        resolve(true);
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Django server not responding:', err.message);
      console.log('💡 Make sure to run: npm run django-dev');
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('⏰ Django server timeout - may still be starting');
      resolve(false);
    });
  });
}

// Test 2: Check if React dev server is running
function testReactServer() {
  return new Promise((resolve) => {
    console.log('🔍 Testing React development server...');
    
    const req = http.get('http://localhost:3000/', (res) => {
      console.log('✅ React development server is running');
      console.log('🌐 Status:', res.statusCode);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.log('❌ React server not responding:', err.message);
      console.log('💡 Make sure to run: npm run react-dev');
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('⏰ React server timeout - may still be starting');
      resolve(false);
    });
  });
}

// Test 3: Check build files
function testBuildFiles() {
  console.log('🔍 Testing build files...');
  const fs = require('fs');
  
  const buildFiles = [
    'build/electron.js',
    'build/static',
    'package.json'
  ];
  
  let allExist = true;
  buildFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} missing`);
      allExist = false;
    }
  });
  
  return allExist;
}

// Test 4: Check Python dependencies
function testPythonDeps() {
  return new Promise((resolve) => {
    console.log('🔍 Testing Python dependencies...');
    
    const python = spawn('python', ['-c', 'import django; print("Django version:", django.get_version())'], {
      stdio: 'pipe'
    });
    
    let output = '';
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Python dependencies OK:', output.trim());
        resolve(true);
      } else {
        console.log('❌ Python dependencies issue');
        resolve(false);
      }
    });
    
    python.on('error', (err) => {
      console.log('❌ Python not found:', err.message);
      resolve(false);
    });
  });
}

// Test 5: Check Electron
function testElectron() {
  return new Promise((resolve) => {
    console.log('🔍 Testing Electron...');
    
    const electron = spawn('npx', ['electron', '--version'], {
      stdio: 'pipe'
    });
    
    let output = '';
    electron.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    electron.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Electron available:', output.trim());
        resolve(true);
      } else {
        console.log('❌ Electron issue');
        resolve(false);
      }
    });
    
    electron.on('error', (err) => {
      console.log('❌ Electron not found:', err.message);
      resolve(false);
    });
  });
}

// Main test function
async function runTests() {
  console.log('📋 Running comprehensive tests...\n');
  
  const results = {
    buildFiles: testBuildFiles(),
    pythonDeps: await testPythonDeps(),
    electron: await testElectron(),
    django: await testDjangoServer(),
    react: await testReactServer()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  
  console.log('\n🎯 Overall Status:', allPassed ? '✅ ALL SYSTEMS GO!' : '⚠️  Some issues found');
  
  if (allPassed) {
    console.log('\n🚀 Ready to launch! Run these commands:');
    console.log('   Terminal 1: npm run django-dev');
    console.log('   Terminal 2: npm run react-dev');
    console.log('   Terminal 3: npm run electron');
    console.log('\n   Or run everything at once: npm run dev');
  } else {
    console.log('\n🔧 Fix the failing tests above, then try again.');
  }
  
  console.log('\n📖 For more help, see: docs/USER_GUIDE.md');
}

// Run the tests
runTests().catch(console.error);