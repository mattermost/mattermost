#!/usr/bin/env bash
#
# Backport safety check: every migration file on the current branch must also
# exist on the base branch (origin/master by default). A backport branch is an
# older subset of the base, so migrations the base has that the branch lacks are
# expected and are NOT flagged. Only files the branch HAS that the base does NOT
# (renamed, renumbered, typo'd, or otherwise stray) are reported, because
# changing a shipped migration breaks the upgrade path.
#
# Portable across the bash 3.2 that ships with macOS and Linux CI: uses only
# POSIX-ish tools plus process substitution, no bash 4 features.
#
set -euo pipefail
export LC_ALL=C

base_ref="${MM_MIGRATION_CHECK_BASE_REF:-origin/master}"
repo_root="$(git rev-parse --show-toplevel)"
migrations_dir="server/channels/db/migrations"

if ! git -C "$repo_root" rev-parse --verify --quiet "${base_ref}^{commit}" >/dev/null; then
    echo "Base ref '$base_ref' not found. Fetch it first (e.g. 'git fetch origin master')" >&2
    echo "or set MM_MIGRATION_CHECK_BASE_REF to an existing ref." >&2
    exit 2
fi

# path -> "driver/version_name.kind"; the up/down kind is part of the identity
# so a one-sided rename can't be masked by its surviving partner file.
norm='s#^'"$migrations_dir"'/([^/]+)/([0-9]+_.+)\.(up|down)\.sql$#\1/\2.\3#p'

base_files() {
    git -C "$repo_root" ls-tree -r --name-only "$base_ref" -- "$migrations_dir" \
        | sed -nE "$norm" | sort -u
}

branch_files() {
    # Tracked + untracked files actually present on disk, so a plain `mv`
    # without `git add` is still caught.
    git -C "$repo_root" ls-files --cached --others --exclude-standard -- "$migrations_dir" \
        | while IFS= read -r path; do
              [ -f "$repo_root/$path" ] && printf '%s\n' "$path"
          done \
        | sed -nE "$norm" | sort -u
}

stray="$(comm -23 <(branch_files) <(base_files))"

if [ -n "$stray" ]; then
    count="$(printf '%s\n' "$stray" | wc -l | tr -d '[:space:]')"
    echo "Found $count migration file(s) on this branch not present on base branch $base_ref:" >&2
    printf '%s\n' "$stray" | while IFS= read -r m; do
        echo "  - [${m%%/*}] ${m#*/}.sql exists on this branch but not on $base_ref; renaming, renumbering, or typo'ing a shipped migration breaks upgrades. Add a new migration instead." >&2
    done
    exit 1
fi

echo "All migrations on this branch exist on base branch $base_ref."
