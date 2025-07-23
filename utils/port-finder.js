const net = require('net');

/**
 * Check if a port is available
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is available
 */
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

/**
 * Find an available port starting from a given port
 * @param {number} startPort - Starting port number (default: 3000)
 * @param {number} maxPort - Maximum port number to try (default: 65535)
 * @returns {Promise<number>} - Available port number
 */
async function findAvailablePort(startPort = 3000, maxPort = 65535) {
    for (let port = startPort; port <= maxPort; port++) {
        const isAvailable = await checkPort(port);
        if (isAvailable) {
            return port;
        }
    }
    throw new Error(`No available port found between ${startPort} and ${maxPort}`);
}

/**
 * Find multiple available ports
 * @param {number} count - Number of ports needed
 * @param {number} startPort - Starting port number (default: 3000)
 * @returns {Promise<number[]>} - Array of available port numbers
 */
async function findAvailablePorts(count, startPort = 3000) {
    const ports = [];
    let currentPort = startPort;
    
    while (ports.length < count) {
        const port = await findAvailablePort(currentPort);
        ports.push(port);
        currentPort = port + 1;
    }
    
    return ports;
}

module.exports = {
    checkPort,
    findAvailablePort,
    findAvailablePorts
};