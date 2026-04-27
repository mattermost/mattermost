#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/mattermost/enterprise.git"
TARGET_DIR="${ENTERPRISE_DIR:-$HOME/enterprise}"

if [[ -z "${CURSOR_GH_TOKEN:-}" ]]; then
    echo "error: CURSOR_GH_TOKEN is required" >&2
    exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    echo "error: git is required" >&2
    exit 1
fi

tmp_dir="$(mktemp -d)"
cleanup() {
    rm -rf "$tmp_dir"
}
trap cleanup EXIT

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

# Remove inherited git config injected via environment variables, then run git
# with global/system config disabled so URL rewrites and credential helpers cannot
# replace CURSOR_GH_TOKEN with another token.
while IFS='=' read -r name _; do
    case "$name" in
        GIT_CONFIG_COUNT|GIT_CONFIG_KEY_*|GIT_CONFIG_PARAMETERS|GIT_CONFIG_VALUE_*) unset "$name" ;;
    esac
done < <(env)

export GIT_ASKPASS="$askpass"
export GIT_TERMINAL_PROMPT=0
export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_SYSTEM=/dev/null
export XDG_CONFIG_HOME="$tmp_dir/xdg"

git_isolated() {
    git \
        -c credential.helper= \
        -c core.askPass="$askpass" \
        -c credential.useHttpPath=true \
        "$@"
}

mkdir -p "$(dirname "$TARGET_DIR")"

if [[ -e "$TARGET_DIR" ]]; then
    if [[ ! -d "$TARGET_DIR/.git" ]]; then
        echo "error: $TARGET_DIR already exists and is not a git checkout" >&2
        exit 1
    fi

    current_url="$(git_isolated -C "$TARGET_DIR" remote get-url origin 2>/dev/null || true)"
    case "$current_url" in
        "$REPO_URL"|"https://github.com/mattermost/enterprise") ;;
        *)
            echo "error: $TARGET_DIR already exists with a different origin: $current_url" >&2
            exit 1
            ;;
    esac

    git_isolated -C "$TARGET_DIR" remote set-url origin "$REPO_URL"
    git_isolated -C "$TARGET_DIR" fetch origin
else
    work_dir="$tmp_dir/work"
    mkdir -p "$work_dir"
    (
        cd "$work_dir"
        git_isolated clone "$REPO_URL" "$TARGET_DIR"
    )
fi

git_isolated -C "$TARGET_DIR" remote set-url origin "$REPO_URL"
printf 'enterprise repository is available at %s\n' "$TARGET_DIR"
