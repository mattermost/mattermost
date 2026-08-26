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

requested_enterprise_branch() {
  local branch
  if [ -n "${ENTERPRISE_BRANCH:-}" ]; then
    branch="$ENTERPRISE_BRANCH"
  elif ! branch="$(git -C "$ROOT" symbolic-ref --quiet --short HEAD 2>/dev/null)"; then
    return 1
  fi
  if ! git check-ref-format --branch "$branch" >/dev/null 2>&1; then
    return 1
  fi

  printf '%s\n' "$branch"
}

enterprise_branch_exists() {
  local branch="$1"
  local url
  url="$(enterprise_clone_url)"

  GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code --heads "$url" "refs/heads/$branch" >/dev/null 2>&1 && return 0
  local status=$?
  if [ "$status" -eq 2 ]; then
    return 1
  fi

  if ! command -v gh >/dev/null 2>&1; then
    return 2
  fi

  local exists
  if ! exists="$(
    gh api graphql \
      -f query="query(\$qualifiedName: String!) { repository(owner: \"mattermost\", name: \"enterprise\") { ref(qualifiedName: \$qualifiedName) { id } } }" \
      -f qualifiedName="refs/heads/$branch" \
      --jq '.data.repository.ref != null' 2>/dev/null
  )"; then
    return 2
  fi

  [ "$exists" = "true" ]
}

matching_enterprise_branch() {
  local branch
  if ! branch="$(requested_enterprise_branch)"; then
    log "No valid Enterprise branch was requested; using Enterprise's default branch."
    return 1
  fi

  local status
  if enterprise_branch_exists "$branch"; then
    printf '%s\n' "$branch"
    return 0
  else
    status=$?
  fi

  if [ "$status" -eq 1 ]; then
    log "Enterprise branch $branch does not exist; using Enterprise's default branch."
    return 1
  fi

  log "Could not verify Enterprise branch $branch; attempting it before the default branch."
  printf '%s\n' "$branch"
}

can_clone_into() {
  local dest="$1"
  local parent
  parent="$(dirname "$dest")"
  if [ ! -d "$parent" ] || [ ! -w "$parent" ] || [ ! -x "$parent" ]; then
    return 1
  fi
  if [ -L "$dest" ]; then
    return 1
  fi
  if [ ! -e "$dest" ]; then
    return 0
  fi
  if is_git_work_tree "$dest"; then
    return 0
  fi
  if [ ! -d "$dest" ] || [ ! -w "$dest" ] || [ ! -x "$dest" ]; then
    return 1
  fi

  local entries
  if ! entries="$(ls -A "$dest" 2>/dev/null)"; then
    return 1
  fi
  [ -z "$entries" ]
}

publish_enterprise_checkout() {
  local source="$1"
  local dest="$2"
  local lock="${dest}.clone-lock"
  local acquired=false

  local _
  for _ in {1..50}; do
    if mkdir "$lock" 2>/dev/null; then
      acquired=true
      break
    fi
    if is_git_work_tree "$dest"; then
      rm -rf "$source"
      log "Another process populated Enterprise checkout at $dest; reusing it."
      return 0
    fi
    sleep 0.1
  done

  if [ "$acquired" != true ]; then
    rm -rf "$source"
    log "Could not acquire Enterprise checkout lock at $lock."
    return 1
  fi

  if is_git_work_tree "$dest"; then
    rmdir "$lock"
    rm -rf "$source"
    log "Another process populated Enterprise checkout at $dest; reusing it."
    return 0
  fi
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    rmdir "$lock"
    rm -rf "$source"
    log "Could not publish Enterprise checkout because $dest appeared concurrently."
    return 1
  fi

  if mv "$source" "$dest"; then
    rmdir "$lock"
    return 0
  fi

  rmdir "$lock"
  rm -rf "$source"
  return 1
}

clone_enterprise_ref() {
  local dest="$1"
  local url="$2"
  shift 2
  local clone_args=("$@")
  local temp

  if ! temp="$(mktemp -d "$(dirname "$dest")/.enterprise-clone.XXXXXX")"; then
    return 1
  fi
  if GIT_TERMINAL_PROMPT=0 git clone "${clone_args[@]}" "$url" "$temp"; then
    publish_enterprise_checkout "$temp" "$dest"
    return $?
  fi
  rm -rf "$temp"

  if ! command -v gh >/dev/null 2>&1; then
    return 1
  fi

  log "git clone failed; retrying with GitHub CLI."
  if ! temp="$(mktemp -d "$(dirname "$dest")/.enterprise-clone.XXXXXX")"; then
    return 1
  fi
  if gh repo clone mattermost/enterprise "$temp" -- "${clone_args[@]}"; then
    publish_enterprise_checkout "$temp" "$dest"
    return $?
  fi
  rm -rf "$temp"
  return 1
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

  if ! can_clone_into "$dest"; then
    log "Refusing unusable enterprise clone dest: $dest"
    return 1
  fi

  if [ -e "$dest" ]; then
    if is_git_work_tree "$dest"; then
      return 0
    fi
    rmdir "$dest"
  fi

  log "Enterprise checkout missing; cloning mattermost/enterprise into $dest."
  log "Git-triggered automations stay single-repo; repositoryDependencies only scopes the GitHub token."
  mkdir -p "$(dirname "$dest")"

  local clone_args=(--depth 1 --single-branch)
  local branch
  if branch="$(matching_enterprise_branch)"; then
    clone_args+=(--branch "$branch")
    log "Trying matching Enterprise branch $branch."
  fi

  if clone_enterprise_ref "$dest" "$url" "${clone_args[@]}"; then
    return 0
  fi

  if [ -n "${branch:-}" ]; then
    log "Could not clone matching Enterprise branch $branch; retrying with the default branch."
    clone_args=(--depth 1 --single-branch)
    clone_enterprise_ref "$dest" "$url" "${clone_args[@]}" && return 0
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
