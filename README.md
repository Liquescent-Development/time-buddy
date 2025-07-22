<div align="center">

<img src="assets/logo.png" alt="Time Buddy Logo" width="180" height="180">

# Time Buddy

**Your time series metric agent**

[![Release](https://img.shields.io/github/v/release/Liquescent-Development/grafana-query-ide?style=flat-square)](https://github.com/Liquescent-Development/grafana-query-ide/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square)](https://github.com/Liquescent-Development/grafana-query-ide/releases)
[![License](https://img.shields.io/github/license/Liquescent-Development/grafana-query-ide?style=flat-square)](LICENSE)

*A powerful desktop IDE for modern time series query development with VS Code-like interface, AI-powered analytics, and seamless Grafana integration*

[📥 Download](https://github.com/Liquescent-Development/grafana-query-ide/releases) • [🚀 Quick Start](#-quick-start) • [📖 Documentation](#-features)

</div>

---

## 🎯 Why Choose Time Buddy?

**Stop switching between browser tabs.** Build and debug time series queries in a dedicated desktop environment designed for developers.

- 🖥️ **Native desktop app** - No more browser limitations
- 🧠 **AI-powered analytics** - Intelligent anomaly detection with visual analysis
- 🔍 **Smart schema explorer** - Click-to-insert with real-time discovery
- ⚡ **Advanced editor** - Syntax highlighting, autocomplete, and validation
- 📊 **Multiple visualizations** - Tables, charts, and log scale support
- 🗃️ **Connection management** - Securely manage multiple Grafana instances

## ✨ Features

### 🧠 **AI/ML Analytics** (New!)
- **Intelligent anomaly detection** powered by Ollama or OpenAI
- **Multiple AI providers** - Local Ollama models or cloud OpenAI API
- **Visual analysis mode** with chart-based AI insights  
- **Dynamic model selection** from available models
- **Time series preprocessing** with intelligent data subsampling
- **Saved analyses** for tracking anomaly patterns over time

### 🖥️ **Professional Query Environment**
- **VS Code-like interface** with tabbed editing and syntax highlighting
- **PromQL & InfluxQL support** with 40+ autocomplete functions
- **Real-time validation** and intelligent error detection
- **Multi-tab workflow** for complex query development
- **File system integration** - save/load .promql and .isql files

### 🔍 **Smart Data Discovery**
- **Interactive schema explorer** with click-to-insert functionality
- **Dynamic variable system** for reusable query components
- **Dashboard explorer** to extract and analyze existing queries
- **Connection-aware caching** for fast schema browsing

### 📊 **Advanced Visualization**
- **Multiple chart types** - line, bar, scatter plots with Chart.js
- **Log scale support** for handling extreme value ranges
- **Series management** for GROUP BY results
- **Export capabilities** for external analysis

### 🔐 **Enterprise-Ready**
- **Secure connection management** (passwords never stored)
- **SOCKS5 proxy support** for secure environments
- **Self-signed SSL handling** 
- **Cross-platform compatibility** (macOS, Windows, Linux)

## 📥 Quick Start

### Download & Install
1. **Download** the latest release for your platform:
   - [macOS](https://github.com/Liquescent-Development/grafana-query-ide/releases) (Intel & Apple Silicon)
   - [Windows](https://github.com/Liquescent-Development/grafana-query-ide/releases) (.exe installer)
   - [Linux](https://github.com/Liquescent-Development/grafana-query-ide/releases) (AppImage)

2. **Install** and launch the application

3. **Connect** to your Grafana instance:
   - Click "+" in Connections panel
   - Enter Grafana URL and credentials
   - Select your data source

4. **Start querying** with full autocomplete and syntax highlighting!

### AI Analytics Setup (Optional)

**Option 1: Local AI with Ollama**
1. **Install Ollama** from [ollama.ai](https://ollama.ai)
2. **Pull a model**: `ollama pull llama3.2`
3. **Configure Ollama connection** in the app with your local endpoint
4. **Enable visual analysis** for intelligent anomaly detection

**Option 2: Cloud AI with OpenAI**
1. **Get OpenAI API key** from [platform.openai.com](https://platform.openai.com)
2. **Configure OpenAI connection** in the app with your API key
3. **Select model** from available options (GPT-4, GPT-3.5-turbo, etc.)
4. **Run AI analysis** with cloud-powered insights

## 🛠️ Development

```bash
# Clone and install
git clone https://github.com/Liquescent-Development/grafana-query-ide.git
cd time-buddy
npm install

# Development mode
npm run electron-dev

# Build for all platforms  
npm run build-all
```

## 📚 Example Queries

**PromQL (Prometheus)**
```promql
# CPU usage with rate calculation
rate(cpu_usage_seconds_total[5m])

# Memory usage by container
sum(container_memory_usage_bytes) by (container_name)
```

**InfluxQL (InfluxDB)**
```sql
-- Temperature trends over time
SELECT mean("temperature") FROM "sensors" 
WHERE time > now() - 1h GROUP BY time(5m)
```

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Execute Query | `Ctrl/Cmd + Enter` |
| Save Query | `Ctrl/Cmd + S` |
| New Tab | `Ctrl/Cmd + N` |
| Auto-complete | `Ctrl + Space` |

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Electron Desktop│───▶│  Express Proxy  │───▶│ Grafana Instance│  
│                 │    │                 │    │                 │
│ • VS Code UI    │    │ • CORS Handling │    │ • Data Sources  │
│ • AI Analytics  │    │ • SSL Support   │    │ • Query API     │
│ • File System   │    │ • Authentication│    │ • Dashboards    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │
          ▼
┌─────────────────┐
│   AI Providers  │
│                 │
│ • Ollama (Local)│
│ • OpenAI (Cloud)│
│ • Vision Support│
└─────────────────┘
```

## 🤝 Contributing

We welcome contributions! Areas for enhancement:
- Additional AI providers and models
- Query optimization and performance monitoring  
- New visualization types and analysis modes
- Additional data source support

## 📄 License

This project is licensed under the GNU Affero General Public License v3.0 (AGPLv3).
See the [LICENSE](LICENSE) file for the full license text.

---

<div align="center">

**Built with ❤️ for the time series community**

[⭐ Star us on GitHub](https://github.com/Liquescent-Development/grafana-query-ide) • [🐛 Report Issues](https://github.com/Liquescent-Development/grafana-query-ide/issues) • [💬 Discussions](https://github.com/Liquescent-Development/grafana-query-ide/discussions)

</div>