#!/bin/bash

# This script enables or disables Claude documentation and skills locally.
#
# Usage:
#   ./claude-docs.sh enable [--docs] [--skills]
#   ./claude-docs.sh disable [--docs] [--skills]
#
# Flags:
#   --docs     Target CLAUDE.md files only
#   --skills   Target .claude/skills/ only
#   (no flag)  Target both
#
# The disable command uses `git update-index --skip-worktree` so that git
# ignores the local deletions and your `git status` remains clean.

set -e

usage() {
    echo "Usage: $0 {enable|disable} [--docs] [--skills]"
    echo ""
    echo "  enable   Restore files to your working tree"
    echo "  disable  Remove files locally (git status stays clean)"
    echo ""
    echo "Flags:"
    echo "  --docs     Target CLAUDE.md files only"
    echo "  --skills   Target .claude/skills/ only"
    echo "  (no flag)  Target both"
    exit 1
}

if [ $# -lt 1 ]; then
    usage
fi

ACTION="$1"
shift

DOCS=false
SKILLS=false

while [ $# -gt 0 ]; do
    case "$1" in
        --docs)   DOCS=true ;;
        --skills) SKILLS=true ;;
        *)        usage ;;
    esac
    shift
done

# If neither flag is set, target both
if [ "$DOCS" = false ] && [ "$SKILLS" = false ]; then
    DOCS=true
    SKILLS=true
fi

case "$ACTION" in
    enable)
        if [ "$DOCS" = true ]; then
            echo "Enabling CLAUDE.md files..."
            git ls-files -v | grep '^S.*CLAUDE\.md$' | awk '{print $2}' | while read -r file; do
                echo "  Enabling $file"
                git update-index --no-skip-worktree "$file"
            done
            git checkout -- '**/CLAUDE.md' 2>/dev/null || true
        fi

        if [ "$SKILLS" = true ]; then
            echo "Enabling .claude/skills..."
            git ls-files -v | grep '^S.*\.claude/skills/' | awk '{print $2}' | while read -r file; do
                echo "  Enabling $file"
                git update-index --no-skip-worktree "$file"
            done
            git checkout -- '.claude/skills/' 2>/dev/null || true
        fi

        echo ""
        echo "Done! Files have been restored."
        ;;
    disable)
        if [ "$DOCS" = true ]; then
            echo "Disabling CLAUDE.md files..."
            find . -name "CLAUDE.md" -not -path "*/node_modules/*" | while read -r file; do
                echo "  Disabling $file"
                git update-index --skip-worktree "$file"
                rm "$file"
            done
        fi

        if [ "$SKILLS" = true ]; then
            echo "Disabling .claude/skills..."
            git ls-files '.claude/skills/' | while read -r file; do
                echo "  Disabling $file"
                git update-index --skip-worktree "$file"
                rm "$file"
            done
        fi

        echo ""
        echo "Done! Files have been removed locally."
        echo "git status will not show these as deleted."
        echo "Run '$0 enable' to restore them."
        ;;
    *)
        usage
        ;;
esac
