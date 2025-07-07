#!/usr/bin/env node

/**
 * Development startup script for Grafana Query IDE Electron app
 * Starts the Express server and then launches Electron
 */

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const SERVER_PORT = 3000;
const MAX_STARTUP_TIME = 30000; // 30 seconds

// Check if port is available
function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.once('close', () => resolve(true));
            server.close();
        });
        server.on('error', () => resolve(false));
    });
}

// Wait for server to be ready
function waitForServer(port, maxTime = MAX_STARTUP_TIME) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        function check() {
            const socket = new net.Socket();
            
            socket.setTimeout(1000);
            socket.on('connect', () => {
                socket.destroy();
                resolve();
            });
            
            socket.on('timeout', () => {
                socket.destroy();
                checkAgain();
            });
            
            socket.on('error', () => {
                checkAgain();
            });
            
            socket.connect(port, 'localhost');
        }
        
        function checkAgain() {
            if (Date.now() - startTime > maxTime) {
                reject(new Error(`Server did not start within ${maxTime}ms`));
                return;
            }
            setTimeout(check, 500);
        }
        
        check();
    });
}

// Start the server
async function startServer() {
    const isAvailable = await checkPort(SERVER_PORT);
    
    if (!isAvailable) {
        console.log('✅ Server already running on port', SERVER_PORT);
        return null;
    }
    
    console.log('🚀 Starting Express server...');
    
    const serverProcess = spawn('node', ['server.js'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { ...process.env, PORT: SERVER_PORT }
    });
    
    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Server:', output.trim());
    });
    
    serverProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('Server Error:', error.trim());
    });
    
    serverProcess.on('error', (error) => {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    });
    
    serverProcess.on('exit', (code, signal) => {
        if (code !== 0) {
            console.error(`❌ Server exited with code ${code}, signal ${signal}`);
        }
    });
    
    return serverProcess;
}

// Start Electron
function startElectron() {
    console.log('🖥️  Starting Electron...');
    
    const electronProcess = spawn('electron', ['.'], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'development' }
    });
    
    electronProcess.on('error', (error) => {
        console.error('❌ Failed to start Electron:', error.message);
        process.exit(1);
    });
    
    return electronProcess;
}

// Main startup sequence
async function main() {
    console.log('🚀 Starting Grafana Query IDE in development mode...\n');
    
    let serverProcess = null;
    let electronProcess = null;
    
    try {
        // Start the server
        serverProcess = await startServer();
        
        // Wait for server to be ready
        console.log('⏳ Waiting for server to be ready...');
        await waitForServer(SERVER_PORT);
        console.log('✅ Server is ready!\n');
        
        // Start Electron
        electronProcess = startElectron();
        
        // Handle process termination
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down...');
            
            if (electronProcess) {
                electronProcess.kill();
            }
            
            if (serverProcess) {
                serverProcess.kill();
            }
            
            process.exit(0);
        });
        
        // Wait for Electron to exit
        electronProcess.on('exit', (code) => {
            console.log('\n🖥️  Electron exited');
            
            if (serverProcess) {
                console.log('🛑 Stopping server...');
                serverProcess.kill();
            }
            
            process.exit(code);
        });
        
    } catch (error) {
        console.error('❌ Startup failed:', error.message);
        
        if (serverProcess) {
            serverProcess.kill();
        }
        
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}