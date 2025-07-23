# Installation Guide

This guide will help you get Browser Explorer up and running on your system.

## Prerequisites

### System Requirements
- **Node.js**: Version 20.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Operating System**: macOS, Linux, or Windows
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: At least 2GB free space

### Optional Requirements
- **Docker**: For containerized deployment
- **PostgreSQL**: For persistent storage (included in Docker setup)
- **Redis**: For distributed crawling (included in Docker setup)

## Installation Methods

### Method 1: npm Installation (Recommended)

```bash
# Install globally
npm install -g browser-explorer

# Or install as a project dependency
npm install browser-explorer
```

### Method 2: From Source

```bash
# Clone the repository
git clone https://github.com/your-org/browser-explorer.git
cd browser-explorer

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### Method 3: Docker Installation

```bash
# Pull the Docker image
docker pull browser-explorer:latest

# Or build from source
git clone https://github.com/your-org/browser-explorer.git
cd browser-explorer
docker build -t browser-explorer .
```

## Initial Setup

### 1. Install Playwright Browsers

After installation, you need to install the browser binaries:

```bash
# Install all supported browsers
npx playwright install

# Or install specific browser
npx playwright install chromium
```

### 2. Environment Configuration

Create a `.env` file in your project root:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Application Configuration
NODE_ENV=development
LOG_LEVEL=info
PORT=3000

# Database Configuration (optional)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/browser_explorer

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# AI Configuration (required for AI features)
OPENAI_API_KEY=your_openai_api_key_here

# Crawler Configuration
MAX_CRAWL_DEPTH=3
MAX_PAGES=100
CRAWL_DELAY=1000
```

### 3. Database Setup (Optional)

If using PostgreSQL for persistent storage:

```bash
# Using Docker Compose
docker-compose up -d postgres

# Or manually
psql -U postgres -h localhost
CREATE DATABASE browser_explorer;
\q

# Run migrations
npm run db:migrate
```

## Quick Start

### Basic Usage

```bash
# Run with default configuration
browser-explorer crawl https://example.com

# With custom options
browser-explorer crawl https://example.com \
  --max-depth 3 \
  --max-pages 50 \
  --output ./tests
```

### Programmatic Usage

```javascript
const { CrawlerService } = require('browser-explorer');

async function main() {
  const crawler = new CrawlerService({
    startUrl: 'https://example.com',
    maxDepth: 3,
    maxPages: 100
  });

  await crawler.initialize();
  const results = await crawler.crawl();
  
  console.log(`Generated ${results.testsGenerated} test files`);
}

main().catch(console.error);
```

## Docker Setup

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  app:
    image: browser-explorer:latest
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/browser_explorer
    volumes:
      - ./output:/app/output
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: browser_explorer
    ports:
      - "5432:5432"
```

## Development Setup

### Clone and Install

```bash
# Clone repository
git clone https://github.com/your-org/browser-explorer.git
cd browser-explorer

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Running in Development Mode

```bash
# Start with hot reload
npm run dev

# Run with debugging
npm run dev:debug
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Verification

### Check Installation

```bash
# Check version
browser-explorer --version

# Run help command
browser-explorer --help

# Test basic functionality
browser-explorer test https://example.com
```

### Troubleshooting Installation

#### Common Issues

1. **Playwright Browser Installation Fails**
   ```bash
   # Try with sudo (Linux/macOS)
   sudo npx playwright install-deps
   
   # Or install system dependencies manually
   # Ubuntu/Debian
   sudo apt-get install libnss3 libatk1.0-0 libatk-bridge2.0-0
   ```

2. **Permission Errors**
   ```bash
   # Fix npm permissions
   sudo chown -R $(whoami) ~/.npm
   
   # Or use a Node version manager
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 20
   ```

3. **Memory Issues**
   ```bash
   # Increase Node memory limit
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

## Platform-Specific Instructions

### macOS

```bash
# Install prerequisites with Homebrew
brew install node@20 postgresql redis

# Install global package
npm install -g browser-explorer
```

### Ubuntu/Debian

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install system dependencies for Playwright
sudo npx playwright install-deps

# Install global package
sudo npm install -g browser-explorer
```

### Windows

```powershell
# Install with Chocolatey
choco install nodejs-lts postgresql redis

# Install global package
npm install -g browser-explorer

# Or use WSL2 for better compatibility
wsl --install
# Then follow Ubuntu instructions
```

## Next Steps

- [Quick Start Guide](./quick-start.md) - Start using Browser Explorer
- [Configuration Guide](./configuration.md) - Detailed configuration options
- [Docker Setup](./docker-setup.md) - Container deployment guide