#!/bin/bash

# Create directory structure
echo "Setting up Grafana Query IDE..."

# Create directories
mkdir -p grafana-query-ide/public

# Move to project directory
cd grafana-query-ide

# Create all the necessary files
echo "Creating project files..."

# Save the HTML file (you'll need to save the content from the artifact)
# The index.html content should be saved to public/index.html

# Make the script executable
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Save the HTML content from the Grafana Query IDE artifact to: public/index.html"
echo "2. Run: docker-compose up -d"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "Or run without Docker:"
echo "1. npm install"
echo "2. npm start"