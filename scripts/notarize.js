const { notarize } = require('electron-notarize');

/**
 * macOS notarization script for SideEye Workspace
 * This script handles Apple notarization for distribution
 */

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  // Check if we have the required environment variables for notarization
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASS) {
    console.warn('Skipping notarization: APPLE_ID and APPLE_ID_PASS environment variables not set');
    return;
  }

  console.log(`Notarizing ${appName}...`);

  try {
    await notarize({
      appBundleId: 'com.sideeye.workspace',
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASS,
      ascProvider: process.env.APPLE_TEAM_ID, // Optional: Apple Team ID
    });

    console.log(`Successfully notarized ${appName}`);
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};