<p align="center">
  <img src="docs/assets/logo-placeholder.png" alt="Mattermost Extended Logo" width="400">
</p>

<h1 align="center">Mattermost Extended</h1>

<p align="center">
  A fork of Mattermost with end-to-end encryption, custom icons, and other enhancements.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/base-Mattermost%20v11.3.0-blue" alt="Base Version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/platform-Linux-lightgrey" alt="Platform">
</p>

---

## Overview

This fork adds several features to Mattermost that aren't available in the upstream version. All features are behind feature flags and can be enabled independently.

<!-- SCREENSHOT: Main chat interface showing encrypted messages with purple styling -->
<p align="center">
  <img src="docs/assets/screenshot-main-placeholder.png" alt="Mattermost Extended Interface" width="800">
</p>

---

## Features

### End-to-End Encryption

Client-side encryption using RSA-4096 + AES-256-GCM. Messages and files are encrypted in the browser before being sent to the server.

<!-- SCREENSHOT: Encrypted message with purple border and lock icon, showing "Encrypted" badge -->
<p align="center">
  <img src="docs/assets/screenshot-encryption-placeholder.png" alt="Encrypted Messages" width="600">
</p>

- Per-session key generation stored in sessionStorage
- Messages encrypted for all active sessions of each recipient
- File attachments encrypted with metadata hidden from server
- Purple visual styling indicates encrypted content

---

### Custom Channel Icons

Channels can have custom icons instead of the default globe/lock icons.

<!-- SCREENSHOT: Sidebar showing channels with various custom icons (rocket, code, bug, etc.) -->
<p align="center">
  <img src="docs/assets/screenshot-icons-placeholder.png" alt="Custom Channel Icons" width="300">
</p>

- Material Design Icons (7000+)
- Lucide icons
- Custom SVG via base64
- Searchable picker in channel settings

---

### Custom Thread Names

Threads can be renamed to something more descriptive than the first message.

<!-- SCREENSHOT: Thread view showing a custom name like "Q4 Marketing Strategy" with edit pencil -->
<p align="center">
  <img src="docs/assets/screenshot-threads-placeholder.png" alt="Custom Thread Names" width="500">
</p>

---

### Threads in Sidebar

Followed threads appear nested under their parent channel in the sidebar.

<!-- SCREENSHOT: Sidebar showing a channel with nested thread items underneath -->
<p align="center">
  <img src="docs/assets/screenshot-sidebar-threads-placeholder.png" alt="Threads in Sidebar" width="300">
</p>

---

### Hide Deleted Message Placeholders

When enabled, deleted messages disappear immediately instead of showing "(message deleted)".

---

## Feature Flags

| Feature | Environment Variable | Default |
|---------|---------------------|---------|
| End-to-End Encryption | `MM_FEATUREFLAGS_ENCRYPTION` | Off |
| Custom Channel Icons | `MM_FEATUREFLAGS_CUSTOMCHANNELICONS` | Off |
| Custom Thread Names | `MM_FEATUREFLAGS_CUSTOMTHREADNAMES` | Off |
| Threads in Sidebar | `MM_FEATUREFLAGS_THREADSINSIDEBAR` | Off |
| Hide Deleted Placeholders | `MM_FEATUREFLAGS_HIDEDELETEDMESSAGEPLACEHOLDER` | Off |

Features can also be toggled in **System Console > Mattermost Extended > Features**:

<!-- SCREENSHOT: Admin console showing the Mattermost Extended Features page with toggles -->
<p align="center">
  <img src="docs/assets/screenshot-admin-placeholder.png" alt="Admin Console" width="700">
</p>

---

## Installation

### Building from Source

```bash
git clone https://github.com/stalecontext/mattermost-extended.git
cd mattermost-extended

# Build server
cd server && make build-linux BUILD_ENTERPRISE=false

# Build webapp
cd ../webapp && npm ci && npm run build
```

### Creating a Release

```bash
# Commit changes, then tag and push
./build.bat 11.3.0-custom.1 "Release description"

# GitHub Actions builds and publishes automatically
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Features](docs/FEATURES.md) | Detailed feature documentation |
| [Architecture](docs/ARCHITECTURE.md) | Technical design |
| [Build & Deploy](docs/BUILD_DEPLOY.md) | CI/CD and deployment |
| [Development](docs/DEVELOPMENT.md) | Local development setup |
| [Encryption](docs/plans/ENCRYPTION.md) | E2E encryption details |

---

## Project Structure

```
mattermost/
├── server/
│   ├── channels/api4/               # REST API (+ encryption.go)
│   ├── channels/store/              # Database layer
│   └── public/model/                # Data models & feature flags
│
├── webapp/
│   ├── channels/src/components/     # UI components
│   ├── channels/src/utils/encryption/  # Crypto library
│   └── platform/                    # Shared packages
│
├── docs/                            # Documentation
└── .github/workflows/               # CI/CD
```

---

## Related Repositories

| Repository | Description |
|------------|-------------|
| [mattermost-extended](https://github.com/stalecontext/mattermost-extended) | This repository |
| [mattermost-extended-mobile](https://github.com/stalecontext/mattermost-extended-mobile) | Mobile app |
| [mattermost-extended-cloudron-app](https://github.com/stalecontext/mattermost-extended-cloudron-app) | Cloudron packaging |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test with `local-test.ps1`
4. Submit a pull request

---

## License

Licensed under the same terms as Mattermost. See [LICENSE.txt](LICENSE.txt).

---

<p align="center">
  <a href="https://github.com/stalecontext/mattermost-extended">GitHub</a> •
  <a href="https://github.com/stalecontext/mattermost-extended/issues">Issues</a> •
  <a href="https://github.com/stalecontext/mattermost-extended/releases">Releases</a>
</p>
