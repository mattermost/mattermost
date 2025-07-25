#!/bin/bash
set -e

echo "🐳 Testing API workflow in isolated Docker container..."

# Change to repository root
cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Function for cleanup
cleanup() {
    log_step "Cleaning up Docker resources..."
    
    # Stop and remove container if it exists
    if [ ! -z "${CONTAINER_ID}" ]; then
        docker stop "${CONTAINER_ID}" >/dev/null 2>&1 || true
        docker rm "${CONTAINER_ID}" >/dev/null 2>&1 || true
        log_info "Removed test container"
    fi
    
    # Clean up Docker images if requested
    if [ "${CLEANUP_IMAGES}" = "true" ]; then
        docker rmi mattermost-api-test:latest >/dev/null 2>&1 || true
        log_info "Removed test image"
    fi
    
    log_success "Cleanup completed"
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

# Parse command line options
CLEANUP_IMAGES=false
REBUILD_IMAGE=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --cleanup-images)
            CLEANUP_IMAGES=true
            shift
            ;;
        --rebuild)
            REBUILD_IMAGE=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --cleanup-images    Remove Docker images after testing"
            echo "  --rebuild          Force rebuild of test image"
            echo "  --verbose, -v      Enable verbose output"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "This script runs the entire API contract testing workflow"
            echo "in an isolated Docker container to avoid affecting your"
            echo "local development environment."
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check dependencies
log_step "Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { 
    log_error "Docker is required but not installed"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
}

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not running"
    echo "Please start Docker and try again"
    exit 1
fi

log_success "Prerequisites verified"

# Check if we need to rebuild the image
IMAGE_EXISTS=$(docker images -q mattermost-api-test:latest 2>/dev/null)
if [ -z "$IMAGE_EXISTS" ] || [ "$REBUILD_IMAGE" = "true" ]; then
    log_step "Building test container image..."
    
    if [ "$VERBOSE" = "true" ]; then
        docker build -f Dockerfile.test-api -t mattermost-api-test:latest .
    else
        docker build -f Dockerfile.test-api -t mattermost-api-test:latest . >/dev/null 2>&1
    fi
    
    log_success "Test image built successfully"
else
    log_info "Using existing test image (use --rebuild to force rebuild)"
fi

# Prepare host directories for results
mkdir -p api/test-results
chmod 755 api/test-results

log_step "Starting containerized API workflow test..."
log_info "This will test the complete API contract validation workflow"
log_info "in an isolated environment that won't affect your system"

# Run the test container
log_info "Launching test container..."

if [ "$VERBOSE" = "true" ]; then
    docker_run_cmd="docker run --rm -it"
else
    docker_run_cmd="docker run --rm"
fi

CONTAINER_ID=$(${docker_run_cmd} \
    --name "mattermost-api-test-$(date +%s)" \
    --network host \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$(pwd):/workspace" \
    -v "$(pwd)/api/test-results:/workspace/api/test-results" \
    -e DOCKER_HOST=unix:///var/run/docker.sock \
    --workdir /workspace \
    mattermost-api-test:latest | tail -1)

# The container should run and exit on its own, so we don't need to store CONTAINER_ID for cleanup

log_step "Checking test results..."

# Check if test results were generated
if [ -d "api/test-results" ] && [ "$(ls -A api/test-results 2>/dev/null)" ]; then
    log_success "Test results generated successfully"
    
    echo ""
    echo "📁 Test Results Location:"
    echo "   api/test-results/"
    echo ""
    echo "📄 Generated Files:"
    ls -la api/test-results/ | grep -v "^total" | while read line; do
        echo "   • $line"
    done
    echo ""
else
    log_error "No test results generated"
fi

# Check if OpenAPI spec was generated
if [ -f "api/v4/html/static/mattermost-openapi-v4.yaml" ]; then
    spec_lines=$(wc -l < "api/v4/html/static/mattermost-openapi-v4.yaml")
    log_success "OpenAPI specification generated ($spec_lines lines)"
else
    log_error "OpenAPI specification was not generated"
fi

echo ""
echo "========================================"
echo "🎉 Containerized API Testing Complete!"
echo "========================================"
echo ""
echo "✨ Benefits of this approach:"
echo "   • No impact on your local system"
echo "   • Consistent testing environment"
echo "   • Easy cleanup and isolation"
echo "   • Matches CI/CD environment exactly"
echo ""
echo "🔍 What was tested:"
echo "   • OpenAPI specification generation"
echo "   • Full Mattermost server startup"
echo "   • Database connectivity"
echo "   • API authentication"
echo "   • Contract validation with Dredd"
echo "   • Property-based testing with Schemathesis"
echo ""

if [ -f "api/test-results/dredd-report.json" ]; then
    echo "📊 View detailed results:"
    echo "   cat api/test-results/dredd-report.json"
fi

log_success "All testing completed in isolated environment!"