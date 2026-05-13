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

enterprise_target() {
  if [ -n "${ENTERPRISE_DIR:-}" ]; then
    realpath -m "$ENTERPRISE_DIR"
  elif [ -n "${BUILD_ENTERPRISE_DIR:-}" ]; then
    case "$BUILD_ENTERPRISE_DIR" in
      /*) realpath -m "$BUILD_ENTERPRISE_DIR" ;;
      *) realpath -m "$ROOT/server/$BUILD_ENTERPRISE_DIR" ;;
    esac
  else
    realpath -m "$ROOT/../enterprise"
  fi
}

enterprise_branch() {
  if [ -n "${ENTERPRISE_BRANCH:-}" ]; then
    printf '%s\n' "$ENTERPRISE_BRANCH"
    return 0
  fi

  local branch
  branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
    printf '%s\n' "$branch"
  else
    printf '%s\n' "master"
  fi
}

sync_enterprise_repo() {
  if is_true "${CLOUD_AGENT_SKIP_ENTERPRISE:-false}"; then
    log "Skipping enterprise checkout because CLOUD_AGENT_SKIP_ENTERPRISE is set."
    return 0
  fi

  if [ -z "${CURSOR_GH_TOKEN:-}" ]; then
    log "Skipping enterprise checkout because CURSOR_GH_TOKEN is not set."
    return 0
  fi

  local target repo_url branch
  target="$(enterprise_target)"
  branch="$(enterprise_branch)"
  repo_url="https://github.com/mattermost/enterprise.git"

  (
    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' EXIT

    askpass="$tmp_dir/git-askpass.sh"
    cat >"$askpass" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *Password*) printf '%s\n' "${CURSOR_GH_TOKEN:?CURSOR_GH_TOKEN is required}" ;;
  *) printf '%s\n' "${CURSOR_GH_TOKEN:?CURSOR_GH_TOKEN is required}" ;;
esac
EOF
    chmod 700 "$askpass"

    while IFS='=' read -r name _; do
      case "$name" in
        GIT_CONFIG_COUNT | GIT_CONFIG_KEY_* | GIT_CONFIG_PARAMETERS | GIT_CONFIG_VALUE_*) unset "$name" ;;
      esac
    done < <(env)

    export GIT_ASKPASS="$askpass"
    export GIT_TERMINAL_PROMPT=0
    export GIT_CONFIG_GLOBAL=/dev/null
    export GIT_CONFIG_NOSYSTEM=1
    export GIT_CONFIG_SYSTEM=/dev/null
    export XDG_CONFIG_HOME="$tmp_dir/xdg"

    git_isolated() {
      git -c credential.helper= -c core.askPass="$askpass" -c credential.useHttpPath=true "$@"
    }

    sync_branch() {
      local requested_branch="$1"
      if git_isolated -C "$target" ls-remote --exit-code --heads origin "$requested_branch" >/dev/null 2>&1; then
        git_isolated -C "$target" fetch origin "$requested_branch"
        git_isolated -C "$target" checkout "$requested_branch" || git_isolated -C "$target" checkout -b "$requested_branch" "origin/$requested_branch"
        git_isolated -C "$target" pull --ff-only origin "$requested_branch"
      else
        log "Enterprise branch $requested_branch was not found; using master."
        git_isolated -C "$target" fetch origin master
        git_isolated -C "$target" checkout master || git_isolated -C "$target" checkout -b master origin/master
        git_isolated -C "$target" pull --ff-only origin master
      fi
    }

    mkdir -p "$(dirname "$target")"
    if [ -e "$target" ]; then
      if [ -d "$target/.git" ]; then
        git_isolated -C "$target" remote set-url origin "$repo_url"
        if git_isolated -C "$target" diff --quiet && git_isolated -C "$target" diff --cached --quiet; then
          sync_branch "$branch"
        else
          log "Skipping enterprise pull because $target has local changes."
        fi
      else
        log "$target exists and is not a git checkout."
        exit 1
      fi
    else
      git_isolated clone "$repo_url" "$target"
      sync_branch "$branch"
    fi
  )

  if [ -d "$target/.git" ]; then
    sudo ln -sfnT "$target" /enterprise
    if [ "$target" != "$HOME/enterprise" ]; then
      ln -sfnT "$target" "$HOME/enterprise"
    fi
    log "Enterprise checkout ready at $target"
  elif [ -L /enterprise ]; then
    sudo rm -f /enterprise
  fi
}

hydrate_go_dependencies() {
  if is_true "${CLOUD_AGENT_SKIP_GO_DEPS:-false}"; then
    log "Skipping Go dependency hydration."
    return 0
  fi

  if [ -d server ]; then
    local enterprise_dir
    enterprise_dir="$(enterprise_target)"
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

ensure_node
sync_enterprise_repo
hydrate_go_dependencies
hydrate_webapp_dependencies
hydrate_playwright_dependencies

log "AWS CLI: $(aws --version 2>&1 || printf 'not available')"
log "Install hook complete."
