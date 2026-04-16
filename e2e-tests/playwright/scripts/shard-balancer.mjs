#!/usr/bin/env node
/**
 * Duration-based shard balancer for Playwright.
 *
 * Usage:  node scripts/shard-balancer.mjs <shard_index> <total_shards>
 * Output: space-separated list of spec files for the requested shard.
 *
 * Uses a greedy bin-packing algorithm: sort files by estimated duration
 * (heaviest first), then assign each file to the shard with the lowest
 * accumulated duration.  This produces a much more even distribution than
 * Playwright's built-in alphabetical --shard=N/M split.
 *
 * Durations below are approximate seconds from recent CI runs. Files not
 * listed default to 15 s.  Update periodically from CI artifacts.
 */

import {readdirSync, statSync} from 'fs';
import {join, relative} from 'path';

// ── Estimated durations (seconds) per spec file ─────────────────────────
// Calibrated from CI run 24496768108 (2026-04-16).
// Key = path relative to the playwright directory.
const DURATIONS = {
    // ── ABAC / LDAP (heaviest — each test ~40-90s) ──────────────────────
    'specs/functional/system_console/abac/ldap/ldap_sync.spec.ts': 200,
    'specs/functional/system_console/abac/ldap/ldap_sync_removal.spec.ts': 180,
    'specs/functional/system_console/abac/policies/advanced_policies.spec.ts': 150,
    'specs/functional/system_console/abac/policies/advanced_policies_operators.spec.ts': 120,
    'specs/functional/system_console/abac/policies/advanced_policies_operators_2.spec.ts': 90,
    'specs/functional/system_console/abac/file_access/file_permissions.spec.ts': 150,
    'specs/functional/system_console/abac/file_access/file_permissions_combined.spec.ts': 120,
    'specs/functional/system_console/abac/policies/create_policies.spec.ts': 80,
    'specs/functional/system_console/abac/policy_management/delete_policies.spec.ts': 70,
    'specs/functional/system_console/abac/policy_management/edit_policies.spec.ts': 60,
    'specs/functional/system_console/abac/policy_management/edit_policies_rules.spec.ts': 60,
    'specs/functional/system_console/abac/policies/channel_integration.spec.ts': 70,
    'specs/functional/system_console/abac/user_attributes/attribute_changes.spec.ts': 100,
    'specs/functional/system_console/abac/policies/permission_policies.spec.ts': 180,
    'specs/functional/system_console/abac/policies/permission_policies_enforcement.spec.ts': 100,
    'specs/functional/system_console/abac/basic/enable_disable.spec.ts': 35,
    // ── Scheduled messages (7 tests × 20-50s) ───────────────────────────
    'specs/functional/channels/scheduled_messages/scheduled_messages.spec.ts': 200,
    // ── Managed categories (8 tests × 10-28s) ───────────────────────────
    'specs/functional/channels/managed_categories/managed_categories.spec.ts': 120,
    // ── Custom profile attributes (7 tests × 15s) ───────────────────────
    'specs/functional/channels/custom_profile_attributes/custom_attributes.spec.ts': 110,
    'specs/functional/channels/custom_profile_attributes/user_settings.spec.ts': 30,
    // ── Accessibility settings (7 tests × 12s) ──────────────────────────
    'specs/accessibility/channels/settings_dialog/advanced.spec.ts': 85,
    'specs/accessibility/channels/settings_dialog/display.spec.ts': 60,
    'specs/accessibility/channels/settings_dialog/notifications.spec.ts': 60,
    'specs/accessibility/channels/settings_dialog/settings.spec.ts': 50,
    'specs/accessibility/channels/settings_dialog/sidebar.spec.ts': 50,
    // ── Content flagging (multiple tests per file) ──────────────────────
    'specs/functional/channels/content_flagging/flagging/flag-messages.spec.ts': 50,
    'specs/functional/channels/content_flagging/reviewer-actions/reviewer-actions.spec.ts': 50,
    'specs/functional/channels/content_flagging/reviewer-reports/cross-team-flag-reports-global-reviewers.spec.ts': 30,
    'specs/functional/channels/content_flagging/reviewer-reports/multiple-reviewers-receive-same-flag.spec.ts': 30,
    'specs/functional/channels/content_flagging/notifications/author-notification.spec.ts': 25,
    'specs/functional/channels/content_flagging/notifications/reporter-notification.spec.ts': 25,
    'specs/functional/channels/content_flagging/edge-cases/author-deletes-message-before-review.spec.ts': 25,
    'specs/functional/channels/content_flagging/edge-cases/author-edits-message-during-review.spec.ts': 25,
    // ── Team settings ───────────────────────────────────────────────────
    'specs/functional/channels/team_settings/team_settings_policy_editor.spec.ts': 60,
    'specs/functional/channels/team_settings/team_settings_membership_policies.spec.ts': 45,
    'specs/functional/channels/team_settings/team_settings_unsaved_changes.spec.ts': 45,
    // ── Autotranslation ─────────────────────────────────────────────────
    'specs/functional/channels/autotranslation/autotranslation.spec.ts': 60,
    'specs/functional/channels/autotranslation/autotranslation_permissions.spec.ts': 40,
    // ── Burn on read ────────────────────────────────────────────────────
    'specs/functional/channels/burn_on_read/receiver_flow.spec.ts': 40,
    'specs/functional/channels/burn_on_read/sender_flow.spec.ts': 35,
    'specs/functional/channels/burn_on_read/dm_gm_flow.spec.ts': 30,
    'specs/functional/channels/burn_on_read/restrictions.spec.ts': 25,
    // ── System console ──────────────────────────────────────────────────
    'specs/functional/system_console/self_deleting_messages.spec.ts': 40,
    'specs/functional/system_console/single_channel_guests.spec.ts': 35,
    'specs/functional/system_console/user_attributes/user_attributes.spec.ts': 90,
    'specs/functional/system_console/system_users/user_attributes_admin_editing.spec.ts': 30,
    'specs/functional/system_console/permissions/system_role_assignment.spec.ts': 30,
    // ── Plugins ─────────────────────────────────────────────────────────
    'specs/functional/plugins/demo_plugin/server/slash_commands/demo_plugin_hook_toggle.spec.ts': 30,
    'specs/functional/plugins/demo_plugin_installation.spec.ts': 20,
    // ── Channels (multi-test files) ─────────────────────────────────────
    'specs/functional/channels/notifications/system_console.spec.ts': 40,
    'specs/functional/channels/search/browse_channels_sorting.spec.ts': 25,
    'specs/functional/channels/shared_channel_configuration/shared_channel_configuration.spec.ts': 25,
    'specs/functional/channels/sidebar_right/channel_members_profile_popover.spec.ts': 25,
};

const DEFAULT_DURATION = 20;

// ── Discover spec files ─────────────────────────────────────────────────

function findSpecs(dir, base) {
    let results = [];
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(findSpecs(full, base));
        } else if (entry.name.endsWith('.spec.ts') && !full.includes('/visual/')) {
            results.push(relative(base, full));
        }
    }
    return results;
}

// ── Greedy bin-packing ──────────────────────────────────────────────────

function balanceShards(specFiles, totalShards) {
    // Sort heaviest first
    const sorted = specFiles
        .map((f) => ({file: f, duration: DURATIONS[f] || DEFAULT_DURATION}))
        .sort((a, b) => b.duration - a.duration);

    const shards = Array.from({length: totalShards}, () => ({files: [], total: 0}));

    for (const item of sorted) {
        // Assign to the shard with lowest accumulated time
        const lightest = shards.reduce((min, s) => (s.total < min.total ? s : min), shards[0]);
        lightest.files.push(item.file);
        lightest.total += item.duration;
    }

    return shards;
}

// ── Main ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node shard-balancer.mjs <shard_index> <total_shards>');
    console.error('  shard_index: 1-based shard number');
    console.error('  total_shards: total number of shards');
    process.exit(1);
}

const shardIndex = parseInt(args[0], 10); // 1-based
const totalShards = parseInt(args[1], 10);

if (shardIndex < 1 || shardIndex > totalShards) {
    console.error(`shard_index must be between 1 and ${totalShards}`);
    process.exit(1);
}

const pwDir = new URL('..', import.meta.url).pathname;
const specFiles = findSpecs(join(pwDir, 'specs'), pwDir).sort();
const shards = balanceShards(specFiles, totalShards);
const myShard = shards[shardIndex - 1];

// Output the file list (space-separated) for use in CI
console.log(myShard.files.join(' '));

// Print summary to stderr for debugging
console.error(`Shard ${shardIndex}/${totalShards}: ${myShard.files.length} files, ~${myShard.total}s estimated`);
