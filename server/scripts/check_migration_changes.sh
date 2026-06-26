#!/usr/bin/env bash
#
# Backport safety check (Postgres only).
#
# A release branch is an older subset of master. When a PR backports a migration
# it must keep the exact version number and name that migration already has on
# master; renumbering or renaming a shipped migration breaks the upgrade path
# (the MM-68848 class of bug).
#
# We therefore only look at the migrations this PR ADDS on top of its base branch
# and require each of them to already exist on master. Files that are already on
# the base branch are left untouched, so historical states such as the Postgres
# migrations renamed before the pre-migration infra landed do not produce false
# positives.
#
# MySQL is intentionally skipped: support was dropped after v11.0, so older
# release branches still carry MySQL migrations that no longer exist on master.
#
# Portable across the bash 3.2 that ships with macOS and Linux CI: uses only
# POSIX-ish tools plus process substitution, no bash 4 features.
#
set -euo pipefail
export LC_ALL=C

# Branch the PR targets. The migrations the PR adds are everything HEAD has that
# this ref does not.
base_ref="${MM_MIGRATION_CHECK_BASE_REF:-origin/master}"
# Canonical source of shipped migrations the additions must match.
canonical_ref="${MM_MIGRATION_CHECK_CANONICAL_REF:-origin/master}"

repo_root="$(git rev-parse --show-toplevel)"
# Postgres only; MySQL migrations linger on old release branches and are skipped.
migrations_dir="server/channels/db/migrations/postgres"

for ref in "$base_ref" "$canonical_ref"; do
    if ! git -C "$repo_root" rev-parse --verify --quiet "${ref}^{commit}" >/dev/null; then
        echo "Ref '$ref' not found. Fetch it first (e.g. 'git fetch origin master')" >&2
        echo "or set MM_MIGRATION_CHECK_BASE_REF / MM_MIGRATION_CHECK_CANONICAL_REF." >&2
        exit 2
    fi
done

# path -> "version_name.kind"; the up/down kind is part of the identity so a
# one-sided rename can't be masked by its surviving partner file.
norm='s#^'"$migrations_dir"'/([0-9]+_.+)\.(up|down)\.sql$#\1.\2#p'

ref_files() {
    git -C "$repo_root" ls-tree -r --name-only "$1" -- "$migrations_dir" \
        | sed -nE "$norm" | sort -u
}

head_files() {
    # Tracked + untracked files actually present on disk, so a plain `mv`
    # without `git add` is still caught.
    git -C "$repo_root" ls-files --cached --others --exclude-standard -- "$migrations_dir" \
        | while IFS= read -r path; do
              [ -f "$repo_root/$path" ] && printf '%s\n' "$path"
          done \
        | sed -nE "$norm" | sort -u
}

# Migrations this PR adds on top of its base branch.
added="$(comm -23 <(head_files) <(ref_files "$base_ref"))"

# Of those, the ones that don't exist on the canonical branch are renames,
# renumbers, or otherwise stray.
stray="$(comm -23 <(printf '%s\n' "$added" | sed '/^$/d') <(ref_files "$canonical_ref"))"

if [ -n "$stray" ]; then
    count="$(printf '%s\n' "$stray" | wc -l | tr -d '[:space:]')"
    echo "Found $count migration file(s) added by this branch that do not exist on $canonical_ref:" >&2
    printf '%s\n' "$stray" | while IFS= read -r m; do
        echo "  - ${m}.sql is added on this branch but not present on $canonical_ref; renaming or renumbering a shipped migration breaks upgrades. Add a new migration instead." >&2
    done
    exit 1
fi

echo "All migrations added by this branch exist on $canonical_ref."
