const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');

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
      console.log(
          `Query parameters: ${
              req.url.includes("?") ? req.url.split("?")[1] : "none"
          }`
      );

      // Prepare headers to forward
      const headersToForward = {
          Authorization: authorization,
          "Content-Type": req.headers["content-type"] || "application/json",
          Accept: "application/json",
          "User-Agent": req.headers["user-agent"] || "Grafana-Query-IDE/1.0",
      };

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

      const response = await axiosInstance({
          method: req.method,
          url: url,
          headers: headersToForward,
          data: req.body,
          validateStatus: () => true, // Don't throw on any status code
          // Ensure we handle different response types
          responseType: "json",
          transformResponse: [
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
          ],
      });

      // Log response status and basic info
      console.log(`Response status: ${response.status}`);
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