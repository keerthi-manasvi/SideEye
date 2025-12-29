#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

/**
 * First-run setup wizard for SideEye Workspace
 * Handles initial configuration and database setup
 */

class FirstRunSetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.backendPath = path.join(__dirname, '..', 'backend');
    this.configPath = path.join(__dirname, '..', 'config');
    this.userConfigPath = path.join(this.configPath, 'user-preferences.json');
    this.setupCompletePath = path.join(this.configPath, '.setup-complete');
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async runCommand(command, args, cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { 
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true 
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(data.toString().trim());
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(data.toString().trim());
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  async checkSetupStatus() {
    if (fs.existsSync(this.setupCompletePath)) {
      console.log('✅ Setup has already been completed.');
      const answer = await this.question('Do you want to run setup again? (y/N): ');
      return answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes';
    }
    return false;
  }

  async createDirectories() {
    console.log('📁 Creating configuration directories...');
    
    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true });
    }
    
    const modelsPath = path.join(__dirname, '..', 'public', 'models');
    if (!fs.existsSync(modelsPath)) {
      fs.mkdirSync(modelsPath, { recursive: true });
    }
    
    console.log('✅ Directories created successfully.');
  }

  async downloadModels() {
    console.log('🤖 Downloading TensorFlow.js models...');
    
    try {
      const downloadScript = path.join(__dirname, 'download-models.js');
      await this.runCommand('node', [downloadScript]);
      console.log('✅ Models downloaded successfully.');
    } catch (error) {
      console.error('❌ Failed to download models:', error.message);
      console.log('⚠️  You can download models later by running: npm run download-models');
    }
  }

  async setupDatabase() {
    console.log('🗄️  Setting up Django database...');
    
    try {
      // Check if virtual environment exists
      const venvHelperPath = path.join(this.backendPath, 'activate-venv.js');
      let pythonCommand = 'python';
      
      if (fs.existsSync(venvHelperPath)) {
        const venvHelper = require(venvHelperPath);
        pythonCommand = venvHelper.getVenvPython();
        console.log('📦 Using virtual environment Python');
      }
      
      // Run Django migrations
      console.log('🔄 Running database migrations...');
      await this.runCommand(pythonCommand, ['manage.py', 'makemigrations'], this.backendPath);
      await this.runCommand(pythonCommand, ['manage.py', 'migrate'], this.backendPath);
      
      // Populate initial data
      console.log('📊 Populating initial data...');
      const populateScript = path.join(this.backendPath, 'api', 'management', 'commands', 'populate_music_genres.py');
      if (fs.existsSync(populateScript)) {
        await this.runCommand(pythonCommand, ['manage.py', 'populate_music_genres'], this.backendPath);
      }
      
      console.log('✅ Database setup completed successfully.');
    } catch (error) {
      console.error('❌ Database setup failed:', error.message);
      console.log('⚠️  You can set up the database later by running Django migrations manually.');
    }
  }

  async collectUserPreferences() {
    console.log('\n🎨 Let\'s configure your preferences!\n');
    
    const preferences = {
      setupDate: new Date().toISOString(),
      version: '1.0.0',
      user: {},
      music: {
        preferredGenres: [],
        energyMappings: {}
      },
      themes: {
        preferredPalettes: [],
        emotionMappings: {}
      },
      notifications: {
        frequency: 5,
        wellnessInterval: 60,
        tone: 'balanced'
      },
      privacy: {
        dataRetentionDays: 30,
        enableAnalytics: false
      }
    };

    // User information
    console.log('👤 User Information:');
    preferences.user.name = await this.question('What should we call you? (optional): ');
    
    // Music preferences
    console.log('\n🎵 Music Preferences:');
    console.log('Available genres: pop, rock, classical, jazz, electronic, ambient, lo-fi, indie, folk, hip-hop');
    const genres = await this.question('Enter your preferred music genres (comma-separated): ');
    if (genres.trim()) {
      preferences.music.preferredGenres = genres.split(',').map(g => g.trim().toLowerCase());
    }
    
    // Theme preferences
    console.log('\n🎨 Theme Preferences:');
    console.log('Available palettes: dark, light, blue, green, purple, warm, cool, high-contrast');
    const palettes = await this.question('Enter your preferred color palettes (comma-separated): ');
    if (palettes.trim()) {
      preferences.themes.preferredPalettes = palettes.split(',').map(p => p.trim().toLowerCase());
    }
    
    // Notification preferences
    console.log('\n🔔 Notification Preferences:');
    const frequency = await this.question('Notification frequency in minutes (default: 5): ');
    if (frequency.trim() && !isNaN(frequency)) {
      preferences.notifications.frequency = parseInt(frequency);
    }
    
    const tone = await this.question('Notification tone (sarcastic/motivational/balanced, default: balanced): ');
    if (tone.trim()) {
      preferences.notifications.tone = tone.toLowerCase();
    }
    
    // Privacy preferences
    console.log('\n🔒 Privacy Preferences:');
    const retention = await this.question('Data retention period in days (default: 30): ');
    if (retention.trim() && !isNaN(retention)) {
      preferences.privacy.dataRetentionDays = parseInt(retention);
    }
    
    // Save preferences
    fs.writeFileSync(this.userConfigPath, JSON.stringify(preferences, null, 2));
    console.log('✅ Preferences saved successfully.');
    
    return preferences;
  }

  async createDesktopShortcuts() {
    console.log('🖥️  Creating desktop shortcuts...');
    
    const createShortcut = await this.question('Create desktop shortcut? (Y/n): ');
    if (createShortcut.toLowerCase() !== 'n' && createShortcut.toLowerCase() !== 'no') {
      // This would be implemented differently for each platform
      console.log('📝 Desktop shortcut creation noted for installer.');
    }
  }

  async displayWelcomeMessage(preferences) {
    console.log('\n🎉 Welcome to SideEye Workspace!\n');
    
    console.log('📋 Setup Summary:');
    console.log(`   👤 User: ${preferences.user.name || 'Anonymous'}`);
    console.log(`   🎵 Music genres: ${preferences.music.preferredGenres.join(', ') || 'None specified'}`);
    console.log(`   🎨 Theme palettes: ${preferences.themes.preferredPalettes.join(', ') || 'None specified'}`);
    console.log(`   🔔 Notifications: Every ${preferences.notifications.frequency} minutes (${preferences.notifications.tone} tone)`);
    console.log(`   🔒 Data retention: ${preferences.privacy.dataRetentionDays} days`);
    
    console.log('\n🚀 Getting Started:');
    console.log('   1. Run "npm run dev" to start the development environment');
    console.log('   2. The app will automatically start Django backend and open the UI');
    console.log('   3. Grant camera permissions for emotion detection');
    console.log('   4. Start working and let SideEye optimize your workspace!');
    
    console.log('\n📖 Documentation:');
    console.log('   • User Guide: README.md');
    console.log('   • API Documentation: backend/api/README.md');
    console.log('   • Troubleshooting: docs/troubleshooting.md');
    
    console.log('\n💡 Tips:');
    console.log('   • You can change preferences anytime in the Settings panel');
    console.log('   • Use the feedback system to improve AI recommendations');
    console.log('   • Check the notification center for wellness reminders');
    
    console.log('\n🔧 Advanced Configuration:');
    console.log(`   • User preferences: ${this.userConfigPath}`);
    console.log('   • CLI hooks: Configure in Settings > Integrations');
    console.log('   • Theme customization: Settings > Appearance');
  }

  async markSetupComplete() {
    const setupInfo = {
      completedAt: new Date().toISOString(),
      version: '1.0.0',
      platform: process.platform,
      nodeVersion: process.version
    };
    
    fs.writeFileSync(this.setupCompletePath, JSON.stringify(setupInfo, null, 2));
    console.log('\n✅ Setup marked as complete.');
  }

  async run() {
    try {
      console.log('🚀 SideEye Workspace - First Run Setup\n');
      
      const alreadySetup = await this.checkSetupStatus();
      if (alreadySetup) {
        this.rl.close();
        return;
      }
      
      await this.createDirectories();
      await this.downloadModels();
      await this.setupDatabase();
      
      const preferences = await this.collectUserPreferences();
      await this.createDesktopShortcuts();
      
      await this.displayWelcomeMessage(preferences);
      await this.markSetupComplete();
      
      console.log('\n🎊 Setup completed successfully! Welcome to SideEye Workspace!');
      
    } catch (error) {
      console.error('\n💥 Setup failed:', error.message);
      console.log('\n🔧 You can run setup again with: npm run first-run-setup');
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new FirstRunSetup();
  setup.run().catch(error => {
    console.error('💥 Setup failed:', error.message);
    process.exit(1);
  });
}

module.exports = FirstRunSetup;