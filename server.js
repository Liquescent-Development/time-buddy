const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const http = require('http');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const { SocksProxyAgent } = require('socks-proxy-agent');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow inline scripts
}));
app.use(compression());
app.use(morgan('combined'));

// Enable CORS for all origins
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files (the web interface)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Test endpoint to verify credentials without proxy
app.post('/test-auth', async (req, res) => {
  const { url, authorization } = req.body;
  
  if (!url || !authorization) {
    return res.status(400).json({ error: 'Missing url or authorization' });
  }
  
  try {
    console.log('Testing auth without proxy to:', url);
    const response = await axios({
      method: 'GET',
      url: url + '/api/user',
      headers: {
        'Authorization': authorization,
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      validateStatus: () => true
    });
    
    console.log('Test auth response:', response.status);
    res.json({
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
  } catch (error) {
    console.error('Test auth error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to verify credentials with SOCKS proxy
app.post('/test-auth-proxy', async (req, res) => {
  const { url, authorization, proxyConfig } = req.body;
  
  if (!url || !authorization || !proxyConfig) {
    return res.status(400).json({ error: 'Missing url, authorization, or proxyConfig' });
  }
  
  try {
    console.log('Testing auth with SOCKS proxy to:', url);
    console.log('Proxy config:', proxyConfig.host + ':' + proxyConfig.port);
    
    // Build proxy URL
    let proxyUrl = 'socks5://';
    if (proxyConfig.username && proxyConfig.password) {
      proxyUrl += `${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@`;
    }
    proxyUrl += `${proxyConfig.host}:${proxyConfig.port}`;
    
    // Create SOCKS proxy agent
    const socksAgent = new SocksProxyAgent(proxyUrl);
    
    const requestConfig = {
      method: 'GET',
      url: url + '/api/user',
      headers: {
        'Authorization': authorization,
        'Accept': 'application/json',
        'User-Agent': 'Grafana-Query-IDE/1.0'
      },
      validateStatus: () => true,
      timeout: 30000
    };
    
    // Set the agent properly for axios
    if (url.startsWith('https:')) {
        requestConfig.httpsAgent = socksAgent;
    } else {
        requestConfig.httpAgent = socksAgent;
    }
    
    console.log('Proxy test request headers:', requestConfig.headers);
    console.log('Authorization header:', authorization.substring(0, 20) + '...');
    
    const response = await axios(requestConfig);
    
    console.log('Proxy test auth response:', response.status);
    if (response.status !== 200) {
      console.log('Proxy test error response:', response.data);
    }
    
    res.json({
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
  } catch (error) {
    console.error('Proxy test auth error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create an axios instance that ignores SSL certificate errors (for self-signed certs)
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 30000, // 30 second timeout
});

// Proxy all API requests to Grafana
app.all('/api/*', async (req, res) => {
  try {
      const grafanaUrl = req.headers["x-grafana-url"];
      const authorization = req.headers["authorization"];

      if (!grafanaUrl) {
          return res
              .status(400)
              .json({ error: "Missing X-Grafana-URL header" });
      }

      // Construct the full URL with query parameters
      let url = `${grafanaUrl}${req.path}`;

      // Add query parameters if they exist
      if (req.url.includes("?")) {
          const queryString = req.url.split("?")[1];
          url += `?${queryString}`;
      }

      console.log(`Proxying ${req.method} request to: ${url}`);
      
      // Debug: Verify URL components
      const urlParts = new URL(url);
      console.log(`URL protocol: ${urlParts.protocol}, host: ${urlParts.host}, path: ${urlParts.pathname}`);
      console.log(
          `Query parameters: ${
              req.url.includes("?") ? req.url.split("?")[1] : "none"
          }`
      );
      
      // Debug: Log authorization header (masked)
      if (authorization) {
          console.log(`Authorization header present: ${authorization.substring(0, 10)}...`);
          // Decode Basic auth to verify username (but not password)
          if (authorization.startsWith('Basic ')) {
              try {
                  const decoded = Buffer.from(authorization.substring(6), 'base64').toString();
                  const username = decoded.split(':')[0];
                  console.log(`Basic auth username: ${username}`);
              } catch (e) {
                  console.log('Failed to decode Basic auth');
              }
          }
      } else {
          console.log('No authorization header provided');
      }

      // Prepare headers to forward
      const headersToForward = {
          "Content-Type": req.headers["content-type"] || "application/json",
          Accept: "application/json",
          "User-Agent": req.headers["user-agent"] || "Grafana-Query-IDE/1.0",
      };
      
      // Add authorization header explicitly
      if (authorization) {
          headersToForward["Authorization"] = authorization;
      }

      // Forward specific Grafana headers if present
      if (req.headers["x-grafana-org-id"]) {
          headersToForward["X-Grafana-Org-Id"] =
              req.headers["x-grafana-org-id"];
      }

      if (req.headers["x-dashboard-uid"]) {
          headersToForward["X-Dashboard-Uid"] = req.headers["x-dashboard-uid"];
      }

      if (req.headers["x-panel-id"]) {
          headersToForward["X-Panel-Id"] = req.headers["x-panel-id"];
      }

      // Log request details for debugging
      if (req.body && Object.keys(req.body).length > 0) {
          console.log("Request body:", JSON.stringify(req.body, null, 2));
      }

      // Check for proxy configuration
      let requestConfig = {
          method: req.method,
          url: url,
          headers: headersToForward,
          data: req.body,
          timeout: 30000,
          httpsAgent: new https.Agent({
              rejectUnauthorized: false
          }),
          httpAgent: new http.Agent()
      };

      // Handle SOCKS5 proxy if configured
      if (req.headers['x-proxy-config']) {
          try {
              const proxyConfig = JSON.parse(req.headers['x-proxy-config']);
              console.log('Using SOCKS5 proxy:', proxyConfig.host + ':' + proxyConfig.port);
              console.log('Headers being forwarded:', Object.keys(headersToForward));
              console.log('Full headers object:', JSON.stringify(headersToForward, null, 2));
              
              // Build proxy URL
              let proxyUrl = 'socks5://';
              if (proxyConfig.username && proxyConfig.password) {
                  proxyUrl += `${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@`;
              }
              proxyUrl += `${proxyConfig.host}:${proxyConfig.port}`;
              
              // Create SOCKS proxy agent
              const socksAgent = new SocksProxyAgent(proxyUrl);
              
              // Set the agent properly for axios
              if (url.startsWith('https:')) {
                  requestConfig.httpsAgent = socksAgent;
                  // Remove the default HTTP agent
                  delete requestConfig.httpAgent;
              } else {
                  requestConfig.httpAgent = socksAgent;
                  // Remove the default HTTPS agent
                  delete requestConfig.httpsAgent;
              }
              
              // Debug: Log the actual request config
              console.log('Request config keys:', Object.keys(requestConfig));
              console.log('Headers being sent:', requestConfig.headers);
              console.log('Using SOCKS agent for URL:', url);
              
          } catch (error) {
              console.error('Error parsing proxy config:', error);
              return res.status(400).json({ error: 'Invalid proxy configuration' });
          }
      }

      // Add additional axios config options
      requestConfig.validateStatus = () => true; // Don't throw on any status code
      requestConfig.responseType = "json";
      
      // Only add transform response if not using proxy
      if (!req.headers['x-proxy-config']) {
          requestConfig.transformResponse = [
                  function (data) {
                      // Try to parse JSON, but return raw data if it fails
                      if (typeof data === "string") {
                          try {
                              return JSON.parse(data);
                          } catch (e) {
                              return data;
                          }
                      }
                      return data;
                  },
              ];
      }

      // Use plain axios instead of axiosInstance to avoid conflicting agent settings
      const response = await axios(requestConfig);

      // Log response status and basic info
      console.log(`Response status: ${response.status}`);
      
      // Debug: Log response headers for auth failures
      if (response.status === 401) {
          console.log('Response headers:', Object.keys(response.headers));
          if (response.headers['www-authenticate']) {
              console.log('WWW-Authenticate:', response.headers['www-authenticate']);
          }
      }
      
      if (response.status >= 400) {
          console.log(`Error response:`, response.data);
      }

      // Set CORS headers
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
      res.header(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, Content-Length, X-Requested-With, X-Grafana-URL, X-Grafana-Org-Id"
      );

      // Forward important headers from Grafana response
      const headersToForwardBack = [
          "content-type",
          "cache-control",
          "expires",
          "last-modified",
          "etag",
          "x-grafana-org-id",
          "x-frame-options",
      ];

      headersToForwardBack.forEach((header) => {
          if (response.headers[header]) {
              res.setHeader(header, response.headers[header]);
          }
      });

      // Send the response
      res.status(response.status).json(response.data);
  } catch (error) {
      console.error("Proxy error:", error.message);
      console.error("Error type:", error.constructor.name);
      console.error("Error code:", error.code);
      
      // Check if it's a SOCKS-specific error
      if (error.message && error.message.includes('SOCKS')) {
          console.error("SOCKS-specific error detected");
      }

      // Log more details about the error
      if (error.response) {
          console.error("Error response status:", error.response.status);
          console.error("Error response data:", error.response.data);
          console.error("Error response headers:", error.response.headers);
      } else if (error.request) {
          console.error("No response received:", error.request);
      }

      // Return appropriate error response
      let errorStatus = 500;
      let errorMessage = "Proxy error";
      let errorDetails = error.message;

      if (error.response) {
          errorStatus = error.response.status;
          errorMessage = error.response.statusText || "Request failed";
          errorDetails = error.response.data;
      } else if (error.code === "ECONNREFUSED") {
          errorStatus = 502;
          errorMessage = "Connection refused";
          errorDetails =
              "Cannot connect to Grafana server. Check if the URL is correct and the server is running.";
      } else if (error.code === "ENOTFOUND") {
          errorStatus = 502;
          errorMessage = "Host not found";
          errorDetails =
              "Cannot resolve Grafana hostname. Check if the URL is correct.";
      } else if (error.code === "ETIMEDOUT") {
          errorStatus = 504;
          errorMessage = "Request timeout";
          errorDetails = "Request to Grafana server timed out.";
      }

      res.status(errorStatus).json({
          error: errorMessage,
          message: errorDetails,
          details: error.response ? error.response.data : undefined,
      });
  }
});

// Handle preflight OPTIONS requests for CORS
app.options('/api/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, X-Grafana-URL, X-Grafana-Org-Id');
  res.sendStatus(200);
});

// Catch all route - serve the main page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║          Grafana Query IDE Server                  ║
╠════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}          ║
║  Health check: http://localhost:${PORT}/health       ║
║                                                    ║
║  Open http://localhost:${PORT} in your browser       ║
╚════════════════════════════════════════════════════╝
  `);
});