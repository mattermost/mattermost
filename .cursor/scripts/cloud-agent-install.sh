#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[cloud-agent-install] %s\n' "$*" >&2
}

is_true() {
  case "${1:-}" in
    1 | true | TRUE | yes | YES) return 0 ;;
    *) return 1 ;;
  esac
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

NODE_VERSION="${CLOUD_AGENT_NODE_VERSION:-24.11.1}"

export GOPATH="${GOPATH:-$HOME/go}"
export PATH="/usr/local/go/bin:$GOPATH/bin:/usr/local/bin:$PATH"

required_go_version() {
  local version_file="$ROOT/server/.go-version"
  if [ ! -f "$version_file" ]; then
    log "server/.go-version is missing; cannot determine the required Go version."
    return 1
  fi
  tr -d '[:space:]' < "$version_file"
}

current_go_version() {
  command -v go >/dev/null 2>&1 || return 1
  go version | awk '{print $3}' | sed 's/^go//'
}

install_go() {
  local version="$1"
  local go_arch
  case "$(dpkg --print-architecture)" in
    amd64) go_arch=amd64 ;;
    arm64) go_arch=arm64 ;;
    *)
      log "Unsupported Go architecture: $(dpkg --print-architecture)"
      return 1
      ;;
  esac

  local tarball="/tmp/go${version}.linux-${go_arch}.tar.gz"
  log "Downloading Go ${version} (${go_arch})."
  curl --retry 3 --retry-delay 5 -fsSL "https://go.dev/dl/go${version}.linux-${go_arch}.tar.gz" -o "$tarball"
  sudo rm -rf /usr/local/go
  sudo tar -C /usr/local -xzf "$tarball"
  sudo ln -sfnT /usr/local/go/bin/go /usr/local/bin/go
  sudo ln -sfnT /usr/local/go/bin/gofmt /usr/local/bin/gofmt
  rm -f "$tarball"
}

persist_go_path() {
  local marker="# mattermost-cloud-agent-go-path"
  local rc="${HOME}/.bashrc"
  if [ -f "$rc" ] && grep -Fq "$marker" "$rc"; then
    return 0
  fi
  {
    echo "$marker"
    echo 'export GOPATH="${GOPATH:-$HOME/go}"'
    echo 'export PATH="/usr/local/go/bin:$GOPATH/bin:$PATH"'
  } >> "$rc"
}

ensure_go() {
  export GOPATH="${GOPATH:-$HOME/go}"
  export PATH="/usr/local/go/bin:/usr/local/bin:${GOPATH}/bin:${PATH}"

  local required current
  required="$(required_go_version)"
  current="$(current_go_version || true)"

  if [ "$current" != "$required" ]; then
    log "Go ${current:-not found} does not match server/.go-version (${required}); installing."
    install_go "$required"
    hash -r
    persist_go_path
    current="$(current_go_version || true)"
  fi

  if [ "$current" != "$required" ]; then
    log "Go is ${current:-not found} after install; expected ${required}."
    return 1
  fi

  log "Using $(go version)"
}

source_node() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi
}

ensure_node() {
  source_node

  if command -v nvm >/dev/null 2>&1; then
    nvm install "$NODE_VERSION" >/dev/null
    nvm alias default "$NODE_VERSION" >/dev/null
    nvm use "$NODE_VERSION" >/dev/null
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    log "Node.js/npm are not available; check the Cloud Agent Dockerfile build."
    return 1
  fi

  log "Using node $(node --version) and npm $(npm --version)"
}

enterprise_build_dir() {
  case "$BUILD_ENTERPRISE_DIR" in
    /*) realpath -m "$BUILD_ENTERPRISE_DIR" ;;
    *) realpath -m "$ROOT/server/$BUILD_ENTERPRISE_DIR" ;;
  esac
}

find_enterprise_checkout() {
  local candidates=()
  if [ -n "${ENTERPRISE_CHECKOUT_DIR:-}" ]; then
    candidates+=("$ENTERPRISE_CHECKOUT_DIR")
  fi
  if [ -n "${ENTERPRISE_DIR:-}" ]; then
    candidates+=("$ENTERPRISE_DIR")
  fi

  candidates+=(
    "$ROOT/../enterprise"
    "$ROOT/../../enterprise"
    "$HOME/enterprise"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if git -C "$candidate" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      realpath -m "$candidate"
      return 0
    fi
  done

  return 1
}

verify_enterprise_checkout() {
  if is_true "${CLOUD_AGENT_SKIP_ENTERPRISE:-false}"; then
    log "Skipping enterprise verification because CLOUD_AGENT_SKIP_ENTERPRISE is set."
    return 0
  fi

  local target
  if ! target="$(find_enterprise_checkout)"; then
    log "Enterprise checkout not found. Ensure the Cursor multi-repo environment includes github.com/mattermost/enterprise."
    return 1
  fi

  log "Enterprise checkout ready at $target."
}

hydrate_go_dependencies() {
  if is_true "${CLOUD_AGENT_SKIP_GO_DEPS:-false}"; then
    log "Skipping Go dependency hydration."
    return 0
  fi

  if [ -d server ]; then
    if [ -n "${BUILD_ENTERPRISE_DIR:-}" ]; then
      local enterprise_dir
      enterprise_dir="$(enterprise_build_dir)"
      log "Hydrating Go workspace with BUILD_ENTERPRISE_DIR=$enterprise_dir"
      (
        cd server
        BUILD_ENTERPRISE_DIR="$enterprise_dir" make setup-go-work
        go mod download
        if [ -f public/go.mod ]; then
          (cd public && go mod download)
        fi
      )
    else
      log "Hydrating Go workspace with server/Makefile default enterprise path."
      (
        cd server
        make setup-go-work
        go mod download
        if [ -f public/go.mod ]; then
          (cd public && go mod download)
        fi
      )
    fi
  fi
}

hydrate_webapp_dependencies() {
  if is_true "${CLOUD_AGENT_SKIP_WEBAPP_DEPS:-false}"; then
    log "Skipping webapp dependency hydration."
    return 0
  fi

  if [ -f webapp/package.json ]; then
    log "Hydrating webapp dependencies."
    (cd webapp && make node_modules)
  fi
}

hydrate_playwright_dependencies() {
  if is_true "${CLOUD_AGENT_SKIP_PLAYWRIGHT_DEPS:-false}"; then
    log "Skipping Playwright dependency hydration."
    return 0
  fi

  if [ -f e2e-tests/playwright/package-lock.json ]; then
    log "Hydrating Playwright dependencies."
    (cd e2e-tests/playwright && npm ci)
  fi
}

ensure_go
ensure_node
verify_enterprise_checkout
hydrate_go_dependencies
hydrate_webapp_dependencies
hydrate_playwright_dependencies

log "AWS CLI: $(aws --version 2>&1 || printf 'not available')"
log "Install hook complete."
