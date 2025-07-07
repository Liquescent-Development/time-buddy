#!/usr/bin/env node

/**
 * Test script to verify Electron setup
 * Validates configuration without starting GUI
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Grafana Query IDE Electron Setup...\n');

// Check required files
const requiredFiles = [
    'main.js',
    'preload.js', 
    'server.js',
    'package.json',
    'public/index.html'
];

console.log('📁 Checking required files...');
let missingFiles = [];

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} (MISSING)`);
        missingFiles.push(file);
    }
});

if (missingFiles.length > 0) {
    console.log(`\n❌ Missing ${missingFiles.length} required files. Setup incomplete.`);
    process.exit(1);
}

// Check package.json configuration
console.log('\n📦 Checking package.json configuration...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const requiredScripts = ['electron', 'electron-dev', 'build'];
const requiredDevDeps = ['electron', 'electron-builder'];

requiredScripts.forEach(script => {
    if (packageJson.scripts && packageJson.scripts[script]) {
        console.log(`  ✅ Script: ${script}`);
    } else {
        console.log(`  ❌ Script: ${script} (MISSING)`);
    }
});

requiredDevDeps.forEach(dep => {
    if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
        console.log(`  ✅ DevDep: ${dep}`);
    } else {
        console.log(`  ❌ DevDep: ${dep} (MISSING)`);
    }
});

// Check build configuration
if (packageJson.build) {
    console.log('  ✅ Build configuration present');
    console.log(`  📱 App ID: ${packageJson.build.appId}`);
    console.log(`  🏷️  Product Name: ${packageJson.build.productName}`);
} else {
    console.log('  ❌ Build configuration missing');
}

// Test main.js syntax
console.log('\n🔍 Testing main.js syntax...');
try {
    require('./main.js');
    console.log('  ❌ main.js should not execute during require (missing app.whenReady() guard)');
} catch (error) {
    if (error.message.includes('app.whenReady')) {
        console.log('  ✅ main.js syntax valid (app module not available in test)');
    } else {
        console.log(`  ❌ main.js syntax error: ${error.message}`);
    }
}

// Test preload.js syntax  
console.log('\n🔍 Testing preload.js syntax...');
try {
    const preloadContent = fs.readFileSync('./preload.js', 'utf8');
    if (preloadContent.includes('contextBridge') && preloadContent.includes('electronAPI')) {
        console.log('  ✅ preload.js contains contextBridge and electronAPI');
    } else {
        console.log('  ❌ preload.js missing contextBridge or electronAPI');
    }
} catch (error) {
    console.log(`  ❌ preload.js error: ${error.message}`);
}

// Check assets directory
console.log('\n🎨 Checking assets...');
const assetsDir = path.join(__dirname, 'assets');
if (fs.existsSync(assetsDir)) {
    console.log('  ✅ Assets directory exists');
    const iconFiles = ['icon.png', 'icon.ico', 'icon.icns'];
    iconFiles.forEach(icon => {
        const iconPath = path.join(assetsDir, icon);
        if (fs.existsSync(iconPath)) {
            console.log(`  ✅ ${icon} exists`);
        } else {
            console.log(`  ⚠️  ${icon} missing (will use default)`);
        }
    });
} else {
    console.log('  ⚠️  Assets directory missing (will use default icons)');
}

// Check web app files
console.log('\n🌐 Checking web application...');
const webFiles = [
    'public/js/app.js',
    'public/js/config.js', 
    'public/js/editor.js',
    'public/css/main.css'
];

webFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} (MISSING - web app may not work)`);
    }
});

console.log('\n🎉 Electron setup validation completed!');
console.log('\n📖 Next steps:');
console.log('  1. Run "npm run electron-dev" to start in development mode');
console.log('  2. Run "npm run build" to create production build');
console.log('  3. Add custom icons to ./assets/ directory for branding');
console.log('  4. Test all functionality in the desktop app\n');

console.log('💡 Development tips:');
console.log('  • Use Ctrl+Shift+I to open DevTools in Electron');
console.log('  • The app runs a local Express server on port 3000');
console.log('  • All existing web functionality should work in desktop mode');
console.log('  • Menu shortcuts are available (Ctrl+Enter to execute queries)\n');