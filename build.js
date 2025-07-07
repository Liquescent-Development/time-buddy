#!/usr/bin/env node

/**
 * Build script for Grafana Query IDE Electron app
 * Handles platform-specific builds and icon generation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Grafana Query IDE Desktop App...\n');

// Check if we have icons, create placeholder if not
function ensureIcons() {
    const assetsDir = path.join(__dirname, 'assets');
    
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir);
    }
    
    const iconFiles = [
        'icon.png',
        'icon.ico', 
        'icon.icns'
    ];
    
    iconFiles.forEach(iconFile => {
        const iconPath = path.join(assetsDir, iconFile);
        if (!fs.existsSync(iconPath)) {
            console.log(`⚠️  Missing ${iconFile}, will use default Electron icon`);
        }
    });
}

// Install dependencies
function installDependencies() {
    console.log('📦 Installing dependencies...');
    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('✅ Dependencies installed\n');
    } catch (error) {
        console.error('❌ Failed to install dependencies:', error.message);
        process.exit(1);
    }
}

// Build for specific platform
function buildPlatform(platform) {
    console.log(`🔨 Building for ${platform}...`);
    try {
        const buildCommand = `npm run build-${platform}`;
        execSync(buildCommand, { stdio: 'inherit' });
        console.log(`✅ ${platform} build completed\n`);
    } catch (error) {
        console.error(`❌ Failed to build for ${platform}:`, error.message);
        return false;
    }
    return true;
}

// Main build process
function main() {
    const args = process.argv.slice(2);
    const platform = args[0] || 'current';
    
    ensureIcons();
    installDependencies();
    
    switch (platform) {
        case 'mac':
            buildPlatform('mac');
            break;
        case 'win':
            buildPlatform('win');
            break;
        case 'linux':
            buildPlatform('linux');
            break;
        case 'all':
            console.log('🌍 Building for all platforms...\n');
            buildPlatform('mac');
            buildPlatform('win');
            buildPlatform('linux');
            break;
        case 'current':
        default:
            console.log('🏗️  Building for current platform...\n');
            try {
                execSync('npm run build', { stdio: 'inherit' });
                console.log('✅ Build completed\n');
            } catch (error) {
                console.error('❌ Build failed:', error.message);
                process.exit(1);
            }
            break;
    }
    
    console.log('🎉 Build process completed!');
    console.log('📂 Built files are available in the ./dist directory');
}

if (require.main === module) {
    main();
}

module.exports = { main, buildPlatform, installDependencies, ensureIcons };