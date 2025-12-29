/**
 * Emotion Detection Demo
 * 
 * This file demonstrates how to use the EmotionDetectionEngine
 * for testing and development purposes.
 */

import EmotionDetectionEngine from '../services/EmotionDetectionEngine';

class EmotionDetectionDemo {
  constructor() {
    this.engine = new EmotionDetectionEngine();
    this.isRunning = false;
    this.emotionHistory = [];
  }

  /**
   * Initialize and start the demo
   */
  async start() {
    console.log('🚀 Starting Emotion Detection Demo...');
    
    try {
      // Initialize the engine
      console.log('📦 Initializing TensorFlow.js models...');
      const initialized = await this.engine.initialize();
      
      if (!initialized) {
        throw new Error('Failed to initialize emotion detection engine');
      }
      
      console.log('✅ Engine initialized successfully');
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Create video and canvas elements
      const { videoElement, canvasElement } = this.createVideoElements();
      
      // Start detection
      console.log('📹 Starting camera detection...');
      await this.engine.startDetection(videoElement, canvasElement);
      
      this.isRunning = true;
      console.log('🎯 Emotion detection is now running!');
      console.log('📊 Emotion data will be logged to console...');
      
      // Run demo for 30 seconds
      setTimeout(() => {
        this.stop();
      }, 30000);
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
      
      if (error.message.includes('Permission denied')) {
        console.log('💡 Try running the manual emotion demo instead:');
        console.log('   demo.startManualDemo()');
      }
    }
  }

  /**
   * Start manual emotion demo (no camera required)
   */
  startManualDemo() {
    console.log('🎮 Starting Manual Emotion Demo...');
    
    const emotions = ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral'];
    let currentIndex = 0;
    
    const simulateEmotion = () => {
      const emotion = emotions[currentIndex];
      const confidence = 0.7 + Math.random() * 0.3; // 0.7 to 1.0
      const energyLevel = this.calculateEnergyForEmotion(emotion);
      
      const emotionData = {
        emotions: this.createEmotionProbabilities(emotion, confidence),
        primaryEmotion: emotion,
        confidence: confidence,
        energyLevel: energyLevel,
        timestamp: Date.now(),
        isDemo: true
      };
      
      this.logEmotionData(emotionData);
      this.emotionHistory.push(emotionData);
      
      currentIndex = (currentIndex + 1) % emotions.length;
      
      if (this.isRunning) {
        setTimeout(simulateEmotion, 2000); // Every 2 seconds
      }
    };
    
    this.isRunning = true;
    simulateEmotion();
    
    console.log('🎯 Manual demo is running! Cycling through emotions...');
    
    // Run demo for 20 seconds
    setTimeout(() => {
      this.stop();
    }, 20000);
  }

  /**
   * Stop the demo
   */
  stop() {
    console.log('🛑 Stopping demo...');
    
    this.isRunning = false;
    
    if (this.engine) {
      this.engine.stopDetection();
    }
    
    this.printSummary();
    console.log('✅ Demo completed!');
  }

  /**
   * Set up event handlers for the engine
   */
  setupEventHandlers() {
    this.engine.setOnEmotionDetected((emotionData) => {
      this.logEmotionData(emotionData);
      this.emotionHistory.push(emotionData);
    });

    this.engine.setOnError((errorType, error) => {
      console.error(`❌ Emotion detection error (${errorType}):`, error.message);
    });
  }

  /**
   * Create video and canvas elements for detection
   */
  createVideoElements() {
    // Create video element
    const videoElement = document.createElement('video');
    videoElement.width = 640;
    videoElement.height = 480;
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    
    // Create canvas element
    const canvasElement = document.createElement('canvas');
    canvasElement.width = 640;
    canvasElement.height = 480;
    
    // Add to DOM for demo purposes (optional)
    if (document.body) {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '10px';
      container.style.right = '10px';
      container.style.zIndex = '9999';
      container.style.background = 'white';
      container.style.padding = '10px';
      container.style.border = '2px solid #007bff';
      container.style.borderRadius = '8px';
      
      const title = document.createElement('h4');
      title.textContent = 'Emotion Detection Demo';
      title.style.margin = '0 0 10px 0';
      
      videoElement.style.width = '320px';
      videoElement.style.height = '240px';
      canvasElement.style.position = 'absolute';
      canvasElement.style.top = '40px';
      canvasElement.style.left = '10px';
      canvasElement.style.width = '320px';
      canvasElement.style.height = '240px';
      
      container.appendChild(title);
      container.appendChild(videoElement);
      container.appendChild(canvasElement);
      document.body.appendChild(container);
      
      // Add close button
      const closeButton = document.createElement('button');
      closeButton.textContent = '×';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '5px';
      closeButton.style.right = '5px';
      closeButton.style.background = '#dc3545';
      closeButton.style.color = 'white';
      closeButton.style.border = 'none';
      closeButton.style.borderRadius = '50%';
      closeButton.style.width = '25px';
      closeButton.style.height = '25px';
      closeButton.style.cursor = 'pointer';
      closeButton.onclick = () => {
        this.stop();
        document.body.removeChild(container);
      };
      container.appendChild(closeButton);
    }
    
    return { videoElement, canvasElement };
  }

  /**
   * Log emotion data to console
   */
  logEmotionData(emotionData) {
    const emoji = this.getEmotionEmoji(emotionData.primaryEmotion);
    const energyBar = this.createEnergyBar(emotionData.energyLevel);
    
    console.log(`${emoji} ${emotionData.primaryEmotion.toUpperCase()} | Confidence: ${(emotionData.confidence * 100).toFixed(1)}% | Energy: ${energyBar} ${(emotionData.energyLevel * 100).toFixed(1)}%`);
  }

  /**
   * Get emoji for emotion
   */
  getEmotionEmoji(emotion) {
    const emojiMap = {
      happy: '😊',
      sad: '😢',
      angry: '😠',
      surprised: '😲',
      fearful: '😨',
      disgusted: '🤢',
      neutral: '😐'
    };
    return emojiMap[emotion] || '🤔';
  }

  /**
   * Create visual energy bar
   */
  createEnergyBar(energyLevel) {
    const barLength = 10;
    const filledBars = Math.round(energyLevel * barLength);
    const emptyBars = barLength - filledBars;
    return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
  }

  /**
   * Calculate energy level for a given emotion (for manual demo)
   */
  calculateEnergyForEmotion(emotion) {
    const energyMap = {
      happy: 0.8 + Math.random() * 0.2,
      surprised: 0.7 + Math.random() * 0.3,
      angry: 0.6 + Math.random() * 0.3,
      neutral: 0.4 + Math.random() * 0.2,
      disgusted: 0.3 + Math.random() * 0.2,
      fearful: 0.2 + Math.random() * 0.3,
      sad: 0.1 + Math.random() * 0.2
    };
    return Math.min(1.0, energyMap[emotion] || 0.5);
  }

  /**
   * Create emotion probabilities for manual demo
   */
  createEmotionProbabilities(primaryEmotion, confidence) {
    const emotions = ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral'];
    const probabilities = {};
    
    emotions.forEach(emotion => {
      if (emotion === primaryEmotion) {
        probabilities[emotion] = confidence;
      } else {
        probabilities[emotion] = (1 - confidence) / (emotions.length - 1);
      }
    });
    
    return probabilities;
  }

  /**
   * Print demo summary
   */
  printSummary() {
    if (this.emotionHistory.length === 0) {
      console.log('📊 No emotion data collected during demo');
      return;
    }
    
    console.log('\n📊 DEMO SUMMARY');
    console.log('================');
    console.log(`Total readings: ${this.emotionHistory.length}`);
    
    // Calculate emotion distribution
    const emotionCounts = {};
    let totalEnergy = 0;
    let totalConfidence = 0;
    
    this.emotionHistory.forEach(data => {
      emotionCounts[data.primaryEmotion] = (emotionCounts[data.primaryEmotion] || 0) + 1;
      totalEnergy += data.energyLevel;
      totalConfidence += data.confidence;
    });
    
    console.log('\nEmotion Distribution:');
    Object.entries(emotionCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([emotion, count]) => {
        const percentage = ((count / this.emotionHistory.length) * 100).toFixed(1);
        const emoji = this.getEmotionEmoji(emotion);
        console.log(`  ${emoji} ${emotion}: ${count} (${percentage}%)`);
      });
    
    const avgEnergy = totalEnergy / this.emotionHistory.length;
    const avgConfidence = totalConfidence / this.emotionHistory.length;
    
    console.log(`\nAverage Energy Level: ${(avgEnergy * 100).toFixed(1)}%`);
    console.log(`Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log('================\n');
  }
}

// Export for use in browser console or other modules
export default EmotionDetectionDemo;

// Auto-start demo if running in browser console
if (typeof window !== 'undefined') {
  window.EmotionDetectionDemo = EmotionDetectionDemo;
  
  // Add convenience methods to window
  window.startEmotionDemo = () => {
    const demo = new EmotionDetectionDemo();
    demo.start();
    return demo;
  };
  
  window.startManualEmotionDemo = () => {
    const demo = new EmotionDetectionDemo();
    demo.startManualDemo();
    return demo;
  };
  
  console.log('🎮 Emotion Detection Demo loaded!');
  console.log('   Run: startEmotionDemo() - for camera-based demo');
  console.log('   Run: startManualEmotionDemo() - for simulated demo');
}