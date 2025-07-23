#!/bin/bash

# Browser Explorer Docker Build Script
# Usage: ./scripts/build-docker.sh [target] [tag] [push]

set -e

# Configuration
IMAGE_NAME="browser-explorer"
REGISTRY="${DOCKER_REGISTRY:-ghcr.io/browser-explorer}"
DEFAULT_TAG="${DOCKER_TAG:-latest}"

# Parse arguments
TARGET="${1:-production}"
TAG="${2:-$DEFAULT_TAG}"
PUSH="${3:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate target
case $TARGET in
    development|dev)
        TARGET="development"
        ;;
    production|prod)
        TARGET="production"
        ;;
    testing|test)
        TARGET="testing"
        ;;
    *)
        log_error "Invalid target: $TARGET. Must be one of: development, production, testing"
        exit 1
        ;;
esac

# Build info
log_info "Building Docker image with the following configuration:"
echo "  Target: $TARGET"
echo "  Image: $REGISTRY/$IMAGE_NAME:$TAG"
echo "  Push: $PUSH"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create build context
log_info "Preparing build context..."

# Ensure required directories exist
mkdir -p generated-tests reports screenshots logs

# Build the image
log_info "Building Docker image for target: $TARGET"

if [ "$TARGET" = "development" ]; then
    # Development build with volume mounts
    docker build \
        --target development \
        --tag "$REGISTRY/$IMAGE_NAME:dev-$TAG" \
        --tag "$REGISTRY/$IMAGE_NAME:dev-latest" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
        --build-arg VERSION="$TAG" \
        .

    log_success "Development image built successfully"
    
    if [ "$PUSH" = "true" ]; then
        log_info "Pushing development image..."
        docker push "$REGISTRY/$IMAGE_NAME:dev-$TAG"
        docker push "$REGISTRY/$IMAGE_NAME:dev-latest"
        log_success "Development image pushed successfully"
    fi

elif [ "$TARGET" = "production" ]; then
    # Production build
    docker build \
        --target production \
        --tag "$REGISTRY/$IMAGE_NAME:$TAG" \
        --tag "$REGISTRY/$IMAGE_NAME:latest" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
        --build-arg VERSION="$TAG" \
        .

    log_success "Production image built successfully"
    
    if [ "$PUSH" = "true" ]; then
        log_info "Pushing production image..."
        docker push "$REGISTRY/$IMAGE_NAME:$TAG"
        docker push "$REGISTRY/$IMAGE_NAME:latest"
        log_success "Production image pushed successfully"
    fi

elif [ "$TARGET" = "testing" ]; then
    # Testing build
    docker build \
        --target testing \
        --tag "$REGISTRY/$IMAGE_NAME:test-$TAG" \
        --tag "$REGISTRY/$IMAGE_NAME:test-latest" \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
        --build-arg VERSION="$TAG" \
        .

    log_success "Testing image built successfully"
    
    # Run tests
    log_info "Running tests in container..."
    if docker run --rm "$REGISTRY/$IMAGE_NAME:test-$TAG"; then
        log_success "All tests passed"
    else
        log_error "Tests failed"
        exit 1
    fi
    
    if [ "$PUSH" = "true" ]; then
        log_info "Pushing testing image..."
        docker push "$REGISTRY/$IMAGE_NAME:test-$TAG"
        docker push "$REGISTRY/$IMAGE_NAME:test-latest"
        log_success "Testing image pushed successfully"
    fi
fi

# Show image info
log_info "Image details:"
docker images "$REGISTRY/$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Cleanup old images
log_info "Cleaning up old images..."
docker image prune -f

log_success "Docker build completed successfully!"

# Usage examples
echo ""
log_info "Usage examples:"
echo "  Development: ./scripts/build-docker.sh development"
echo "  Production:  ./scripts/build-docker.sh production v1.0.0"
echo "  Testing:     ./scripts/build-docker.sh testing"
echo "  With push:   ./scripts/build-docker.sh production v1.0.0 true"
echo ""
echo "Docker Compose usage:"
echo "  Development: docker-compose --profile dev up"
echo "  Production:  docker-compose --profile prod up"
echo "  Testing:     docker-compose --profile test up"
echo "  Admin tools: docker-compose --profile admin up"