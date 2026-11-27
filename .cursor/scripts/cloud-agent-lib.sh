#!/usr/bin/env bash
# Shared helpers for the Cloud Agent hooks and super-env.sh. Source it after setting
# ROOT (the mattermost checkout) and optionally CLOUD_AGENT_LOG_TAG.

log() {
  printf '[%s] %s\n' "${CLOUD_AGENT_LOG_TAG:-cloud-agent}" "$*" >&2
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

has_make_target() {
  local target="$1" dir="${2:-.}"
  [ -f "$dir/Makefile" ] && make -C "$dir" -n "$target" >/dev/null 2>&1
}

# --- Node via nvm -----------------------------------------------------------

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    log "nvm is not installed; cloning v${CLOUD_AGENT_NVM_VERSION:-0.40.3}."
    git clone --depth 1 --branch "v${CLOUD_AGENT_NVM_VERSION:-0.40.3}" https://github.com/nvm-sh/nvm.git "$NVM_DIR" || return 1
  fi
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
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

nvmrc_version() {
  local dir="$1" file
  for file in "$dir/.nvmrc" "$dir/.node-version" "$dir/webapp/.nvmrc"; do
    if [ -f "$file" ]; then
      tr -d '[:space:]' < "$file" | sed 's/^v//'
      return 0
    fi
  done
  return 1
}

# Prints the bin dir of an nvm-managed Node matching the pin, installing it if needed.
# Never changes the nvm default alias or the /usr/local/bin symlinks.
node_bin_dir_for() {
  local version="$1" node_path
  load_nvm >/dev/null || return 1
  if ! node_path="$(nvm which "$version" 2>/dev/null)" || [ ! -x "$node_path" ]; then
    log "Installing Node ${version} via nvm."
    nvm install --no-progress "$version" >&2 || return 1
    node_path="$(nvm which "$version" 2>/dev/null)" || return 1
  fi
  dirname "$node_path"
}

# --- Sibling repositories ---------------------------------------------------
# Cursor's multi-repo environments clone selected repos as siblings. Single-repo runs
# (including git-triggered automations) do not, so these helpers find an existing
# checkout or clone one.

github_clone_url() {
  printf 'https://github.com/%s.git\n' "$1"
}

# Prints the first git work tree among the candidates, then $ROOT/../<name>,
# $ROOT/../../<name>, and $HOME/<name>.
find_sibling_checkout() {
  local name="$1"
  shift
  local candidate
  for candidate in "$@" "$ROOT/../$name" "$ROOT/../../$name" "$HOME/$name"; do
    if [ -n "$candidate" ] && is_git_work_tree "$candidate"; then
      realpath -m "$candidate"
      return 0
    fi
  done
  return 1
}

# Returns 0 if the branch exists, 1 if it does not, and 2 if that could not be determined.
remote_branch_exists() {
  local slug="$1" branch="$2"

  GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code --heads "$(github_clone_url "$slug")" "refs/heads/$branch" >/dev/null 2>&1 && return 0
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
      -f query="query(\$owner: String!, \$name: String!, \$qualifiedName: String!) { repository(owner: \$owner, name: \$name) { ref(qualifiedName: \$qualifiedName) { id } } }" \
      -f owner="${slug%%/*}" \
      -f name="${slug##*/}" \
      -f qualifiedName="refs/heads/$branch" \
      --jq '.data.repository.ref != null' 2>/dev/null
  )"; then
    return 2
  fi

  [ "$exists" = "true" ]
}

# Prints the branch to try first: the override if set, otherwise the mattermost
# checkout's current branch so like-named cross-repo branches line up.
requested_branch() {
  local override="${1:-}" branch
  if [ -n "$override" ]; then
    branch="$override"
  elif ! branch="$(git -C "$ROOT" symbolic-ref --quiet --short HEAD 2>/dev/null)"; then
    return 1
  fi
  git check-ref-format --branch "$branch" >/dev/null 2>&1 || return 1
  printf '%s\n' "$branch"
}

matching_remote_branch() {
  local slug="$1" override="${2:-}" name branch status
  name="${slug##*/}"
  if ! branch="$(requested_branch "$override")"; then
    log "No valid $name branch was requested; using $name's default branch."
    return 1
  fi

  if remote_branch_exists "$slug" "$branch"; then
    printf '%s\n' "$branch"
    return 0
  else
    status=$?
  fi

  if [ "$status" -eq 1 ]; then
    log "$name branch $branch does not exist; using $name's default branch."
    return 1
  fi

  log "Could not verify $name branch $branch; attempting it before the default branch."
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

publish_checkout() {
  local source="$1"
  local dest="$2"

  if mv -T -n "$source" "$dest" && [ ! -e "$source" ]; then
    return 0
  fi

  rm -rf "$source"
  if is_git_work_tree "$dest"; then
    log "Another process populated $dest; reusing it."
    return 0
  fi

  log "Could not publish checkout at $dest."
  return 1
}

clone_ref() {
  local slug="$1" dest="$2"
  shift 2
  local clone_args=("$@")
  local temp

  if ! temp="$(mktemp -d "$(dirname "$dest")/.$(basename "$dest")-clone.XXXXXX")"; then
    return 1
  fi
  if GIT_TERMINAL_PROMPT=0 git clone "${clone_args[@]}" "$(github_clone_url "$slug")" "$temp"; then
    publish_checkout "$temp" "$dest"
    return $?
  fi
  rm -rf "$temp"

  if ! command -v gh >/dev/null 2>&1; then
    return 1
  fi

  log "git clone of $slug failed; retrying with GitHub CLI."
  if ! temp="$(mktemp -d "$(dirname "$dest")/.$(basename "$dest")-clone.XXXXXX")"; then
    return 1
  fi
  if gh repo clone "$slug" "$temp" -- "${clone_args[@]}"; then
    publish_checkout "$temp" "$dest"
    return $?
  fi
  rm -rf "$temp"
  return 1
}

# Prints $ROOT/../<name> when it can hold a clone, otherwise $HOME/<name>.
sibling_clone_dest() {
  local name="$1" sibling
  sibling="$(realpath -m "$ROOT/../$name")"
  if can_clone_into "$sibling"; then
    printf '%s\n' "$sibling"
    return 0
  fi
  realpath -m "$HOME/$name"
}

# Shallow-clones <owner/repo> into dest, preferring a like-named branch and falling
# back to the default branch. Marks the clone so refresh_managed_checkout may update it.
clone_sibling_checkout() {
  local slug="$1" dest="$2" branch_override="${3:-}"
  local name="${slug##*/}"

  if [ -z "$dest" ] || [ "$dest" = "/" ] || [ "$(basename "$dest")" != "$name" ]; then
    log "Refusing unsafe $name clone dest: ${dest:-<empty>}"
    return 1
  fi

  if ! can_clone_into "$dest"; then
    log "Refusing unusable $name clone dest: $dest"
    return 1
  fi

  if [ -e "$dest" ]; then
    if is_git_work_tree "$dest"; then
      return 0
    fi
    rmdir "$dest"
  fi

  log "$name checkout missing; cloning $slug into $dest."
  mkdir -p "$(dirname "$dest")"

  local clone_args=(--depth 1 --single-branch)
  local branch=""
  if branch="$(matching_remote_branch "$slug" "$branch_override")"; then
    log "Trying matching $name branch $branch."
    if clone_ref "$slug" "$dest" "${clone_args[@]}" --branch "$branch"; then
      git -C "$dest" config cursor.cloudAgentClone true
      return 0
    fi
    log "Could not clone matching $name branch $branch; retrying with the default branch."
  fi

  if clone_ref "$slug" "$dest" "${clone_args[@]}"; then
    git -C "$dest" config cursor.cloudAgentClone true
    return 0
  fi

  log "Failed to clone $slug. Check that the repo exists and that this run's git credentials can read it; add it to the multi-repo saved environment if it is private."
  return 1
}

# Fast-forwards a checkout created by clone_sibling_checkout when it is clean and has
# no local commits. Checkouts Cursor or a developer created are never touched.
refresh_managed_checkout() {
  local dir="$1" name upstream
  name="$(basename "$dir")"
  [ "$(git -C "$dir" config --get cursor.cloudAgentClone 2>/dev/null)" = "true" ] || return 0
  if ! upstream="$(git -C "$dir" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
    return 0
  fi
  if [ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ] || \
     ! git -C "$dir" merge-base --is-ancestor HEAD '@{u}' 2>/dev/null; then
    log "$name has local changes or commits; leaving it as is."
    return 0
  fi
  if ! GIT_TERMINAL_PROMPT=0 git -C "$dir" fetch --quiet --depth 1 origin; then
    log "Could not fetch $name; leaving it as is."
    return 0
  fi
  git -C "$dir" reset --quiet --keep "$upstream" && log "$name is at $(git -C "$dir" rev-parse --short HEAD) ($upstream)."
}

# --- Mattermost plugins -----------------------------------------------------

# Plugins that CLOUD_AGENT_SUPER_ENV=true and CLOUD_AGENT_PLUGINS=all clone. Cloning needs
# the plugin repos to be readable by the checkout's git credentials; the multi-repo saved
# environment grants that, repositoryDependencies does not. mattermost-plugin-dataminr is
# left out because the Cloud Agent token cannot read it.
CORE_PLUGIN_SLUGS=(
  mattermost/mattermost-plugin-agents
  mattermost/mattermost-plugin-boards-v2
  mattermost/mattermost-plugin-calls
  mattermost/mattermost-plugin-channel-export
  mattermost/mattermost-plugin-github
  mattermost/mattermost-plugin-gitlab
  mattermost/mattermost-plugin-google-calendar
  mattermost/mattermost-plugin-google-drive
  mattermost/mattermost-plugin-google-meet
  mattermost/mattermost-plugin-jira
  mattermost/mattermost-plugin-legal-hold
  mattermost/mattermost-plugin-metrics
  mattermost/mattermost-plugin-mscalendar
  mattermost/mattermost-plugin-msteams-meetings
  mattermost/mattermost-plugin-playbooks
  mattermost/mattermost-plugin-weave
  mattermost/mattermost-plugin-zoom
)

core_plugin_slugs() {
  printf '%s\n' "${CORE_PLUGIN_SLUGS[@]}"
}

plugin_repo_name() {
  local name="${1##*/}"
  case "$name" in
    mattermost-plugin-*) printf '%s\n' "$name" ;;
    *) printf 'mattermost-plugin-%s\n' "$name" ;;
  esac
}

# Prints every mattermost-plugin-* git work tree in the places find_sibling_checkout probes.
discover_plugin_checkouts() {
  local parent dir
  for parent in "$ROOT/.." "$ROOT/../.." "$HOME"; do
    for dir in "$parent"/mattermost-plugin-*; do
      if [ -d "$dir" ] && is_git_work_tree "$dir"; then
        realpath -m "$dir"
      fi
    done
  done | awk '!seen[$0]++'
}
