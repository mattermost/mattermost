# Build & Deploy

How to build Mattermost Extended and deploy it to production.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Build Pipeline](#build-pipeline)
- [Creating a Release](#creating-a-release)
- [GitHub Actions](#github-actions)
- [Cloudron Deployment](#cloudron-deployment)
- [Version Numbering](#version-numbering)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Development Machine

| Tool | Version | Purpose |
|------|---------|---------|
| Go | 1.22+ | Server compilation |
| Node.js | 20+ | Webapp build |
| Git | Latest | Version control |
| Docker | Latest | Cloudron builds |

### Accounts & Access

- GitHub account with push access to the repository
- Docker Hub account (for Cloudron deployment)
- Cloudron CLI installed and authenticated

---

## Build Pipeline

### Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Commit    │───▶│  build.bat  │───▶│   GitHub    │───▶│   Docker    │
│   Changes   │    │  (tag+push) │    │   Actions   │    │   Deploy    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                         │                   │                   │
                         │                   │                   │
                    Create tag          Build binary        Push image
                    Push to GH          Create release      Update app
```

### What Gets Built

| Artifact | Contents |
|----------|----------|
| `mattermost-team-{version}-linux-amd64.tar.gz` | Server binary + webapp |
| Docker image | Full Mattermost installation |

---

## Creating a Release

### Step 1: Commit Your Changes

```bash
# Stage and commit your changes
git add .
git commit -m "Add feature X"
```

### Step 2: Run the Build Script

```bash
# Windows
./build.bat 11.3.0-custom.5 "Description of changes"

# What this does:
# 1. Verifies clean working directory
# 2. Creates annotated tag v11.3.0-custom.5
# 3. Pushes code and tag to GitHub
# 4. Triggers GitHub Actions build
```

### Step 3: Monitor the Build

Watch the build progress at:
https://github.com/stalecontext/mattermost-extended/actions

Build typically takes **10-15 minutes**.

### Step 4: Deploy to Cloudron

After the GitHub Actions build completes:

```bash
cd ../mattermost-extended-cloudron-app

# Update manifest version if needed
# Edit CloudronManifest.json

# Build and push Docker image
./deploy.bat 11.3.0-custom.5
```

---

## GitHub Actions

### Workflow File

`.github/workflows/release.yml`

### Trigger

The workflow runs on tags matching `v*-custom.*`:

```yaml
on:
  push:
    tags:
      - 'v*-custom.*'
```

### Build Steps

1. **Checkout** - Clone repository at the tagged commit
2. **Setup Go** - Install Go 1.22
3. **Setup Node** - Install Node.js 20
4. **Build Webapp** - `npm ci && npm run build`
5. **Build Server** - `make build-linux BUILD_ENTERPRISE=false`
6. **Package** - Create tarball with server + webapp
7. **Release** - Upload to GitHub Releases

### Build Flags

| Flag | Value | Purpose |
|------|-------|---------|
| `BUILD_ENTERPRISE` | `false` | Build without enterprise features |
| `GOFLAGS` | `-buildvcs=false` | Disable VCS info in binary |

---

## Cloudron Deployment

### Repository

[mattermost-extended-cloudron-app](https://github.com/stalecontext/mattermost-extended-cloudron-app)

### Dockerfile Overview

```dockerfile
FROM cloudron/base:4.2.0

# Download release from GitHub
RUN curl -L https://github.com/stalecontext/mattermost-extended/releases/download/v${MM_VERSION}/mattermost-team-${MM_VERSION}-linux-amd64.tar.gz | tar xz

# Configure for Cloudron
COPY start.sh /app/pkg/
```

### Deploy Script

```bash
# deploy.bat performs:
# 1. Update Dockerfile with version
# 2. Run cloudron build
# 3. Push to Docker Hub
# 4. Notify Cloudron of update
```

### Manual Cloudron Update

After `deploy.bat` completes, update via Cloudron dashboard or CLI:

```bash
cloudron update --app chat.yourdomain.com
```

---

## Version Numbering

### Format

```
v{mattermost-version}-custom.{revision}
```

### Examples

| Version | Meaning |
|---------|---------|
| `v11.3.0-custom.1` | First custom build on Mattermost 11.3.0 |
| `v11.3.0-custom.2` | Second revision (bug fix or feature) |
| `v11.4.0-custom.1` | Upgraded base to Mattermost 11.4.0 |

### Cloudron Versions

Cloudron uses separate versioning in `CloudronManifest.json`:

| Cloudron Version | Mattermost Version |
|------------------|-------------------|
| `0.1.0` | v11.3.0-custom.1 |
| `0.2.0` | v11.3.0-custom.3 |
| `0.3.0` | v11.4.0-custom.1 |

**Rule**: Increment Cloudron minor version for each Mattermost custom version.

---

## Troubleshooting

### Build Script Errors

**"You have uncommitted changes"**
```bash
# Commit your changes first
git add . && git commit -m "message"
```

**"Tag already exists"**
```bash
# build.bat automatically removes existing tags
# If issues persist, manually delete:
git tag -d v11.3.0-custom.5
git push origin :refs/tags/v11.3.0-custom.5
```

### GitHub Actions Failures

**Check workflow logs:**
https://github.com/stalecontext/mattermost-extended/actions

**Common issues:**
- Go version mismatch - Update workflow Go version
- npm install fails - Check package-lock.json
- Make fails - Check server/Makefile

**Re-run a build:**
```bash
# Delete and recreate tag
git tag -d v11.3.0-custom.5
git push origin :refs/tags/v11.3.0-custom.5
./build.bat 11.3.0-custom.5 "Retry build"
```

### Docker Build Failures

**"Release not found"**
- Wait for GitHub Actions to complete
- Check release exists at GitHub Releases page

**"cloudron build failed"**
```bash
# Check Docker is running
docker info

# Retry with verbose output
cloudron build --verbose
```

### Cloudron Update Issues

**App won't start after update:**
```bash
# Check app logs
cloudron logs -f --app chat.yourdomain.com

# Rollback to previous version
cloudron restore --app chat.yourdomain.com
```

---

## Quick Reference

### Common Commands

```bash
# Build and release
./build.bat 11.3.0-custom.5 "Description"

# Deploy to Cloudron
cd ../mattermost-extended-cloudron-app
./deploy.bat 11.3.0-custom.5

# Check build status
# https://github.com/stalecontext/mattermost-extended/actions

# View releases
# https://github.com/stalecontext/mattermost-extended/releases
```

### Key URLs

| Resource | URL |
|----------|-----|
| GitHub Actions | https://github.com/stalecontext/mattermost-extended/actions |
| Releases | https://github.com/stalecontext/mattermost-extended/releases |
| Docker Hub | https://hub.docker.com/r/stalecontext/mattermost-extended-cloudron |

---

*For local development setup, see [Development](DEVELOPMENT.md).*
