#!/usr/bin/env bash
set -euo pipefail

base_ref="${MM_MIGRATION_CHECK_BASE_REF:-origin/master}"
repo_root="$(git rev-parse --show-toplevel)"
migrations_dir="server/channels/db/migrations"

declare -A base_migrations=()
declare -A branch_migrations=()

collect_base_migrations() {
    local path driver stem

    while IFS= read -r path; do
        if [[ "$path" =~ ^${migrations_dir}/([^/]+)/([0-9]+_.+)\.(up|down)\.sql$ ]]; then
            driver="${BASH_REMATCH[1]}"
            stem="${BASH_REMATCH[2]}"
            base_migrations["$driver/$stem"]=1
        fi
    done < <(git -C "$repo_root" ls-tree -r --name-only "$base_ref" -- "$migrations_dir")
}

collect_branch_migrations() {
    local path driver stem

    while IFS= read -r path; do
        if [[ ! -f "$repo_root/$path" ]]; then
            continue
        fi
        if [[ "$path" =~ ^${migrations_dir}/([^/]+)/([0-9]+_.+)\.(up|down)\.sql$ ]]; then
            driver="${BASH_REMATCH[1]}"
            stem="${BASH_REMATCH[2]}"
            branch_migrations["$driver/$stem"]=1
        fi
    done < <(git -C "$repo_root" ls-files --cached --others --exclude-standard -- "$migrations_dir")
}

collect_base_migrations
collect_branch_migrations

missing=()
for migration in "${!base_migrations[@]}"; do
    if [[ -z "${branch_migrations[$migration]+x}" ]]; then
        missing+=("$migration")
    fi
done

if (( ${#missing[@]} > 0 )); then
    echo "Found ${#missing[@]} migration(s) that changed relative to base branch $base_ref:" >&2
    while IFS= read -r migration; do
        driver="${migration%%/*}"
        stem="${migration#*/}"
        echo "  - [$driver] migration $stem exists on the base branch but is missing from the branch; deleting, renaming, or renumbering a shipped migration breaks upgrades. Add a new migration instead." >&2
    done < <(printf '%s\n' "${missing[@]}" | sort)
    exit 1
fi

echo "All existing migrations match base branch $base_ref."
