# Docker Setup Guide

This guide covers running Browser Explorer in Docker containers for consistent, scalable deployments.

## Overview

Browser Explorer provides Docker images and docker-compose configurations for both development and production environments. The containerized setup includes all required services: the main application, PostgreSQL database, and Redis queue.

## Quick Start with Docker Compose

### 1. Basic Setup

```bash
# Clone the repository
git clone https://github.com/your-org/browser-explorer.git
cd browser-explorer

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 2. Run a Crawl

```bash
# Execute crawl in container
docker-compose exec app browser-explorer crawl https://example.com

# Or run a one-off container
docker run --rm -v $(pwd)/output:/app/output \
  browser-explorer crawl https://example.com
```

## Docker Images

### Pre-built Images

```bash
# Pull latest stable version
docker pull browser-explorer:latest

# Pull specific version
docker pull browser-explorer:1.2.3

# Pull development version
docker pull browser-explorer:develop
```

### Building from Source

```bash
# Build production image
docker build -t browser-explorer:custom .

# Build development image with hot reload
docker build -f Dockerfile.dev -t browser-explorer:dev .
```

## Docker Compose Configurations

### Production Configuration

`docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    image: browser-explorer:latest
    container_name: browser-explorer
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/browser_explorer
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=info
    volumes:
      - ./generated-tests:/app/generated-tests
      - ./config:/app/config
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - browser-explorer-network

  postgres:
    image: postgres:15-alpine
    container_name: browser-explorer-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: browser_explorer
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - browser-explorer-network

  redis:
    image: redis:7-alpine
    container_name: browser-explorer-redis
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    networks:
      - browser-explorer-network

volumes:
  postgres-data:
  redis-data:

networks:
  browser-explorer-network:
    driver: bridge
```

### Development Configuration

`docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev
    environment:
      - NODE_ENV=development
      - DEBUG=browser-explorer:*
    ports:
      - "3000:3000"
      - "9229:9229"  # Debug port

  # Additional development tools
  redis-commander:
    image: rediscommander/redis-commander:latest
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis

  pgadmin:
    image: dpage/pgadmin4:latest
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
```

## Environment Variables

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379

# AI Services (for AI features)
OPENAI_API_KEY=your-api-key
```

### Optional Variables

```env
# Application
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Crawler
MAX_CRAWL_DEPTH=3
MAX_PAGES=100
CRAWL_DELAY=1000
PARALLEL_WORKERS=5

# Browser
HEADLESS_MODE=true
BROWSER_TIMEOUT=30000

# Output
OUTPUT_DIRECTORY=/app/generated-tests
GENERATE_PAGE_OBJECTS=true
```

## Volume Mounts

### Important Directories

```yaml
volumes:
  # Generated test output
  - ./generated-tests:/app/generated-tests
  
  # Configuration files
  - ./config:/app/config
  
  # Custom scripts
  - ./scripts:/app/scripts
  
  # Temporary files
  - ./temp:/app/temp
```

### Persistent Data

```yaml
volumes:
  # Database data
  - postgres-data:/var/lib/postgresql/data
  
  # Redis data
  - redis-data:/data
  
  # Application logs
  - ./logs:/app/logs
```

## Networking

### Default Network

All services communicate on the `browser-explorer-network` bridge network:

```yaml
networks:
  browser-explorer-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Service Discovery

Services can communicate using container names:
- `postgres:5432` - Database
- `redis:6379` - Cache/Queue
- `app:3000` - Main application

## Running Commands

### Execute Commands in Container

```bash
# Run crawler
docker-compose exec app browser-explorer crawl https://example.com

# Run tests
docker-compose exec app npm test

# Access shell
docker-compose exec app sh

# Run database migrations
docker-compose exec app npm run db:migrate
```

### One-off Commands

```bash
# Run without starting services
docker run --rm -v $(pwd):/app browser-explorer test

# With custom environment
docker run --rm \
  -e MAX_PAGES=10 \
  -v $(pwd)/output:/app/output \
  browser-explorer crawl https://example.com
```

## Scaling

### Horizontal Scaling

```bash
# Scale crawler workers
docker-compose up -d --scale app=3

# With load balancer
docker-compose -f docker-compose.yml \
  -f docker-compose.scale.yml up -d
```

`docker-compose.scale.yml`:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
    depends_on:
      - app

  app:
    deploy:
      replicas: 3
    ports: []  # Remove host port mapping
```

## Monitoring

### Health Checks

```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Logging

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Metrics with Prometheus

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
```

## Production Deployment

### Security Hardening

```dockerfile
# Run as non-root user
USER node

# Read-only root filesystem
docker run --read-only --tmpfs /tmp

# Drop capabilities
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE

# Security scanning
docker scan browser-explorer:latest
```

### Resource Limits

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

### Backup Strategy

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres browser_explorer > backup.sql

# Backup volumes
docker run --rm -v postgres-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Troubleshooting

### Common Issues

1. **Browser Issues in Container**
   ```dockerfile
   # Ensure all dependencies are installed
   RUN apt-get update && apt-get install -y \
     libnss3 libatk1.0-0 libatk-bridge2.0-0 \
     libcups2 libxcomposite1 libxdamage1
   ```

2. **Permission Issues**
   ```bash
   # Fix volume permissions
   docker-compose exec app chown -R node:node /app/generated-tests
   ```

3. **Memory Issues**
   ```yaml
   # Increase shared memory for Chrome
   shm_size: '2gb'
   ```

### Debug Mode

```bash
# Enable debug logging
docker-compose exec app sh
export DEBUG=browser-explorer:*
npm run dev

# Or with Node inspector
docker-compose exec app node --inspect=0.0.0.0:9229 dist/index.js
```

### View Container Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100 app
```

## Best Practices

1. **Use Specific Tags**
   ```yaml
   image: browser-explorer:1.2.3  # Not :latest
   ```

2. **Separate Configs**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
   ```

3. **Environment Files**
   ```bash
   docker-compose --env-file .env.production up
   ```

4. **Regular Updates**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

## Next Steps

- [Configuration Guide](./configuration.md) - Detailed configuration options
- [Production Guide](./production.md) - Production deployment
- [Monitoring Guide](./monitoring.md) - Monitoring and observability