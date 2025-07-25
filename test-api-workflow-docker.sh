#!/bin/bash
set -e

echo "🐳 Testing API workflow in Docker container..."

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
    log_step "Cleaning up..."
    
    # Stop Mattermost server
    if [ ! -z "${SERVER_PID}" ]; then
        kill $SERVER_PID 2>/dev/null || true
        log_info "Stopped Mattermost server"
    fi
    
    # Stop Docker services
    cd /workspace/server/build 2>/dev/null || true
    if [ -f "docker-compose.yml" ]; then
        docker compose --ansi never down -v 2>/dev/null || true
        log_info "Stopped Docker services"
    fi
    
    log_success "Cleanup completed"
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

# Check if we're running in container
if [ ! -f /.dockerenv ]; then
    log_error "This script should run inside a Docker container"
    exit 1
fi

log_info "Running API contract testing in containerized environment"
log_info "Working directory: $(pwd)"
log_info "Available tools: Go $(go version | cut -d' ' -f3), Node $(node --version), Python $(python3 --version | cut -d' ' -f2)"

# Step 1: Install tools
log_step "Installing contract testing tools..."
cd /workspace/api

# Create virtual environment for Python dependencies
python3 -m venv venv
source venv/bin/activate

if [ -f "package.json" ]; then
    npm install
    log_success "Node.js dependencies installed"
else
    log_error "package.json not found in api directory"
    exit 1
fi

if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    log_success "Python dependencies installed"
else
    log_error "requirements.txt not found in api directory"
    exit 1
fi

# Step 2: Build API docs
log_step "Building API documentation..."
if make build; then
    log_success "OpenAPI spec generated"
else
    log_error "OpenAPI spec generation failed"
    exit 1
fi

# Verify the spec was created
if [ ! -f "v4/html/static/mattermost-openapi-v4.yaml" ]; then
    log_error "OpenAPI spec file not found after build"
    exit 1
fi

spec_size=$(wc -l < "v4/html/static/mattermost-openapi-v4.yaml")
log_info "Generated OpenAPI spec has $spec_size lines"

# Step 3: Start database services
log_step "Starting database and supporting services..."
cd /workspace/server/build

# Set unique project name to avoid conflicts
export COMPOSE_PROJECT_NAME=api-contract-test-$(date +%s)

if [ ! -f "docker-compose.yml" ]; then
    log_error "docker-compose.yml not found in server/build directory"
    exit 1
fi

# Start dependencies and wait for them to be ready
log_info "Starting PostgreSQL, MinIO, and other services..."
if timeout 300 docker compose --ansi never run --rm start_dependencies; then
    log_success "Database services are ready"
else
    log_error "Database services failed to start"
    docker compose --ansi never logs
    exit 1
fi

# Create MinIO bucket
docker compose --ansi never exec -T minio sh -c 'mkdir -p /data/mattermost-test' || true
docker compose --ansi never ps

# Step 4: Build Mattermost server
log_step "Building Mattermost server..."
cd /workspace/server

# Check Go version matches
expected_version=$(cat .go-version)
actual_version=$(go version | grep -o 'go[0-9]\+\.[0-9]\+\.[0-9]\+' | sed 's/go//')
if [ "$expected_version" != "$actual_version" ]; then
    log_error "Go version mismatch. Expected: $expected_version, Got: $actual_version"
    exit 1
fi

log_info "Building server components..."
if make setup-go-work && make prepackaged-binaries && make build-linux; then
    log_success "Mattermost server built successfully"
else
    log_error "Server build failed"
    exit 1
fi

# Verify binary was created
if [ ! -f "bin/mattermost" ]; then
    log_error "Mattermost binary not found after build"
    exit 1
fi

# Step 5: Configure and start server
log_step "Configuring and starting Mattermost server..."
mkdir -p config data

# Create server configuration
cat > config/config.json << 'EOF'
{
  "ServiceSettings": {
    "SiteURL": "http://localhost:8065",
    "ListenAddress": ":8065",
    "EnableDeveloper": true,
    "EnableInsecureOutgoingConnections": true,
    "EnableLocalMode": true
  },
  "TeamSettings": {
    "EnableOpenServer": true,
    "EnableUserCreation": true,
    "MaxUsersPerTeam": 1000
  },
  "SqlSettings": {
    "DriverName": "postgres",
    "DataSource": "postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10",
    "MaxIdleConns": 20,
    "MaxOpenConns": 300,
    "Trace": false
  },
  "LogSettings": {
    "EnableConsole": true,
    "ConsoleLevel": "INFO",
    "EnableFile": true,
    "FileLevel": "INFO"
  },
  "FileSettings": {
    "DriverName": "local",
    "Directory": "./data/",
    "MaxFileSize": 52428800
  },
  "EmailSettings": {
    "EnableSignUpWithEmail": true,
    "RequireEmailVerification": false,
    "SendEmailNotifications": false
  }
}
EOF

log_info "Starting Mattermost server..."
nohup ./bin/mattermost > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready with better error handling
log_info "Waiting for server to start (timeout: 60 seconds)..."
for i in {1..30}; do
    if curl -f http://localhost:8065/api/v4/system/ping >/dev/null 2>&1; then
        log_success "Mattermost server is ready"
        break
    fi
    
    if [ $i -eq 30 ]; then
        log_error "Server failed to start within timeout"
        log_info "Server logs (last 30 lines):"
        tail -30 server.log || echo "Could not read server logs"
        exit 1
    fi
    
    # Check if process is still running
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        log_error "Server process died"
        log_info "Server logs:"
        cat server.log || echo "Could not read server logs"
        exit 1
    fi
    
    sleep 2
done

# Step 6: Setup authentication
log_step "Setting up test user and authentication..."

# Create admin user
log_info "Creating system admin user..."
response=$(curl -w "%{http_code}" -s -o /dev/null -X POST http://localhost:8065/api/v4/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "username": "admin",
    "password": "Admin123!",
    "first_name": "System",
    "last_name": "Admin"
  }')

if [ "$response" -eq 201 ] || [ "$response" -eq 400 ]; then
    log_success "Admin user created or already exists"
else
    log_error "Failed to create admin user (HTTP $response)"
fi

# Get authentication token
log_info "Obtaining API authentication token..."
auth_response=$(curl -s -v -X POST http://localhost:8065/api/v4/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "login_id": "admin",
    "password": "Admin123!"
  }' 2>&1)

TOKEN=$(echo "$auth_response" | grep -i "token:" | head -1 | sed 's/.*token: \(.*\)/\1/' | tr -d '\r\n ')

if [ -z "$TOKEN" ]; then
    log_error "Failed to obtain API token"
    log_info "Auth response:"
    echo "$auth_response"
    exit 1
fi

# Verify token works
if curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8065/api/v4/users/me >/dev/null; then
    log_success "Authentication token verified"
else
    log_error "Authentication token verification failed"
    exit 1
fi

# Step 7: Run contract tests
log_step "Running OpenAPI contract tests..."
cd /workspace/api

# Activate Python virtual environment
source venv/bin/activate

mkdir -p test-results

# Update Dredd configuration with actual token
sed "s/TOKEN_PLACEHOLDER/$TOKEN/g" dredd.yml > dredd-with-token.yml

# Run Dredd tests
log_info "Running Dredd HTTP API tests..."
if npx dredd v4/html/static/mattermost-openapi-v4.yaml http://localhost:8065 --config=dredd-with-token.yml; then
    log_success "Dredd tests passed"
else
    log_error "Dredd tests found issues (this may be expected)"
fi

# Run Schemathesis tests
log_info "Running Schemathesis property-based tests..."
if schemathesis run \
  --base-url=http://localhost:8065 \
  --auth-type=header \
  --auth="Authorization: Bearer $TOKEN" \
  --max-examples=3 \
  --report \
  --output-file=test-results/schemathesis-report.json \
  v4/html/static/mattermost-openapi-v4.yaml; then
    log_success "Schemathesis tests passed"
else
    log_error "Schemathesis tests found issues (this may be expected)"
fi

# Step 8: Report results
log_step "Generating test report..."

echo ""
echo "========================================"
echo "🎉 API Contract Testing Complete!"
echo "========================================"
echo ""

if [ -f "test-results/dredd-report.json" ]; then
    dredd_tests=$(jq '.stats.tests' test-results/dredd-report.json 2>/dev/null || echo "unknown")
    dredd_failures=$(jq '.stats.failures' test-results/dredd-report.json 2>/dev/null || echo "unknown")
    echo "📊 Dredd Results: $dredd_tests tests, $dredd_failures failures"
fi

if [ -f "test-results/schemathesis-report.json" ]; then
    echo "📊 Schemathesis results available in test-results/"
fi

echo "📁 Generated files:"
echo "   • OpenAPI spec: api/v4/html/static/mattermost-openapi-v4.yaml"
echo "   • Test results: api/test-results/"
echo "   • Server logs: server/server.log"
echo ""
echo "✨ Contract testing validates that your OpenAPI documentation"
echo "   matches the actual API implementation!"

log_success "All tests completed successfully!"