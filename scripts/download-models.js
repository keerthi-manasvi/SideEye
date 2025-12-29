const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');

const REQUIRED_MODELS = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json', 
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
];

// Create models directory if it doesn't exist
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${path.basename(filepath)}`);
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function downloadModels() {
  console.log('Downloading face-api.js models...');
  
  for (const modelFile of REQUIRED_MODELS) {
    const url = `${MODEL_BASE_URL}/${modelFile}`;
    const filepath = path.join(MODELS_DIR, modelFile);
    
    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`Skipping existing file: ${modelFile}`);
      continue;
    }
    
    try {
      await downloadFile(url, filepath);
    } catch (error) {
      console.error(`Failed to download ${modelFile}:`, error.message);
      process.exit(1);
    }
  }
  
  console.log('All models downloaded successfully!');
}

// Run the download
downloadModels().catch(console.error);