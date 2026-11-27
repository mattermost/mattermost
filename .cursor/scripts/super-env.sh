#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
CLOUD_AGENT_LOG_TAG=super-env
# shellcheck source=cloud-agent-lib.sh
. "$ROOT/.cursor/scripts/cloud-agent-lib.sh"

export GOPATH="${GOPATH:-$HOME/go}"
export PATH="/usr/local/go/bin:$GOPATH/bin:/usr/local/bin:$PATH"

GOWORK_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/mattermost-super-env"

usage() {
  cat <<EOF
Usage: .cursor/scripts/super-env.sh <command> [args]

Works across the mattermost checkout and the mattermost-plugin-* checkouts next to it.
<plugin> is a short name (playbooks), a repo name (mattermost-plugin-playbooks), or a path.

Commands:
  list                       Show plugin checkouts, branches, Node pins, and link state.
  exec <plugin> -- <cmd...>  Run a command in the plugin with its .nvmrc Node on PATH
                             (and its linked go.work, if any).
  deploy <plugin...|all>     Build and deploy plugins to the local server with make deploy.
  link <plugin>              Build the plugin against this checkout's server/public
                             (and server/v8 when required) through an out-of-tree go.work.
  unlink <plugin>            Remove that go.work.
  sync                       Fast-forward clean plugin clones created by the install hook.
EOF
}

resolve_plugin() {
  local arg="${1:-}" name dir
  if [ -z "$arg" ]; then
    log "Missing <plugin> argument."
    return 1
  fi
  if [ -d "$arg" ] && is_git_work_tree "$arg"; then
    realpath -m "$arg"
    return 0
  fi
  name="$(plugin_repo_name "$arg")"
  if dir="$(find_sibling_checkout "$name")"; then
    printf '%s\n' "$dir"
    return 0
  fi
  log "No checkout of $name found. Clone it with: CLOUD_AGENT_PLUGINS=${name#mattermost-plugin-} bash .cursor/scripts/cloud-agent-install.sh"
  return 1
}

plugin_gowork() {
  local dir hash
  dir="$(realpath -m "$1")"
  hash="$(printf '%s\0%s' "$ROOT" "$dir" | sha256sum | cut -c1-12)"
  printf '%s/%s-%s.go.work\n' "$GOWORK_DIR" "$(basename "$dir")" "$hash"
}

plugin_id() {
  local dir="$1"
  if [ -f "$dir/plugin.json" ]; then
    sed -n 's/^[[:space:]]*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$dir/plugin.json" | head -n1
  fi
}

# Runs "$@" inside the plugin with its Node and linked go.work.
in_plugin() {
  local dir="$1" version bindir gowork
  shift
  if version="$(nvmrc_version "$dir")"; then
    bindir="$(node_bin_dir_for "$version")" || return 1
  else
    bindir="$(dirname "$(command -v node)")"
  fi
  gowork="$(plugin_gowork "$dir")"
  local cmd=("$@")
  # Some plugins (calls) rebuild ./go.work in setup-go-work, which fails when GOWORK points at an existing file.
  if [ -f "$gowork" ] && [ "${cmd[0]:-}" = "make" ] && has_make_target setup-go-work "$dir"; then
    cmd=(make -o setup-go-work "${cmd[@]:1}")
  fi
  (
    cd "$dir" || exit 1
    export PATH="$bindir:$PATH"
    if [ -f "$gowork" ]; then
      export GOWORK="$gowork"
    fi
    "${cmd[@]}"
  )
}

cmd_list() {
  local plugins=() dir name branch version id linked
  mapfile -t plugins < <(discover_plugin_checkouts)
  if [ "${#plugins[@]}" -eq 0 ]; then
    log "No plugin checkouts found. Set CLOUD_AGENT_SUPER_ENV=true (or CLOUD_AGENT_PLUGINS) and rerun .cursor/scripts/cloud-agent-install.sh."
    return 0
  fi

  local -a rows=("REPO	PLUGIN_ID	BRANCH	NODE	LINKED	PATH")
  for dir in "${plugins[@]}"; do
    name="$(basename "$dir")"
    branch="$(git -C "$dir" symbolic-ref --quiet --short HEAD 2>/dev/null || git -C "$dir" rev-parse --short HEAD)"
    version="$(nvmrc_version "$dir" || printf -- '-')"
    id="$(plugin_id "$dir")"
    linked=no
    [ -f "$(plugin_gowork "$dir")" ] && linked=yes
    rows+=("$name	${id:--}	$branch	$version	$linked	$dir")
  done
  printf '%s\n' "${rows[@]}" | awk -F '\t' '
    { for (i = 1; i <= NF; i++) { cell[NR, i] = $i; if (length($i) > width[i]) width[i] = length($i) } }
    END { for (r = 1; r <= NR; r++) { line = ""; for (i = 1; i < NF; i++) line = line sprintf("%-" width[i] + 2 "s", cell[r, i]); print line cell[r, NF] } }'
}

cmd_exec() {
  local dir
  dir="$(resolve_plugin "${1:-}")"
  shift
  if [ "${1:-}" = "--" ]; then
    shift
  fi
  if [ "$#" -eq 0 ]; then
    log "Usage: super-env.sh exec <plugin> -- <command...>"
    return 1
  fi
  in_plugin "$dir" "$@"
}

ensure_deploy_target() {
  local socket="${MM_LOCALSOCKETPATH:-/var/tmp/mattermost_local.socket}"
  if [ -S "$socket" ]; then
    return 0
  fi
  if [ -n "${MM_ADMIN_TOKEN:-}" ] || { [ -n "${MM_ADMIN_USERNAME:-}" ] && [ -n "${MM_ADMIN_PASSWORD:-}" ]; }; then
    return 0
  fi
  log "No local mode socket at $socket and no MM_ADMIN_TOKEN or MM_ADMIN_USERNAME/MM_ADMIN_PASSWORD."
  log "Start the server with MM_SERVICESETTINGS_ENABLELOCALMODE=true MM_PLUGINSETTINGS_ENABLEUPLOADS=true MM_FILESETTINGS_MAXFILESIZE=524288000 (see .cursor/cursor.md)."
  return 1
}

cmd_deploy() {
  if [ "$#" -eq 0 ]; then
    log "Usage: super-env.sh deploy <plugin...|all>"
    return 1
  fi
  ensure_deploy_target

  local targets=() arg
  if [ "$1" = "all" ]; then
    mapfile -t targets < <(discover_plugin_checkouts)
  else
    for arg in "$@"; do
      targets+=("$(resolve_plugin "$arg")")
    done
  fi

  export MM_SERVICESETTINGS_SITEURL="${MM_SERVICESETTINGS_SITEURL:-http://localhost:8065}"
  # Plugin Makefiles build only the current platform's server binary when this is set.
  export MM_SERVICESETTINGS_ENABLEDEVELOPER="${MM_SERVICESETTINGS_ENABLEDEVELOPER:-true}"

  local dir failed=()
  for dir in "${targets[@]}"; do
    log "Deploying $(basename "$dir")."
    in_plugin "$dir" make deploy || failed+=("$(basename "$dir")")
  done

  if [ "${#failed[@]}" -gt 0 ]; then
    log "Deploy failed for: ${failed[*]}"
    log "If the upload was rejected (size, uploads disabled, site URL not configured), restart the server with the settings in .cursor/cursor.md."
    return 1
  fi
}

cmd_link() {
  local dir gowork source_gowork="" source_dir work_json uses=() use
  dir="$(resolve_plugin "${1:-}")"
  gowork="$(plugin_gowork "$dir")"

  mkdir -p "$GOWORK_DIR"
  _LINK_TMP_DIR="$(mktemp -d "$GOWORK_DIR/.link.XXXXXX")"
  _LINK_TMP_GOWORK="$(mktemp "$GOWORK_DIR/.tmp.go.work.XXXXXX")"
  rm -f "$_LINK_TMP_GOWORK"
  trap 'rm -rf "${_LINK_TMP_DIR:-}" "${_LINK_TMP_GOWORK:-}" "${_LINK_TMP_GOWORK:+${_LINK_TMP_GOWORK}.sum}"' EXIT

  if [ -f "$dir/go.work" ]; then
    source_gowork="$dir/go.work"
  elif has_make_target setup-go-work "$dir"; then
    source_gowork="$_LINK_TMP_DIR/seed.go.work"
    (cd "$dir" && GOWORK="$source_gowork" make setup-go-work) >&2
  fi

  if [ -n "$source_gowork" ]; then
    source_dir="$(dirname "$source_gowork")"
    if ! work_json="$(cd "$dir" && GOWORK="$source_gowork" go work edit -json)"; then
      log "Failed to read Go workspace at $source_gowork; leaving existing link unchanged."
      return 1
    fi
    while read -r use; do
      [ -n "$use" ] || continue
      case "$use" in
        /*) uses+=("$(realpath -m "$use")") ;;
        *) uses+=("$(realpath -m "$source_dir/$use")") ;;
      esac
    done < <(jq -r '.Use[]?.DiskPath' <<< "$work_json")
    if [ "${#uses[@]}" -eq 0 ]; then
      log "No module paths found in $source_gowork; leaving existing link unchanged."
      return 1
    fi
  else
    uses+=("$dir")
  fi

  uses+=("$ROOT/server/public")
  if grep -q 'github.com/mattermost/mattermost/server/v8 ' "$dir/go.mod" 2>/dev/null; then
    uses+=("$ROOT/server")
  fi

  (cd "$dir" && GOWORK="$_LINK_TMP_GOWORK" go work init "${uses[@]}")
  mv -f "$_LINK_TMP_GOWORK" "$gowork"
  rm -f "$gowork.sum"
  log "Linked $(basename "$dir") to $ROOT/server via $gowork:"
  printf '  %s\n' "${uses[@]}" >&2
  log "super-env.sh exec/deploy use it automatically; for other shells run: export GOWORK=$gowork"
}

cmd_unlink() {
  local dir gowork
  dir="$(resolve_plugin "${1:-}")"
  gowork="$(plugin_gowork "$dir")"
  rm -f "$gowork" "$gowork.sum"
  log "Unlinked $(basename "$dir")."
}

cmd_sync() {
  local dir
  while read -r dir; do
    refresh_managed_checkout "$dir"
  done < <(discover_plugin_checkouts)
}

command="${1:-}"
[ "$#" -gt 0 ] && shift
case "$command" in
  list) cmd_list ;;
  exec) cmd_exec "$@" ;;
  deploy) cmd_deploy "$@" ;;
  link) cmd_link "$@" ;;
  unlink) cmd_unlink "$@" ;;
  sync) cmd_sync ;;
  "" | -h | --help | help) usage ;;
  *)
    usage >&2
    exit 1
    ;;
esac
