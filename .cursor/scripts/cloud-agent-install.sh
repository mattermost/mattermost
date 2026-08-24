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

is_git_work_tree() {
  [ "$(git -C "${1:-}" rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ]
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

NODE_VERSION="${CLOUD_AGENT_NODE_VERSION:-24.11.1}"

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
}

enterprise_build_dir() {
  case "$BUILD_ENTERPRISE_DIR" in
    /*) realpath -m "$BUILD_ENTERPRISE_DIR" ;;
    *) realpath -m "$ROOT/server/$BUILD_ENTERPRISE_DIR" ;;
  esac
}

default_enterprise_checkout() {
  realpath -m "$ROOT/../enterprise"
}

find_enterprise_checkout() {
  local candidates=()
  if [ -n "${ENTERPRISE_CHECKOUT_DIR:-}" ]; then
    candidates+=("$ENTERPRISE_CHECKOUT_DIR")
  fi
  if [ -n "${ENTERPRISE_DIR:-}" ]; then
    candidates+=("$ENTERPRISE_DIR")
  fi
  if [ -n "${BUILD_ENTERPRISE_DIR:-}" ]; then
    case "$BUILD_ENTERPRISE_DIR" in
      /*) candidates+=("$BUILD_ENTERPRISE_DIR") ;;
      *) candidates+=("$ROOT/server/$BUILD_ENTERPRISE_DIR") ;;
    esac
  fi

  candidates+=(
    "$(default_enterprise_checkout)"
    "$ROOT/../../enterprise"
    "$HOME/enterprise"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if is_git_work_tree "$candidate"; then
      realpath -m "$candidate"
      return 0
    fi
  done

  return 1
}

enterprise_clone_url() {
  printf 'https://github.com/mattermost/enterprise.git\n'
}

can_clone_into() {
  local dest="$1"
  local parent
  parent="$(dirname "$dest")"
  if [ ! -d "$parent" ] || [ ! -w "$parent" ]; then
    return 1
  fi
  if [ ! -e "$dest" ]; then
    return 0
  fi
  if is_git_work_tree "$dest"; then
    return 0
  fi
  [ -d "$dest" ] && [ -z "$(ls -A "$dest" 2>/dev/null)" ]
}

enterprise_clone_dest() {
  local sibling
  sibling="$(default_enterprise_checkout)"
  if can_clone_into "$sibling"; then
    printf '%s\n' "$sibling"
    return 0
  fi

  realpath -m "$HOME/enterprise"
}

clone_enterprise_checkout() {
  local dest="$1"
  local url
  url="$(enterprise_clone_url)"

  if [ -z "$dest" ] || [ "$dest" = "/" ] || [ "$(basename "$dest")" != "enterprise" ]; then
    log "Refusing unsafe enterprise clone dest: ${dest:-<empty>}"
    return 1
  fi

  if [ -e "$dest" ]; then
    if is_git_work_tree "$dest"; then
      return 0
    fi
    if [ -n "$(ls -A "$dest" 2>/dev/null)" ]; then
      log "Refusing to clone enterprise into non-empty path $dest"
      return 1
    fi
    rmdir "$dest"
  fi

  log "Enterprise checkout missing; cloning mattermost/enterprise into $dest."
  log "Git-triggered automations stay single-repo; repositoryDependencies only scopes the GitHub token."
  mkdir -p "$(dirname "$dest")"

  if GIT_TERMINAL_PROMPT=0 git clone --depth 1 --single-branch "$url" "$dest"; then
    return 0
  fi

  rm -rf "$dest"

  if command -v gh >/dev/null 2>&1; then
    log "git clone failed; retrying with GitHub CLI."
    if gh repo clone mattermost/enterprise "$dest" -- --depth 1 --single-branch; then
      return 0
    fi
    rm -rf "$dest"
  fi

  log "Failed to clone mattermost/enterprise. repositoryDependencies must include github.com/mattermost/enterprise so the GitHub token can access it."
  return 1
}

persist_build_enterprise_dir() {
  local target="$1"
  export BUILD_ENTERPRISE_DIR="$target"

  local default_target
  default_target="$(default_enterprise_checkout)"
  if [ "$target" = "$default_target" ]; then
    return 0
  fi

  local override="$ROOT/server/config.override.mk"
  if [ -f "$override" ] && grep -q '^BUILD_ENTERPRISE_DIR' "$override"; then
    return 0
  fi

  printf 'BUILD_ENTERPRISE_DIR := %s\n' "$target" >> "$override"
  log "Wrote BUILD_ENTERPRISE_DIR to $override so make uses the cloned checkout."
}

ensure_enterprise_checkout() {
  if is_true "${CLOUD_AGENT_SKIP_ENTERPRISE:-false}"; then
    log "Skipping enterprise verification because CLOUD_AGENT_SKIP_ENTERPRISE is set."
    return 0
  fi

  local target
  if target="$(find_enterprise_checkout)"; then
    persist_build_enterprise_dir "$target"
    log "Enterprise checkout ready at $target."
    return 0
  fi

  local dest
  dest="$(enterprise_clone_dest)"
  clone_enterprise_checkout "$dest"
  target="$(realpath -m "$dest")"
  if ! is_git_work_tree "$target"; then
    log "Enterprise clone completed but checkout was not found at $dest."
    return 1
  fi

  persist_build_enterprise_dir "$target"
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
ensure_enterprise_checkout
hydrate_go_dependencies
hydrate_webapp_dependencies
hydrate_playwright_dependencies

log "AWS CLI: $(aws --version 2>&1 || printf 'not available')"
log "Install hook complete."
