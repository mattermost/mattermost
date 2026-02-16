# .cursor/Dockerfile
# Custom Cursor Cloud Agent environment for Mattermost development.
#
# Installs: Go 1.24.13, Node.js 20.x, PostgreSQL 14, Redis,
#           agent-browser (headless Chromium for AI QA).
#
# Native services (PostgreSQL, Redis) -- no Docker-in-Docker.

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# ============================================
# System packages (single layer for efficiency)
# ============================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build essentials
    make git curl wget build-essential zip unzip jq ca-certificates gnupg lsb-release sudo \
    # XML security (Mattermost SAML support)
    xmlsec1 \
    # Document processing (Mattermost file previews)
    unrtf wv poppler-utils tidy \
    # PostgreSQL 14 (server + client + dev headers for Go pgx driver)
    postgresql-14 postgresql-client-14 libpq-dev \
    # Redis
    redis-server \
    # Chromium system libraries (for agent-browser / Playwright)
    # Pre-installing these so agent-browser install --with-deps is faster
    # and so the layer is cached even if agent-browser version changes.
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    libxss1 libglib2.0-0 libx11-6 libxcb1 libxext6 \
    # Fonts (needed for Chromium to render pages correctly)
    fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Go 1.24.13
# ============================================
ENV GO_VERSION=1.24.13
RUN curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" \
    | tar -C /usr/local -xzf - \
    && ln -s /usr/local/go/bin/go /usr/local/bin/go \
    && ln -s /usr/local/go/bin/gofmt /usr/local/bin/gofmt
ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/home/ubuntu/go"
ENV PATH="${GOPATH}/bin:${PATH}"

# ============================================
# Node.js 20.x via NodeSource (manual repo setup)
# Using manual method instead of deprecated setup_20.x script.
# ============================================
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
       | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
       > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# agent-browser (AI browser automation CLI)
# Downloads its own Chromium via Playwright.
# --with-deps installs any remaining system libs.
# ============================================
RUN npm install -g agent-browser \
    && agent-browser install --with-deps

# ============================================
# Mattermost Cloud Agent env vars
# Tells Mattermost make targets to skip Docker
# ============================================
ENV MM_NO_DOCKER=true

# ============================================
# User setup
# Cursor Cloud Agent expects an "ubuntu" user with
# passwordless sudo. Matches the VM's host user.
# ============================================
RUN useradd -m -s /bin/bash ubuntu \
    && usermod -aG sudo ubuntu \
    && echo "ubuntu ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/ubuntu \
    && chown -R ubuntu:ubuntu /home/ubuntu

WORKDIR /home/ubuntu
USER ubuntu

# Re-export PATH for the ubuntu user context
ENV PATH="/home/ubuntu/go/bin:/usr/local/go/bin:/usr/local/bin:${PATH}"
