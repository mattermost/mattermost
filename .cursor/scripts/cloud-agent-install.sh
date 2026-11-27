#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$ROOT"

CLOUD_AGENT_LOG_TAG=cloud-agent-install
# shellcheck source=cloud-agent-lib.sh
. "$ROOT/.cursor/scripts/cloud-agent-lib.sh"

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

  if [ ! -f "$ROOT/.nvmrc" ]; then
    log ".nvmrc is missing; cannot determine the required Node version."
    return 1
  fi
  tr -d '[:space:]' < "$ROOT/.nvmrc" | sed 's/^v//'
}

current_node_version() {
  command -v node >/dev/null 2>&1 || return 1
  node --version | sed 's/^v//'
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
  load_nvm
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
  local overrides=()
  if [ -n "${ENTERPRISE_CHECKOUT_DIR:-}" ]; then
    overrides+=("$ENTERPRISE_CHECKOUT_DIR")
  fi
  if [ -n "${ENTERPRISE_DIR:-}" ]; then
    overrides+=("$ENTERPRISE_DIR")
  fi
  if [ -n "${BUILD_ENTERPRISE_DIR:-}" ]; then
    case "$BUILD_ENTERPRISE_DIR" in
      /*) overrides+=("$BUILD_ENTERPRISE_DIR") ;;
      *) overrides+=("$ROOT/server/$BUILD_ENTERPRISE_DIR") ;;
    esac
  fi

  find_sibling_checkout enterprise "${overrides[@]}"
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
  dest="$(sibling_clone_dest enterprise)"
  log "Git-triggered automations stay single-repo; repositoryDependencies only scopes the GitHub token."
  clone_sibling_checkout mattermost/enterprise "$dest" "${ENTERPRISE_BRANCH:-}"
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

# Prints the plugin repo slugs to clone. CLOUD_AGENT_PLUGINS takes a comma- or
# space-separated list of names (playbooks, mattermost-plugin-playbooks), "all", or "none";
# CLOUD_AGENT_SUPER_ENV=true alone means "all".
requested_plugin_slugs() {
  local requested="${CLOUD_AGENT_PLUGINS:-}"
  if [ -z "$requested" ]; then
    is_true "${CLOUD_AGENT_SUPER_ENV:-false}" || return 0
    requested=all
  fi

  local manifest token name
  manifest="$(core_plugin_slugs)"
  for token in ${requested//,/ }; do
    case "$token" in
      all) printf '%s\n' "$manifest" ;;
      none) return 0 ;;
      *)
        name="$(plugin_repo_name "$token")"
        if ! grep -qx "mattermost/$name" <<< "$manifest"; then
          log "$name is not a core plugin; cloning only works if this run's git credentials can read it."
        fi
        printf 'mattermost/%s\n' "$name"
        ;;
    esac
  done | awk 'NF && !seen[$0]++'
}

ensure_plugin_checkouts() {
  local slug name dest
  while read -r slug; do
    [ -n "$slug" ] || continue
    name="${slug##*/}"
    if dest="$(find_sibling_checkout "$name")"; then
      refresh_managed_checkout "$dest" || true
      continue
    fi
    dest="$(sibling_clone_dest "$name")"
    clone_sibling_checkout "$slug" "$dest" "${CLOUD_AGENT_PLUGIN_BRANCH:-}" || \
      log "WARNING: could not clone $slug; continuing without it."
  done < <(requested_plugin_slugs)
}

hydrate_plugin() {
  local dir="$1" name version bindir
  name="$(basename "$dir")"
  log "Hydrating $name at $dir."

  if version="$(nvmrc_version "$dir")"; then
    bindir="$(node_bin_dir_for "$version")" || return 1
  else
    bindir="$(dirname "$(command -v node)")"
  fi

  (
    cd "$dir" || exit 1
    export PATH="$bindir:$PATH"

    if [ -f go.mod ]; then
      go mod download || exit 1
    fi

    if has_make_target webapp/node_modules; then
      local lockfile=webapp/package-lock.json lock_was_clean=false status=0
      git diff --quiet -- "$lockfile" 2>/dev/null && lock_was_clean=true
      make webapp/node_modules || status=$?
      # Plugin Makefiles use `npm install`, which rewrites the lockfile; keep checkouts clean.
      if [ "$lock_was_clean" = true ] && [ -f "$lockfile" ]; then
        git checkout --quiet -- "$lockfile" 2>/dev/null || true
      fi
      [ "$status" -eq 0 ] || exit "$status"
    elif [ -f webapp/package-lock.json ]; then
      npm ci --prefix webapp || exit 1
    fi
  ) || return 1

  log "$name ready (node $("$bindir/node" --version))."
}

ensure_plugins() {
  if is_true "${CLOUD_AGENT_SKIP_PLUGINS:-false}"; then
    log "Skipping plugin checkouts because CLOUD_AGENT_SKIP_PLUGINS is set."
    return 0
  fi

  ensure_plugin_checkouts

  local plugins=()
  mapfile -t plugins < <(discover_plugin_checkouts)
  if [ "${#plugins[@]}" -eq 0 ]; then
    log "No plugin checkouts found; set CLOUD_AGENT_SUPER_ENV=true to clone the core plugins."
    return 0
  fi

  if is_true "${CLOUD_AGENT_SKIP_PLUGIN_DEPS:-false}"; then
    log "Skipping plugin dependency hydration for ${#plugins[@]} plugin(s)."
    return 0
  fi

  local dir failed=()
  for dir in "${plugins[@]}"; do
    hydrate_plugin "$dir" || failed+=("$(basename "$dir")")
  done

  if [ "${#failed[@]}" -gt 0 ]; then
    log "WARNING: plugin hydration failed for: ${failed[*]}. Rerun this script or hydrate them manually."
  fi
  log "Plugins: ${#plugins[@]} checkout(s), ${#failed[@]} failed. Run .cursor/scripts/super-env.sh list for details."
}

ensure_go
ensure_node
ensure_enterprise_checkout
hydrate_go_dependencies
hydrate_webapp_dependencies
hydrate_playwright_dependencies
ensure_plugins

log "AWS CLI: $(aws --version 2>&1 || printf 'not available')"
log "Install hook complete."
