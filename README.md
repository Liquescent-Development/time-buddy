# Grafana Query IDE

A powerful web-based IDE for executing InfluxQL and PromQL queries through the Grafana API. Features an advanced code editor with syntax highlighting, intelligent auto-completion, real-time validation, persistent connection management, dashboard exploration, guided workflow, and a built-in proxy to handle CORS issues.

## ✨ Key Features

### 🔐 **Advanced Authentication & Connection Management**
- **Persistent Connections**: Save and manage multiple Grafana server connections
- **Smart Connection Storage**: Store server details (name, URL, username) without passwords for security
- **Quick Connection Switching**: Dropdown selection between saved connections
- **Connection CRUD**: Create, edit, and delete saved connections with ease
- **Guided Workflow**: Auto-expanding sections guide users through connection → datasource → schema flow
- **Smart Section Management**: Collapsible sections with status indicators and automatic state transitions
- **Basic authentication support** for Grafana instances


## Demo

<img src="content/grafana_query_ide_demo.gif" style="max-height: 500px; width: auto;" alt="Demo">

### 📝 **Code Editor**
- **Syntax Highlighting**: 
  - Custom PromQL mode with comprehensive keyword and function highlighting
  - Full InfluxQL/SQL syntax highlighting with database-specific terms
  - Dark theme optimized for readability
- **Auto-completion**:
  - **PromQL**: 40+ functions including `rate()`, `histogram_quantile()`, `topk()`, aggregators, and operators
  - **InfluxQL**: 30+ SQL keywords, functions, and InfluxDB-specific commands
  - **Smart triggering**: Auto-suggestions as you type + manual trigger (Ctrl+Space)
- **Real-time Syntax Validation**:
  - **PromQL**: Bracket matching, time range syntax, query structure validation
  - **InfluxQL**: SQL structure validation, quote/parentheses matching
  - **Live error display**: Immediate feedback with clear error messages
- **Smart Editor Features**:
  - Line numbers and bracket matching
  - Auto-closing brackets and smart indentation
  - Code folding and line wrapping options

### 🤖 **Intelligent Query Management**
- **Auto Query Type Selection**: Automatically switches between InfluxQL/PromQL based on selected data source
- **Query Variables**: Define reusable variables with queries (like Grafana dashboards)
  - Create variables that populate with query results
  - Use `$variableName` or `${variableName}` in queries for dynamic substitution
  - Support for both PromQL and InfluxQL variable queries
  - **Connection-Scoped**: Variables are associated with specific connections for better organization
  - **Regex Filtering**: Apply regex patterns to extract parts of values
  - **Named Capture Groups**: Use `(?P<text>...)` and `(?P<value>...)` for display/value separation
  - **Multi-Value Variables**: Select multiple values for use in regex patterns or IN clauses
  - **Sidebar Integration**: Always-visible variables panel in organized sidebar layout
- **Dashboard Explorer**: Discover and analyze existing Grafana dashboards
  - **Search Dashboards**: Find dashboards by name across your Grafana instance
  - **Query Extraction**: Automatically extract all queries from dashboard panels
  - **Tabbed Interface**: Organize and view multiple queries per dashboard with dedicated tabs
  - **Query Analysis**: View query details including datasource, expression, and panel context
  - **Copy to Editor**: One-click copying of dashboard queries to the query editor
  - **Execute Dashboard Queries**: Direct execution of extracted queries for analysis
  - **Recursive Panel Support**: Handles nested panels and row panels automatically
- **Schema Explorer**: Interactive database schema discovery
  - **Prometheus**: Browse all available metrics and labels with search
  - **InfluxDB**: 
    - Dropdown selectors for retention policies and measurements
    - Searchable fields and tags lists
    - Loading indicators for async schema discovery
  - Click-to-insert functionality for faster query building
  - **Bottom-Right Refresh**: Unobtrusive refresh button positioned for optimal workflow
  - **Auto-Expand**: Automatically expands when datasource is selected
- **Enhanced Query History**:
  - **Sidebar Layout**: Dedicated sidebar section for easy access alongside variables
  - **Search**: Full-text search across queries, labels, and tags
  - **Favorites**: Star important queries for quick access
  - **Labels & Tags**: Organize queries with custom labels and tags
  - **Advanced Filtering**: Filter by favorites, tags, or search terms
  - **Edit & Delete**: Manage individual history items
  - **Equal Height Distribution**: 50/50 height split with variables in sidebar
  - Persistent storage with increased capacity (100 items)
- **Smart data source discovery** for InfluxDB and Prometheus
- **Visual notifications** for auto-selections and important actions

### 📊 **Data Visualization**
- **Dual View Modes**: Clean table view and interactive chart visualization
- **Multi-series Support**: Handle GROUP BY results with series selection
- **Smart Pagination**: Configurable page sizes (25-500 rows) with navigation
- **Interactive Charts**: Line, bar, and scatter plots with Chart.js integration
- **Statistical Summaries**: Automatic group statistics and data insights

### 🚀 **Performance & Reliability**
- **Built-in CORS proxy** with automatic SSL certificate handling
- **Docker support** for easy deployment and containerization
- **Optimized API handling** with proper error reporting and timeout management
- **Responsive design** that works on desktop, tablet, and mobile
- **Guided User Experience**: Smart section management with auto-expand/collapse workflow
- **Resizable Query Editor**: Adjustable editor height for complex queries

## Quick Start with Docker

The easiest way to run Grafana Query IDE is with Docker:

```bash
# Clone the repository
git clone https://github.com/yourusername/grafana-query-ide.git
cd grafana-query-ide

# Start with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t grafana-query-ide .
docker run -d -p 3000:3000 --name grafana-query-ide grafana-query-ide
```

Open http://localhost:3000 in your browser.

## Usage Guide

### 1. **Guided Workflow Experience**
   The application features a guided workflow that automatically expands relevant sections as you progress:
   - **On Page Load**: Authentication section is expanded and ready for connection
   - **After Connection**: Authentication collapses, Data Source section expands for selection
   - **After Data Source Selection**: Data Source collapses, Schema Explorer expands for browsing
   - **Dashboard Explorer**: Available as a separate collapsible section for dashboard analysis

### 2. **Connection Management**
   - **First Time**: Click "New Connection" to add your first Grafana server
   - **Save Details**: Enter connection name, URL, and default username (password never saved)
   - **Quick Access**: Use the dropdown to switch between saved connections
   - **Management**: Edit or delete connections as needed

### 3. **Connect to Grafana**
   - Select a saved connection or enter details manually
   - Enter your password (required each time for security)
   - Click "Connect" - the system will verify credentials and load data sources
   - **Auto-Flow**: Authentication section auto-collapses and shows connection status

### 4. **Dashboard Explorer (Optional)**
   - **Expand Section**: Click "Show" to expand the Dashboard Explorer section
   - **Search Dashboards**: Type dashboard names to search across your Grafana instance
   - **Select Dashboard**: Click on a dashboard from search results to load its queries
   - **Tabbed Query View**: Each dashboard query appears in its own tab with:
     - Panel title and query reference ID
     - Data source information
     - Complete query expression
     - Copy to editor and execute actions
   - **Query Analysis**: Understand how existing dashboards structure their queries
   - **Learning Tool**: Study complex queries from production dashboards

### 5. **Query Variables (Optional)**
   - **Sidebar Location**: Variables are now located in the right sidebar alongside query history
   - **Connection-Scoped**: Variables are automatically filtered by the current connection
   - **Always Visible**: Variables section is always expanded for easy access
   - **Create Variables**: Define reusable query variables for dynamic queries
     - Click "Add Variable" to create a new variable
     - Name your variable and write a query that returns values
     - Apply optional regex to filter/transform values
     - Enable multi-select for variables used in regex or IN clauses
   - **Use Variables**: Reference variables in queries with `$variableName` or `${variableName}` syntax
   - **Advanced Features**:
     - **Regex Filtering**: Extract parts of values using regex patterns
     - **Named Groups**: Use `(?P<text>Display)_(?P<value>ActualValue)` for separate display/value
     - **Multi-Select**: Enable for variables that need multiple values
   - **Examples**:
     - Create `$region` variable with query `label_values(region)`
     - Use in queries: `cpu_usage{region="$region"}`
     - Multi-value usage: `host =~ /${hosts}/` expands to `host =~ /(host1|host2|host3)/`

### 6. **Schema Explorer**
   - **Auto-Expand**: Automatically expands when you select a data source (guided workflow)
   - **Automatic Discovery**: Schema loads automatically when you select a data source
   - **Prometheus Mode**:
     - Browse all available metrics with search functionality
     - View common labels across your metrics
     - Click any metric or label to insert into query editor
   - **InfluxDB Mode**:
     - Select retention policy from dropdown
     - Select measurement from dropdown to load fields and tags
     - Search through fields and tags with real-time filtering
     - Loading indicators show when schema is being fetched
   - **Refresh Button**: Unobtrusive refresh button positioned at bottom-right of container
   - **Workspace Management**: Collapse schema explorer to save screen space

### 7. **Smart Query Writing**
   - **Auto-Selection**: Query type automatically switches based on selected data source
     - Prometheus data sources → PromQL mode
     - InfluxDB data sources → InfluxQL mode
   - **Code Assistance**: 
     - Syntax highlighting shows keywords, functions, and operators in color
     - Auto-completion appears as you type (or press Ctrl+Space)
     - Real-time validation shows syntax errors immediately
   - **Variable Substitution**:
     - Single values: `$variable` or `${variable}`
     - Multi-values in regex: `=~ /${hosts}/` → `=~ /(host1|host2|host3)/`
     - Multi-values in IN: `IN (${regions})` → `IN ('us-east', 'us-west')`
   - **Advanced Features**:
     - Bracket matching and auto-closing
     - Smart indentation and line numbers
     - Professional dark theme for extended coding sessions

### 8. **Execute and Analyze**
   - Click "Execute Query" to run your query
   - **Resizable Editor**: Drag the bottom edge of the query editor to adjust height for complex queries
   - **View Options**:
     - **Table View**: Paginated results with configurable page sizes
     - **Chart View**: Interactive visualizations with multiple chart types
   - **Multi-Series**: Handle GROUP BY results with easy series switching
   - **Export Options**: View raw JSON response for debugging

### 9. **Enhanced Query History**
   - **Sidebar Layout**: Located in the right sidebar with 50/50 height split with variables
   - **Search & Filter**:
     - Full-text search across queries, labels, and tags
     - Filter to show only favorite queries
     - Click tags to filter by specific tags
   - **Organization**:
     - Star queries to mark as favorites
     - Add descriptive labels to queries
     - Tag queries with multiple tags for categorization
   - **Management**:
     - Edit labels and tags on existing queries
     - Delete individual queries from history
     - Clear all history when needed
   - Query type and data source information preserved
   - Increased storage capacity (100 queries)

## Example Queries

### InfluxQL (Auto-selected for InfluxDB data sources)
```sql
-- Time series aggregation
SELECT mean("value") FROM "temperature" WHERE time > now() - 1h GROUP BY time(5m)

-- Multi-measurement query
SELECT * FROM "cpu", "memory" WHERE host = 'server1' AND time > now() - 24h

-- Advanced aggregation with grouping
SELECT max("usage_percent") FROM "cpu" WHERE time > now() - 6h GROUP BY "host", time(10m)

-- Using variables in InfluxQL
SELECT mean("value") FROM "$measurement" WHERE "host" = '$host' AND time > now() - 1h

-- Using multi-value variables with regex
SELECT * FROM "metrics" WHERE host =~ /${hosts}/ AND time > now() - 1h

-- Using multi-value variables with IN clause
SELECT mean("value") FROM "temperature" WHERE region IN (${regions}) GROUP BY region
```

### PromQL (Auto-selected for Prometheus data sources)
```promql
# Basic metric query
up{job="prometheus"}

# Rate calculation with time range
rate(http_requests_total[5m])

# Advanced aggregation with grouping
sum(rate(container_cpu_usage_seconds_total[5m])) by (container_name)

# Histogram quantile calculation
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Using variables in PromQL
cpu_usage{instance="$instance", job="$job"}
rate(http_requests_total{region="$region"}[5m])

# Using multi-value variables with regex
cpu_usage{host=~"${hosts}"}  # Expands to host=~"host1|host2|host3"
```

### Variable Query Examples
```promql
# PromQL variable queries (for populating variable dropdowns)
label_values(instance)              # Get all instance values
label_values(cpu_usage, job)        # Get all job values from cpu_usage metric
query_result(up)                    # Get results from up metric
```

```sql
-- InfluxQL variable queries (for populating variable dropdowns)
SHOW MEASUREMENTS                   -- Get all measurements
SHOW TAG VALUES FROM "cpu" WITH KEY = "host"  -- Get all host values
SHOW FIELD KEYS FROM "cpu"          -- Get all field names
```

### Variable Regex Examples
```
# Extract region from hostname
Regex: (?P<text>[\w-]+)-(?P<value>[\w-]+)-\d+
Input: us-east-1-server-001
Result: Display="us-east", Value="1"

# Simple extraction (first capture group)
Regex: ^([^-]+)
Input: prod-server-01
Result: "prod"

# Named groups for display/value separation
Regex: (?P<text>[^_]+)_(?P<value>.+)
Input: Production_Environment_prod01
Result: Display="Production", Value="Environment_prod01"
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │────▶│  Express Server │────▶│ Grafana Instance│
│ (Enhanced IDE)  │     │ (CORS Proxy)    │     │   (Your API)    │
│                 │     │                 │     │                 │
│ • Code Editor   │     │ • CORS Handling │     │ • Data Sources  │
│ • Syntax Check  │     │ • SSL Support   │     │ • Authentication│
│ • Auto-complete │     │ • Error Handling│     │ • Query API     │
│ • Connections   │     │                 │     │                 │
│ • Variables     │     │                 │     │                 │
│ • Schema Explor │     │                 │     │                 │
│ • History Mgmt  │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         Port 3000              │
                               │
                        Handles CORS,
                        SSL certificates,
                        Authentication,
                        Request proxying
```

## Advanced Features

### Connection Security
- **No Password Storage**: Passwords are never saved to browser storage
- **Secure Transmission**: Credentials transmitted over HTTPS when available
- **Connection Validation**: Real-time connection testing with detailed error reporting

### Code Editor Capabilities
- **Multi-language Support**: Dedicated modes for PromQL and InfluxQL
- **Real-time Validation**: Syntax checking with immediate error feedback
- **Smart Assistance**: Context-aware auto-completion and suggestions
- **Professional Features**: Line numbers, bracket matching, code folding

### Query Management
- **Auto-Detection**: Query language automatically selected based on data source type
- **History Persistence**: Query history preserved across browser sessions with enhanced features
- **Smart Defaults**: Reasonable default values for time ranges and query options
- **Variable System**: Advanced variable management with regex and multi-value support

### Data Visualization
- **Responsive Charts**: Interactive charts that adapt to screen size
- **Multiple Chart Types**: Line, bar, and scatter plot visualizations
- **Series Management**: Easy handling of multi-series data from GROUP BY queries
- **Export Options**: Raw data access for external analysis

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Node environment (default: production)

## Security Notes

- **Authentication**: Basic auth credentials transmitted securely over HTTPS
- **No Password Persistence**: Passwords never stored in browser or server
- **SSL Handling**: Proxy accepts self-signed certificates (use caution in production)
- **CORS Protection**: All API requests proxied through server to handle CORS
- **Input Validation**: Query syntax validation helps prevent malformed requests

## File Structure

```
grafana-query-ide/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── server.js
├── README.md
├── CLAUDE.md                   # AI assistant instructions
└── public/
    ├── index.html              # Clean HTML structure
    ├── css/
    │   └── main.css            # All styles in one organized file
    └── js/
        ├── config.js           # Global configuration and constants
        ├── utils.js            # Utility functions
        ├── storage.js          # localStorage management
        ├── api.js              # API communication
        ├── editor.js           # CodeMirror editor functionality
        ├── connections.js      # Connection management
        ├── variables.js        # Query variables management
        ├── schema.js           # Schema explorer functionality
        ├── dashboard.js        # Dashboard explorer and query extraction
        ├── queries.js          # Query execution and results
        ├── charts.js           # Chart visualization
        ├── history.js          # Query history management
        └── app.js              # Main app initialization
```

## Troubleshooting

### Connection Issues
- **401 Unauthorized**: Verify username and password are correct
- **404 Not Found**: Check Grafana URL format (include https://)
- **CORS Errors**: Ensure using Docker container with integrated proxy
- **SSL Certificate**: Proxy handles self-signed certificates automatically

### Query Issues
- **Syntax Errors**: Check real-time validation messages below editor
- **No Data**: Verify data source permissions and query time range
- **Performance**: Adjust max data points and interval for large datasets
- **Auto-completion**: Press Ctrl+Space if suggestions don't appear automatically
- **Variable Substitution**: Ensure variables are defined and have selected values
- **Multi-Value Variables**: Enable multi-select checkbox for regex or IN clause usage
- **Schema Not Loading**: Check data source connection and permissions

### Editor Issues
- **Syntax Highlighting**: Refresh page if highlighting appears incorrect
- **Auto-completion**: Verify correct query type is selected (auto-selected by data source)
- **Validation Errors**: Check bracket matching and query structure

### Schema Explorer Issues
- **InfluxDB Schema**: Select retention policy and measurement to load fields/tags
- **Loading Delays**: Schema discovery may take time for large databases
- **Search Not Working**: Ensure JavaScript is enabled and no console errors

## Browser Compatibility

- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Features**: ES6+ support required for advanced editor features
- **Storage**: LocalStorage used for connections, variables, and query history
- **Performance**: Optimized for desktop use, mobile-friendly interface

## Development

To modify the application:

1. **UI Changes**: Edit `public/index.html` for interface modifications
2. **Server Changes**: Edit `server.js` for proxy and API handling
3. **Dependencies**: Update `package.json` for new NPM packages
4. **Rebuild**: 
   ```bash
   docker-compose build
   docker-compose up -d
   ```

## Contributing

We welcome contributions! Areas for enhancement:
- Additional query language support (LogQL, etc.)
- Advanced query optimization suggestions
- Query performance monitoring
- Additional chart types and visualizations
- Keyboard shortcuts and productivity features
- Export/import functionality for queries and variables

Please feel free to submit a Pull Request with your improvements.

## License

MIT License - feel free to use this in your own projects!

---

**Latest Updates:**
- 🎯 **Dashboard Explorer**: Search dashboards and extract all queries with tabbed interface
- 🧭 **Guided Workflow**: Auto-expanding sections guide users through connection → datasource → schema flow
- 📱 **Sidebar Reorganization**: History and variables moved to dedicated sidebar with 50/50 height split
- 🔗 **Connection-Scoped Variables**: Variables automatically filtered by current connection
- 📏 **Resizable Query Editor**: Drag to adjust editor height for complex queries
- 🔄 **Smart Section Management**: Auto-collapse/expand with status indicators
- 🎨 **UI Polish**: Refresh button repositioned, improved spacing and section flow
- 🏷️ **Enhanced Query History**: Search, tag, label, and favorite your queries in sidebar
- 🔍 **Improved Schema Explorer**: Better UI with dropdowns and bottom-right refresh button
- 🎯 **Multi-Value Variables**: Support for regex patterns and IN clauses with sidebar integration
- 🔧 **Regex Variable Filtering**: Extract and transform variable values with regex
- 📊 **Better Organization**: Always-visible variables and history with increased capacity