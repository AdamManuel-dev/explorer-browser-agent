# Browser Explorer 🌐

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.49-blueviolet)](https://playwright.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

Browser Explorer is an AI-powered web browsing agent that automatically explores websites, tests interactive elements, and generates comprehensive Playwright test suites. Built with a modular architecture combining traditional crawling with AI-enhanced capabilities, it's designed to be the ultimate tool for automated web testing and exploration.

## 🚀 Features

### Core Capabilities
- **🔍 Intelligent Web Crawling**: Breadth-first search algorithm for systematic website exploration
- **🤖 AI-Powered Element Detection**: Hybrid AI + traditional detection for 25+ element types
- **🎯 Smart Interaction**: Automated interaction with forms, buttons, dropdowns, modals, and more
- **📸 Comprehensive Recording**: Complete user path capture with screenshots and timing
- **🧪 Test Generation**: Automatic Playwright/Cypress/Puppeteer test suite generation
- **📄 Page Object Model**: Clean, maintainable test structure with POM pattern

### Enterprise Features
- **🔐 Multi-Strategy Authentication**: Support for Basic, OAuth, MFA, and API key auth
- **🥷 Stealth Mode**: Advanced anti-bot detection evasion
- **🧩 CAPTCHA Handling**: Detection and solving capabilities
- **📊 Distributed Crawling**: Redis-based queue for scalable operations
- **🐳 Docker Support**: Full containerization with docker-compose
- **📈 Monitoring & Metrics**: Built-in observability and health checks

## 🎯 Current Status

### ✅ Implemented (70%)
- Complete infrastructure and crawling engine
- Traditional element detection and interaction
- Test generation pipeline with multiple frameworks
- Authentication system and session management
- CLI interface with comprehensive commands
- Docker containerization and deployment ready

### 🔴 Missing AI Components (30%)
- Mastra AI agent integration (shell classes only)
- Stagehand browser automation tools (not integrated)
- Natural language capabilities
- Self-healing test features

> **Note**: While the infrastructure is production-ready, the AI capabilities that differentiate this from traditional crawlers are pending integration. See [TODO.md](TODO.md) for the complete roadmap.

## 📦 Installation

### Prerequisites
- Node.js 20+ 
- Docker and Docker Compose (for full deployment)
- Redis (for distributed crawling)
- PostgreSQL (for data persistence)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/browser-explorer.git
cd browser-explorer

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Build the project
npm run build

# Run with Docker (recommended)
docker-compose up -d

# Or run locally
npm start
```

## 🎮 Usage

### CLI Commands

```bash
# Initialize configuration
browser-explorer init

# Crawl a website and generate tests
browser-explorer crawl https://example.com --output ./tests --depth 3

# Run specific test generation
browser-explorer test https://example.com/login --framework playwright

# Validate generated tests
browser-explorer validate ./tests

# Start monitoring dashboard
browser-explorer serve --port 3000

# Debug mode with verbose logging
browser-explorer debug https://example.com --verbose
```

### Programmatic API

```typescript
import { BrowserExplorer } from 'browser-explorer';

// Initialize the explorer
const explorer = new BrowserExplorer({
  headless: true,
  depth: 3,
  parallel: 5,
  stealth: true
});

// Start exploration
const results = await explorer.explore('https://example.com', {
  authentication: {
    strategy: 'basic',
    credentials: { username: 'user', password: 'pass' }
  },
  output: {
    directory: './generated-tests',
    framework: 'playwright'
  }
});

// Generate Page Object Model
await explorer.generatePageObjects(results);
```

## 🏗️ Architecture

```
Browser Explorer
├── CLI/API Layer         # User interfaces
├── Core Services         # Orchestration and workflow
├── Components           # Element detection, interaction, recording
├── Infrastructure      # Config, logging, metrics, storage
└── Runtime            # Playwright, Redis, Docker, Node.js
```

### Key Modules

- **Crawler Module**: BFS, resilient, and distributed crawling strategies
- **Detection Module**: AI-ready element detection with 25+ element types
- **Generation Module**: Multi-framework test generation with POM
- **Authentication Module**: Pluggable auth strategies and session management
- **Monitoring Module**: Metrics, traces, and health monitoring

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## 🛠️ Configuration

### Basic Configuration (browser-explorer.yml)

```yaml
crawler:
  depth: 3
  parallel: 5
  timeout: 30000
  respectRobotsTxt: true

detection:
  useAI: false  # Will be true when AI integration is complete
  fallbackToSelectors: true

generation:
  framework: playwright
  outputDir: ./tests
  generatePageObjects: true
  
browser:
  headless: true
  viewport:
    width: 1920
    height: 1080
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/browser_explorer

# Redis
REDIS_URL=redis://localhost:6379

# API Keys (when AI integration is complete)
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

## 🔧 Development

### Setup Development Environment

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run typecheck
```

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance

# Self-test the system
npm run self-test
```

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale crawler workers
docker-compose up -d --scale crawler=5

# Stop all services
docker-compose down
```

## 📊 Monitoring

The system includes comprehensive monitoring capabilities:

- **Metrics**: Application and infrastructure metrics
- **Tracing**: Distributed tracing for request flows
- **Health Checks**: Liveness, readiness, and dependency checks
- **Dashboards**: Built-in monitoring dashboard at `/metrics`

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Priorities

1. **Mastra AI Integration** - Implement proper AI agent configurations
2. **Stagehand Integration** - Add natural language browser control
3. **Self-Healing Tests** - AI-powered test maintenance
4. **Enhanced Detection** - Natural language element queries

## 📚 Documentation

- [Architecture Overview](ARCHITECTURE.md) - System design and patterns
- [API Reference](docs/api/README.md) - Detailed API documentation
- [CLI Guide](docs/cli/README.md) - Command-line interface reference
- [Configuration Guide](docs/configuration/README.md) - Configuration options
- [Gap Analysis](GAP_ANALYSIS_REPORT.md) - Current vs planned features

## 🐛 Known Issues

- AI agent classes are placeholder implementations (`as any` TypeScript bypasses)
- Stagehand integration not yet implemented
- Natural language features non-functional
- Self-healing capabilities pending

See [TODO.md](TODO.md) for the complete list of pending features.

## 📈 Roadmap

### Phase 1: Core AI Integration (Current Priority)
- [ ] Mastra agent implementation
- [ ] Stagehand tool integration
- [ ] Basic natural language support

### Phase 2: Enhanced AI Features
- [ ] Self-healing test capabilities
- [ ] AI-powered visual regression
- [ ] Intelligent assertion generation

### Phase 3: Production Features
- [ ] Multi-agent collaboration
- [ ] Advanced learning capabilities
- [ ] Enterprise integrations

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/) for browser automation
- Designed for [Mastra](https://mastra.dev/) AI framework integration
- Prepared for [Stagehand](https://github.com/browserbase/stagehand) natural language control

---

<p align="center">
  Made with ❤️ by the Browser Explorer Team
</p>

<p align="center">
  <a href="https://github.com/yourusername/browser-explorer/issues">Report Bug</a> •
  <a href="https://github.com/yourusername/browser-explorer/issues">Request Feature</a> •
  <a href="docs/">Documentation</a>
</p>