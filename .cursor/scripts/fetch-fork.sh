#!/usr/bin/env bash
# Clones one of the Mattermost dependency forks next to this checkout and wires
# it into the Go workspace, so a change to the fork can be exercised through the
# server code that consumes it before the fork change is merged and tagged.
#
# Usage: .cursor/scripts/fetch-fork.sh pdf
#
# The forks are not checked out at boot. Git-triggered agents launch in a
# single-repo layout, where repositoryDependencies only widens the Cloud Agent
# GitHub token; see .cursor/README.md. Run this only when the work actually
# reaches into a fork.
set -Eeuo pipefail

log() {
  printf '[fetch-fork] %s\n' "$*" >&2
}

is_git_work_tree() {
  [ "$(git -C "${1:-}" rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ]
}

is_expected_fork_checkout() {
  local candidate="${1:-}"
  local module
  if [ -z "${FORK_MODULE:-}" ] || [ ! -f "$candidate/go.mod" ]; then
    return 1
  fi
  module="$(awk '$1 == "module" { print $2; exit }' "$candidate/go.mod")"
  [ "$module" = "$FORK_MODULE" ]
}

is_usable_fork_checkout() {
  is_git_work_tree "${1:-}" && is_expected_fork_checkout "${1:-}"
}

# Absolute path for a target that may not exist yet. `abspath` would do it,
# but it is GNU-only, and a silently empty result here is worse than a loud
# failure: it ends with `go work use ""` quietly doing nothing.
abspath() {
  local p="${1:-}"
  if [ -z "$p" ]; then
    return 1
  fi
  if [ -d "$p" ]; then
    (cd "$p" && pwd -P)
    return 0
  fi
  local dir base
  dir="$(dirname "$p")"
  base="$(basename "$p")"
  if [ -d "$dir" ]; then
    printf '%s/%s\n' "$(cd "$dir" && pwd -P)" "$base"
  else
    printf '%s\n' "$p"
  fi
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

FORK="${1:-}"

# Allowlist. Adding a fork here also needs an entry in repositoryDependencies in
# .cursor/environment.json, or the token cannot read it.
case "$FORK" in
  pdf)
    FORK_REPO="mattermost/pdf"
    FORK_MODULE="github.com/mattermost/pdf"
    FORK_KIND="go"
    ;;
  "")
    log "Usage: .cursor/scripts/fetch-fork.sh <fork>"
    log "Known forks: pdf"
    exit 2
    ;;
  *)
    log "Unknown fork: $FORK"
    log "Known forks: pdf"
    log "Add it to the case statement here and to repositoryDependencies in .cursor/environment.json."
    exit 2
    ;;
esac

fork_clone_url() {
  printf 'https://github.com/%s.git\n' "$FORK_REPO"
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
  if is_usable_fork_checkout "$dest"; then
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

find_fork_checkout() {
  local candidate
  for candidate in "$ROOT/../$FORK" "$ROOT/../../$FORK" "$HOME/$FORK"; do
    if is_usable_fork_checkout "$candidate"; then
      abspath "$candidate"
      return 0
    fi
  done
  return 1
}

fork_clone_dest() {
  local sibling
  sibling="$(abspath "$ROOT/../$FORK")"
  if can_clone_into "$sibling"; then
    printf '%s\n' "$sibling"
    return 0
  fi
  abspath "$HOME/$FORK"
}

publish_fork_checkout() {
  local source="$1"
  local dest="$2"
  local lock waited=0
  lock="$(dirname "$dest")/.$(basename "$dest").publish.lock"

  if ! mkdir "$lock" 2>/dev/null; then
    rm -rf "$source"
    while [ "$waited" -lt 10 ]; do
      if is_usable_fork_checkout "$dest"; then
        log "Another process populated $FORK_REPO at $dest; reusing it."
        return 0
      fi
      if [ ! -d "$lock" ]; then
        break
      fi
      sleep 1
      waited=$((waited + 1))
    done
    if is_usable_fork_checkout "$dest"; then
      log "Another process populated $FORK_REPO at $dest; reusing it."
      return 0
    fi
    log "Could not publish $FORK_REPO checkout at $dest."
    return 1
  fi

  if is_usable_fork_checkout "$dest"; then
    rmdir "$lock" 2>/dev/null || true
    rm -rf "$source"
    log "Another process populated $FORK_REPO at $dest; reusing it."
    return 0
  fi

  if [ -e "$dest" ]; then
    rmdir "$dest" 2>/dev/null || {
      rmdir "$lock" 2>/dev/null || true
      rm -rf "$source"
      log "Could not publish $FORK_REPO checkout at $dest."
      return 1
    }
  fi

  if mv "$source" "$dest"; then
    rmdir "$lock" 2>/dev/null || true
    return 0
  fi

  rmdir "$lock" 2>/dev/null || true
  rm -rf "$source"
  if is_usable_fork_checkout "$dest"; then
    log "Another process populated $FORK_REPO at $dest; reusing it."
    return 0
  fi
  log "Could not publish $FORK_REPO checkout at $dest."
  return 1
}

clone_fork() {
  local dest="$1"
  local url temp
  url="$(fork_clone_url)"

  if [ -z "$dest" ] || [ "$dest" = "/" ] || [ "$(basename "$dest")" != "$FORK" ]; then
    log "Refusing unsafe clone dest: ${dest:-<empty>}"
    return 1
  fi

  if is_usable_fork_checkout "$dest"; then
    return 0
  fi

  if ! can_clone_into "$dest"; then
    log "Refusing unusable clone dest: $dest"
    return 1
  fi

  if [ -e "$dest" ] && ! is_git_work_tree "$dest"; then
    rmdir "$dest"
  fi

  log "Cloning $FORK_REPO into $dest."
  mkdir -p "$(dirname "$dest")"

  # Full history, not --depth 1: fixing a fork usually means reading how it
  # diverged from upstream, and a shallow clone cannot be pushed from either.
  if ! temp="$(mktemp -d "$(dirname "$dest")/.${FORK}-clone.XXXXXX")"; then
    return 1
  fi
  if GIT_TERMINAL_PROMPT=0 git clone "$url" "$temp"; then
    publish_fork_checkout "$temp" "$dest"
    return $?
  fi
  rm -rf "$temp"

  if ! command -v gh >/dev/null 2>&1; then
    return 1
  fi

  log "git clone failed; retrying with GitHub CLI."
  if ! temp="$(mktemp -d "$(dirname "$dest")/.${FORK}-clone.XXXXXX")"; then
    return 1
  fi
  if gh repo clone "$FORK_REPO" "$temp"; then
    publish_fork_checkout "$temp" "$dest"
    return $?
  fi
  rm -rf "$temp"

  log "Failed to clone $FORK_REPO. repositoryDependencies in .cursor/environment.json must include github.com/$FORK_REPO so the Cloud Agent token can read it."
  return 1
}

# Adds the fork to server/go.work. go.work is gitignored, so this cannot leak
# into a commit the way a go.mod replace directive can. `make setup-go-work`
# rewrites go.work from scratch and drops the fork. Pass SKIP_SETUP_GO_WORK=true
# to make targets while a fork is wired, or re-run this script after they finish.
wire_go_workspace() {
  local target="${1:-}"

  if [ -z "$target" ]; then
    log "No checkout path to wire into the Go workspace."
    return 1
  fi

  if [ ! -d "$ROOT/server" ]; then
    log "No server directory; skipping Go workspace wiring."
    return 0
  fi

  if [ ! -f "$ROOT/server/go.work" ]; then
    log "server/go.work is missing; run 'make setup-go-work' in server/ first, then re-run this script."
    return 1
  fi

  (
    cd "$ROOT/server"
    go work use "$target"
  )

  if ! grep -Fq "$target" "$ROOT/server/go.work"; then
    log "go work use did not add $target to server/go.work."
    return 1
  fi

  log "Added $target to server/go.work. The server now builds against this checkout."
  log "Pass SKIP_SETUP_GO_WORK=true to make targets while this fork is wired, or re-run this script if setup-go-work rewrites go.work."
}

TARGET=""
if TARGET="$(find_fork_checkout)" && [ -n "$TARGET" ]; then
  log "$FORK_REPO checkout already present at $TARGET."
else
  DEST="$(fork_clone_dest)"
  clone_fork "$DEST"
  TARGET="$(abspath "$DEST")"
  if [ -z "$TARGET" ] || ! is_usable_fork_checkout "$TARGET"; then
    log "Clone completed but no usable $FORK_REPO checkout was found at $DEST."
    exit 1
  fi
fi

case "$FORK_KIND" in
  go) wire_go_workspace "$TARGET" ;;
esac

log "$FORK_REPO ready at $TARGET"
printf '%s\n' "$TARGET"
