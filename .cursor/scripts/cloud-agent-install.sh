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
AGENT_BROWSER_VERSION="${CLOUD_AGENT_BROWSER_VERSION:-0.27.0}"

export GOPATH="${GOPATH:-$HOME/go}"
export PATH="/usr/local/go/bin:$GOPATH/bin:/usr/local/bin:$PATH"

ensure_go() {
  if ! command -v go >/dev/null 2>&1; then
    log "Go is not available on PATH. PATH=$PATH"
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

  if ! command -v agent-browser >/dev/null 2>&1; then
    npm install -g "agent-browser@${AGENT_BROWSER_VERSION}"
  fi

  if ! is_true "${CLOUD_AGENT_SKIP_AGENT_BROWSER_INSTALL:-false}"; then
    agent-browser install || log "agent-browser install failed; continuing so code tasks are not blocked."
  fi
}

enterprise_build_dir() {
  if [ -n "${BUILD_ENTERPRISE_DIR:-}" ]; then
    case "$BUILD_ENTERPRISE_DIR" in
      /*) realpath -m "$BUILD_ENTERPRISE_DIR" ;;
      *) realpath -m "$ROOT/server/$BUILD_ENTERPRISE_DIR" ;;
    esac
  else
    printf '%s\n' "/enterprise"
  fi
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
    "$HOME/enterprise"
    "$ROOT/../enterprise"
    "$ROOT/../../enterprise"
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

setup_enterprise_checkout() {
  if is_true "${CLOUD_AGENT_SKIP_ENTERPRISE:-false}"; then
    log "Skipping enterprise setup because CLOUD_AGENT_SKIP_ENTERPRISE is set."
    return 0
  fi

  local target
  if ! target="$(find_enterprise_checkout)"; then
    log "Enterprise checkout not found. Ensure the Cursor multi-repo environment includes github.com/mattermost/enterprise."
    if [ -L /enterprise ]; then
      sudo rm -f /enterprise
    fi
    return 0
  fi

  if [ -e /enterprise ] && [ ! -L /enterprise ]; then
    log "/enterprise exists and is not a symlink; leaving it unchanged."
    return 0
  fi

  sudo ln -sfnT "$target" /enterprise
  log "Enterprise checkout ready at $target and linked to /enterprise."
}

hydrate_go_dependencies() {
  if is_true "${CLOUD_AGENT_SKIP_GO_DEPS:-false}"; then
    log "Skipping Go dependency hydration."
    return 0
  fi

  if [ -d server ]; then
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
setup_enterprise_checkout
hydrate_go_dependencies
hydrate_webapp_dependencies
hydrate_playwright_dependencies

log "AWS CLI: $(aws --version 2>&1 || printf 'not available')"
log "Install hook complete."
