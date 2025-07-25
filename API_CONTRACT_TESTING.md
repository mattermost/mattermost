# API Contract Testing

This document describes the OpenAPI contract testing system that ensures Mattermost's API documentation stays synchronized with the actual API implementation.

## 🎯 Overview

The API contract testing system:
- ✅ **Validates OpenAPI specs** against a live Mattermost server
- ✅ **Catches documentation drift** when APIs change but docs don't
- ✅ **Runs in CI/CD** on every PR and master push
- ✅ **Provides local testing** in isolated Docker containers
- ✅ **Uses multiple testing approaches** (Dredd + Schemathesis)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OpenAPI Spec  │    │  Live MM Server │    │ Contract Tests  │
│   Generation    │───▶│   + Database    │───▶│  Dredd + Schema │
│   (make build)  │    │   + Services    │    │   thetic Tests  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
    YAML files              Docker Compose          Test Results
    40+ API modules         PostgreSQL, MinIO        JSON Reports
```

## 🚀 Quick Start

### Local Testing (Recommended)

Test the entire workflow in an isolated Docker container:

```bash
# Basic usage
./test-api-workflow.sh

# With verbose output
./test-api-workflow.sh --verbose

# Rebuild container image
./test-api-workflow.sh --rebuild

# Clean up Docker images after testing
./test-api-workflow.sh --cleanup-images

# Get help
./test-api-workflow.sh --help
```

### Manual Testing

If you prefer to test individual components:

```bash
# 1. Generate OpenAPI spec
cd api && make build

# 2. Start services (in separate terminal)
cd server/build && docker compose up

# 3. Build and start server (in separate terminal)  
cd server && make build-linux && ./bin/mattermost

# 4. Run contract tests
cd api && npm run test-api-contract
```

## 🔧 CI/CD Integration

The contract testing runs automatically in GitHub Actions via `.github/workflows/api.yml`:

### Workflow Steps
1. **Setup**: Go, Node.js, Python environments
2. **Build**: Generate OpenAPI specification
3. **Services**: Start PostgreSQL, MinIO, Redis via Docker Compose
4. **Server**: Build and start Mattermost server
5. **Auth**: Create admin user and get API token
6. **Test**: Run Dredd and Schemathesis contract tests
7. **Report**: Upload test results as artifacts

### Viewing Results
- **GitHub Actions**: Check the "Actions" tab for workflow results
- **Artifacts**: Download test results from completed workflow runs
- **Logs**: View detailed logs for debugging failures

## 🛠️ Tools & Configuration

### Testing Tools

1. **[Dredd](https://dredd.org/)** - HTTP API testing framework
   - Configuration: `api/dredd.yml`
   - Tests API endpoints against OpenAPI spec
   - Validates request/response formats

2. **[Schemathesis](https://schemathesis.readthedocs.io/)** - Property-based API testing
   - Configuration: `api/schemathesis-config.py`
   - Generates test cases automatically
   - Finds edge cases and validation issues

### Configuration Files

- `api/dredd.yml` - Dredd test configuration with endpoint filters
- `api/schemathesis-config.py` - Schemathesis configuration and filters
- `api/requirements.txt` - Python dependencies
- `Dockerfile.test-api` - Container image for local testing

### Filtered Endpoints

Some endpoints are skipped during testing because they require special setup:

- **File uploads** (`/api/v4/files/*`) - Require multipart data
- **SAML endpoints** (`/api/v4/saml/*`) - Require SAML configuration
- **LDAP endpoints** (`/api/v4/ldap/*`) - Require LDAP server
- **Plugin endpoints** (`/api/v4/plugins/*`) - Require plugin installation
- **System endpoints** (`/api/v4/database/*`) - May affect server state

## 📊 Understanding Results

### Test Reports

After running tests, check these files:

```bash
# Dredd results
cat api/test-results/dredd-report.json

# Schemathesis results  
cat api/test-results/schemathesis-report.json

# Server logs (for debugging)
cat server/server.log
```

### Common Issues

1. **Authentication Failures**
   - Check if admin user was created successfully
   - Verify API token is valid
   - Ensure server is fully started

2. **Endpoint Failures**
   - Review the specific API endpoint that failed
   - Check if the OpenAPI spec matches the actual implementation
   - Verify required parameters are correctly documented

3. **Server Startup Issues**
   - Check database connectivity
   - Verify all required services are running
   - Review server configuration

## 🐳 Docker Container Details

The local testing uses a custom Docker container that includes:

- **Ubuntu 22.04** base image (matches CI environment)
- **Go 1.24.3** (from server/.go-version)
- **Node.js LTS** with npm
- **Python 3.11** with pip
- **Docker CLI** for managing services
- **Contract testing tools** (Dredd, Schemathesis)

### Container Features

- **Isolated environment** - No impact on your local system
- **Consistent testing** - Same environment as CI
- **Easy cleanup** - Container is removed after testing
- **Volume mounts** - Access to your source code and results

## 🔄 Development Workflow

### When Making API Changes

1. **Update OpenAPI spec** - Modify relevant YAML files in `api/v4/source/`
2. **Test locally** - Run `./test-api-workflow.sh` to validate changes
3. **Fix issues** - Address any contract violations found
4. **Create PR** - CI will automatically run contract tests
5. **Review results** - Check GitHub Actions for test results

### Adding New Endpoints

1. **Document in OpenAPI** - Add endpoint to appropriate YAML file
2. **Update filters** - Add to skip lists if endpoint requires special setup
3. **Test thoroughly** - Ensure new endpoint works with contract tests
4. **Update documentation** - Add any special notes or requirements

## 🚨 Troubleshooting

### Local Testing Issues

```bash
# Check Docker daemon
docker info

# Rebuild test image
./test-api-workflow.sh --rebuild

# Run with verbose output
./test-api-workflow.sh --verbose

# Check container logs
docker logs $(docker ps -a | grep mattermost-api-test | head -1 | cut -d' ' -f1)
```

### CI/CD Issues

1. **Check workflow logs** in GitHub Actions
2. **Download artifacts** for detailed test results  
3. **Review server logs** in uploaded artifacts
4. **Compare with local test results**

### Common Fixes

- **Port conflicts**: The containerized approach avoids this
- **Permission issues**: Fixed by running in container
- **Database setup**: Handled automatically by Docker Compose
- **Tool versions**: Matched between local and CI environments

## 📚 Additional Resources

- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3/)
- [Dredd Documentation](https://dredd.org/en/latest/)
- [Schemathesis Documentation](https://schemathesis.readthedocs.io/)
- [Mattermost API Documentation](https://api.mattermost.com/)

## 🤝 Contributing

When contributing to the API contract testing system:

1. **Test changes locally** before creating PRs
2. **Update documentation** if adding new features
3. **Consider backward compatibility** when changing filters
4. **Add appropriate error handling** for new scenarios

---

*This contract testing system helps ensure that Mattermost's API documentation is always accurate and up-to-date with the actual implementation. Happy testing! 🚀*