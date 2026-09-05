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

NVM_VERSION="${CLOUD_AGENT_NVM_VERSION:-0.40.3}"

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

required_node_version() {
  if [ -n "${CLOUD_AGENT_NODE_VERSION:-}" ]; then
    printf '%s\n' "${CLOUD_AGENT_NODE_VERSION#v}"
    return 0
  fi

  local version_file="$ROOT/.nvmrc"
  if [ ! -f "$version_file" ]; then
    log ".nvmrc is missing; cannot determine the required Node version."
    return 1
  fi
  tr -d '[:space:]' < "$version_file" | sed 's/^v//'
}

current_node_version() {
  command -v node >/dev/null 2>&1 || return 1
  node --version | sed 's/^v//'
}

# .nvmrc may pin a major or major.minor (e.g. 24.11); node --version is always
# major.minor.patch. Require an exact match on every component the pin specifies.
node_version_matches() {
  local required="$1"
  local current="$2"
  if [ -z "$required" ] || [ -z "$current" ]; then
    return 1
  fi

  local r1 r2 r3 c1 c2 c3
  IFS=. read -r r1 r2 r3 <<< "$required"
  IFS=. read -r c1 c2 c3 <<< "$current"
  [ "$c1" = "$r1" ] || return 1
  [ -z "${r2:-}" ] || [ "$c2" = "$r2" ] || return 1
  [ -z "${r3:-}" ] || [ "$c3" = "$r3" ] || return 1
  return 0
}

ensure_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    return 0
  fi

  log "nvm is not installed; cloning v${NVM_VERSION}."
  git clone --depth 1 --branch "v${NVM_VERSION}" https://github.com/nvm-sh/nvm.git "$NVM_DIR"
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
}

link_node_bins() {
  local resolved="$1"
  local bindir="${NVM_DIR}/versions/node/v${resolved}/bin"
  if [ ! -x "${bindir}/node" ]; then
    log "nvm Node binary not found at ${bindir}/node."
    return 1
  fi
  sudo ln -sfn "${bindir}/node" /usr/local/bin/node
  sudo ln -sfn "${bindir}/npm" /usr/local/bin/npm
  sudo ln -sfn "${bindir}/npx" /usr/local/bin/npx
}

persist_node_path() {
  local marker="# mattermost-cloud-agent-node-path"
  local rc="${HOME}/.bashrc"
  if [ -f "$rc" ] && grep -Fq "$marker" "$rc"; then
    return 0
  fi
  {
    echo "$marker"
    printf 'export NVM_DIR=%q\n' "${NVM_DIR:-$HOME/.nvm}"
    echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'
  } >> "$rc"
}

install_node() {
  local version="$1"
  ensure_nvm
  log "Installing Node ${version} via nvm."
  nvm install "$version"
  nvm alias default "$version"
  nvm use "$version"

  local resolved
  resolved="$(current_node_version)"
  link_node_bins "$resolved"
}

ensure_node() {
  local required current
  required="$(required_node_version)"
  ensure_nvm
  nvm use "$required" >/dev/null 2>&1 || true

  current="$(current_node_version || true)"
  if ! node_version_matches "$required" "$current"; then
    log "Node ${current:-not found} does not match .nvmrc (${required}); installing."
    install_node "$required"
    hash -r
    persist_node_path
    current="$(current_node_version || true)"
  fi

  if ! node_version_matches "$required" "$current"; then
    log "Node is ${current:-not found} after install; expected ${required}."
    return 1
  fi

  link_node_bins "$current"
  persist_node_path

  if ! command -v npm >/dev/null 2>&1; then
    log "npm is not available after Node ${current} install."
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

  if mv -T -n "$source" "$dest" && [ ! -e "$source" ]; then
    return 0
  fi

  rm -rf "$source"
  if is_git_work_tree "$dest"; then
    log "Another process populated Enterprise checkout at $dest; reusing it."
    return 0
  fi

  log "Could not publish Enterprise checkout at $dest."
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
