#!/bin/bash
set -euo pipefail

# GitHub Container Registry Typosquatting Detection Script
# Specifically checks for ghrc.io typosquatting of ghcr.io

# Typosquatting pattern to detect
PATTERN="ghrc\.io"

# Counters
VIOLATIONS=0

log_error() {
    echo "🚨 SECURITY ALERT: $1" >&2
    ((VIOLATIONS++))
}

log_info() {
    echo "✓ $1"
}

# Function to check for ghrc.io typosquatting
check_ghrc_typosquatting() {
    local file="$1"
    local content="$2"

    if echo "$content" | grep -qiE "$PATTERN"; then
        local matches=$(echo "$content" | grep -niE "$PATTERN" || true)
        while IFS= read -r match; do
            if [[ -n "$match" ]]; then
                local line_num=$(echo "$match" | cut -d: -f1)
                local line_content=$(echo "$match" | cut -d: -f2-)

                # Skip YAML workflow names
                if echo "$line_content" | grep -qE "^\s*-?\s*name:.*ghrc\.io"; then
                    continue
                fi

                log_error "Potential typosquatting attack detected in $file:$line_num"
                echo "   Found: $line_content" >&2
                echo "   This looks like 'ghrc.io' which is a typosquatting domain for 'ghcr.io'" >&2
                echo "   See: https://bmitch.net/blog/2025-08-22-ghrc-appears-malicious/" >&2
                echo >&2
            fi
        done <<< "$matches"
    fi
}

# Function to scan file for ghrc.io typosquatting
scan_file_for_typosquatting() {
    local file="$1"

    # Skip if file doesn't exist or is this script itself
    if [[ ! -f "$file" ]] || [[ "$file" == *"detect-ghrc-typosquatting.sh" ]]; then
        return
    fi

    local content
    content=$(cat -- "$file" 2>/dev/null) || {
        echo "Warning: Could not read file: $file" >&2
        return
    }
    check_ghrc_typosquatting "$file" "$content"
}

# Function to get changed files in PR
get_changed_files() {
    if [[ -z "${GITHUB_BASE_REF:-}" ]]; then
        echo "Error: GITHUB_BASE_REF not set. This script should only run in GitHub Actions PRs." >&2
        exit 2
    fi

    # Validate branch name contains only safe characters
    if [[ ! "$GITHUB_BASE_REF" =~ ^[a-zA-Z0-9/_-]+$ ]]; then
        echo "Error: Invalid GITHUB_BASE_REF format: $GITHUB_BASE_REF" >&2
        exit 2
    fi

    # Get all files changed between base branch and PR branch
    git diff --name-only "origin/${GITHUB_BASE_REF}" HEAD 2>/dev/null || {
        echo "Error: Failed to get git diff" >&2
        exit 2
    }
}

# Main execution
main() {
    log_info "🔍 Scanning for ghrc.io typosquatting attacks..."
    echo

    get_changed_files | while read -r file; do
        [[ -f "$file" ]] && scan_file_for_typosquatting "$file"
    done

    # Summary
    echo
    if [[ $VIOLATIONS -eq 0 ]]; then
        log_info "✅ No ghrc.io typosquatting detected!"
        exit 0
    else
        echo "❌ Found $VIOLATIONS potential typosquatting attack(s)!" >&2
        echo "   Please review and fix the issues above." >&2
        echo "   Replace 'ghrc.io' with 'ghcr.io' if this was a typo." >&2
        exit 1
    fi
}

# Run main scan
main
