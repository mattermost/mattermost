#!/bin/bash

# This script enables or disables the Claude documentation locally.
#
# Usage:
#   ./claude-docs.sh enable    — Restore CLAUDE.md files to your working tree
#   ./claude-docs.sh disable   — Remove CLAUDE.md files locally (git status stays clean)
#
# The disable command uses `git update-index --skip-worktree` so that git
# ignores the local deletions and your `git status` remains clean.

set -e

usage() {
    echo "Usage: $0 {enable|disable}"
    echo ""
    echo "  enable   Restore CLAUDE.md files to your working tree"
    echo "  disable  Remove CLAUDE.md files locally (git status stays clean)"
    exit 1
}

if [ $# -ne 1 ]; then
    usage
fi

case "$1" in
    enable)
        echo "Enabling Claude documentation..."
        git ls-files -v | grep '^S.*CLAUDE\.md$' | awk '{print $2}' | while read -r file; do
            echo "Enabling $file"
            git update-index --no-skip-worktree "$file"
        done
        git checkout -- '**/CLAUDE.md'
        echo ""
        echo "Done! CLAUDE.md files have been restored."
        ;;
    disable)
        echo "Disabling Claude documentation..."
        find . -name "CLAUDE.md" -not -path "*/node_modules/*" | while read -r file; do
            echo "Disabling $file"
            git update-index --skip-worktree "$file"
            rm "$file"
        done
        echo ""
        echo "Done! CLAUDE.md files have been removed locally."
        echo "git status will not show these as deleted."
        echo "Run '$0 enable' to restore them."
        ;;
    *)
        usage
        ;;
esac
