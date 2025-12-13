#!/bin/bash
set -e -u -o pipefail
cd "$(dirname "$0")"
. .e2erc

mme2e_log "=== Disabling and Uninstalling All Plugins ==="

# Step 1: List all installed plugins
mme2e_log "Listing installed plugins..."
PLUGINS=$(${MME2E_DC_SERVER} exec -T -- server mmctl --local plugin list 2>/dev/null || echo "")

if [ -z "$PLUGINS" ] || echo "$PLUGINS" | grep -q "No plugins installed"; then
    mme2e_log "No plugins installed, nothing to disable."
    exit 0
fi

mme2e_log "Found plugins:"
echo "$PLUGINS"

# Step 2: Disable all plugins first
mme2e_log "Disabling all plugins..."
# Extract plugin IDs from the list (format: "plugin-id: Plugin Name (version)")
PLUGIN_IDS=$(echo "$PLUGINS" | grep -E "^[a-zA-Z0-9._-]+:" | cut -d':' -f1 || true)

for PLUGIN_ID in $PLUGIN_IDS; do
    if [ -n "$PLUGIN_ID" ]; then
        mme2e_log "  Disabling: $PLUGIN_ID"
        ${MME2E_DC_SERVER} exec -T -- server mmctl --local plugin disable "$PLUGIN_ID" 2>/dev/null || {
            mme2e_log "    Warning: Could not disable $PLUGIN_ID (may already be disabled)"
        }
    fi
done

# Step 3: Uninstall all plugins
mme2e_log "Uninstalling all plugins..."
for PLUGIN_ID in $PLUGIN_IDS; do
    if [ -n "$PLUGIN_ID" ]; then
        mme2e_log "  Uninstalling: $PLUGIN_ID"
        ${MME2E_DC_SERVER} exec -T -- server mmctl --local plugin delete "$PLUGIN_ID" 2>/dev/null || {
            mme2e_log "    Warning: Could not uninstall $PLUGIN_ID"
        }
    fi
done

# Step 4: Verify no plugins remain
mme2e_log "Verifying all plugins removed..."
REMAINING=$(${MME2E_DC_SERVER} exec -T -- server mmctl --local plugin list 2>/dev/null || echo "")

if echo "$REMAINING" | grep -q "No plugins installed"; then
    mme2e_log "SUCCESS: All plugins have been removed"
else
    # Check if any active plugins remain
    ACTIVE_PLUGINS=$(echo "$REMAINING" | grep -E "^[a-zA-Z0-9._-]+:" || true)
    if [ -z "$ACTIVE_PLUGINS" ]; then
        mme2e_log "SUCCESS: All plugins have been removed"
    else
        mme2e_log "WARNING: Some plugins may still be present:"
        echo "$REMAINING"
        exit 1
    fi
fi

mme2e_log "=== Plugin removal complete ==="
