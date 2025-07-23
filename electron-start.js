#!/usr/bin/env node

/**
 * Development startup script for Time Buddy Electron app
 * Launches Electron directly without Express server
 */

const { spawn } = require('child_process');

// Start Electron
function startElectron() {
    console.log('🖥️  Starting Electron...');
    
    const electronProcess = spawn('electron', ['.'], {
        stdio: 'inherit',
        env: { 
            ...process.env, 
            NODE_ENV: 'development'
        }
    });
    
    electronProcess.on('error', (error) => {
        console.error('❌ Failed to start Electron:', error.message);
        process.exit(1);
    });
    
    return electronProcess;
}

// Main startup sequence
function main() {
    console.log('🚀 Starting Time Buddy in development mode...\n');
    
    let electronProcess = null;
    
    try {
        // Start Electron
        electronProcess = startElectron();
        
        // Handle process termination
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down...');
            
            if (electronProcess) {
                electronProcess.kill();
            }
            
            process.exit(0);
        });
        
        // Wait for Electron to exit
        electronProcess.on('exit', (code) => {
            console.log('\n🖥️  Electron exited');
            process.exit(code);
        });
        
    } catch (error) {
        console.error('❌ Startup failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}