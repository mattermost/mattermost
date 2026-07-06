FROM ubuntu:24.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG GO_VERSION=1.25.9
ARG NODE_VERSION=24.11.1
ARG NVM_VERSION=0.40.3
ARG DOCKER_VERSION=5:28.5.2-1~ubuntu.24.04~noble
ARG CONTAINERD_VERSION=2.2.3-1~ubuntu.24.04~noble
ARG DOCKER_BUILDX_VERSION=0.33.0-1~ubuntu.24.04~noble
ARG DOCKER_COMPOSE_VERSION=5.1.3-1~ubuntu.24.04~noble

ENV DEBIAN_FRONTEND=noninteractive
ENV NVM_DIR=/home/ubuntu/.nvm
ENV GOPATH=/home/ubuntu/go
ENV PATH=/home/ubuntu/.nvm/versions/node/v${NODE_VERSION}/bin:/usr/local/go/bin:/home/ubuntu/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-transport-https \
    acl \
    bash \
    build-essential \
    ca-certificates \
    curl \
    dnsutils \
    file \
    fuse-overlayfs \
    git \
    git-lfs \
    gnupg \
    iproute2 \
    iptables \
    jq \
    less \
    libasound2t64 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libsecret-1-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    locales \
    lsof \
    make \
    nano \
    netcat-openbsd \
    openssh-server \
    pgloader \
    pkg-config \
    procps \
    python3 \
    python3-pip \
    python3-venv \
    rsync \
    sudo \
    tar \
    tmux \
    unzip \
    vim \
    xmlsec1 \
    xz-utils \
    zip && \
    locale-gen en_US.UTF-8 && \
    git lfs install --system && \
    rm -rf /var/lib/apt/lists/*

RUN install -m 0755 -d /etc/apt/keyrings && \
    curl --retry 3 --retry-delay 5 -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    docker-ce=${DOCKER_VERSION} \
    docker-ce-cli=${DOCKER_VERSION} \
    containerd.io=${CONTAINERD_VERSION} \
    docker-buildx-plugin=${DOCKER_BUILDX_VERSION} \
    docker-compose-plugin=${DOCKER_COMPOSE_VERSION} && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/docker && \
    printf '%s\n' \
    '{' \
    '  "storage-driver": "fuse-overlayfs",' \
    '  "features": {' \
    '    "buildkit": true' \
    '  }' \
    '}' > /etc/docker/daemon.json && \
    update-alternatives --set iptables /usr/sbin/iptables-legacy && \
    update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

RUN install -m 0755 -d /etc/apt/keyrings && \
    curl --retry 3 --retry-delay 5 -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/*

RUN case "$(dpkg --print-architecture)" in \
      amd64) go_arch=amd64 ;; \
      arm64) go_arch=arm64 ;; \
      *) echo "Unsupported Go architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac && \
    curl --retry 3 --retry-delay 5 -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${go_arch}.tar.gz" -o /tmp/go.tgz && \
    rm -rf /usr/local/go && \
    tar -C /usr/local -xzf /tmp/go.tgz && \
    ln -sfnT /usr/local/go/bin/go /usr/local/bin/go && \
    ln -sfnT /usr/local/go/bin/gofmt /usr/local/bin/gofmt && \
    rm -f /tmp/go.tgz

RUN case "$(dpkg --print-architecture)" in \
      amd64) aws_arch=x86_64 ;; \
      arm64) aws_arch=aarch64 ;; \
      *) echo "Unsupported AWS CLI architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac && \
    curl --retry 3 --retry-delay 5 -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${aws_arch}.zip" -o /tmp/awscliv2.zip && \
    unzip -q /tmp/awscliv2.zip -d /tmp && \
    /tmp/aws/install --bin-dir /usr/local/bin --install-dir /usr/local/aws-cli && \
    rm -rf /tmp/aws /tmp/awscliv2.zip

RUN install -m 0755 -d /var/run/sshd && \
    printf '%s\n' 'PasswordAuthentication no' 'ChallengeResponseAuthentication no' 'UsePAM no' > /etc/ssh/sshd_config.d/disable_password_auth.conf && \
    if ! id -u ubuntu >/dev/null 2>&1; then useradd -m -s /bin/bash ubuntu; fi && \
    groupadd -f docker && \
    usermod -aG docker,sudo ubuntu && \
    echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu && \
    chmod 0440 /etc/sudoers.d/ubuntu && \
    echo "ubuntu:ubuntu" | chpasswd && \
    install -d -o ubuntu -g ubuntu "${NVM_DIR}" "${GOPATH}"

RUN git clone --depth 1 --branch "v${NVM_VERSION}" https://github.com/nvm-sh/nvm.git "${NVM_DIR}" && \
    chown -R ubuntu:ubuntu "${NVM_DIR}" "${GOPATH}" && \
    su ubuntu -c "bash -lc 'set -e; source ${NVM_DIR}/nvm.sh; nvm install ${NODE_VERSION}; nvm alias default ${NODE_VERSION}; nvm use default'" && \
    ln -sfn "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/node" /usr/local/bin/node && \
    ln -sfn "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/npm" /usr/local/bin/npm && \
    ln -sfn "${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/npx" /usr/local/bin/npx

RUN { \
      echo 'export NVM_DIR="$HOME/.nvm"'; \
      echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'; \
      echo 'export GOPATH="$HOME/go"'; \
      echo 'export PATH="$NVM_DIR/versions/node/v24.11.1/bin:/usr/local/go/bin:$GOPATH/bin:$PATH"'; \
    } >> /home/ubuntu/.bashrc && \
    chown ubuntu:ubuntu /home/ubuntu/.bashrc

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

WORKDIR /home/ubuntu
USER ubuntu
