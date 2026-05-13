// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * masking_db_setup.ts — PLUGGABLE masking field setup
 *
 * The API blocks setting access_mode=shared_only without a source_plugin_id,
 * so we patch the DB directly — same approach as set_access_mode_db.sh.
 *
 * TO PLUG IN:   import {setFieldAsSharedOnly} from './masking_db_setup';
 *               then call setFieldAsSharedOnly(fieldId) after createMaskingTextField().
 *
 * TO UNPLUG:    remove the import and the setFieldAsSharedOnly() calls.
 *               Tests will still run; fields will be public (no masking triggered).
 *
 * DB URL resolution order:
 *   1. MM_TEST_DB_URL env var
 *   2. default: postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable
 */

import {execFileSync} from 'child_process';

const DEFAULT_DB_URL = 'postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable';

function resolveDbUrl(): string {
    return process.env.MM_TEST_DB_URL ?? DEFAULT_DB_URL;
}

/**
 * Set a CPA field's access_mode to 'shared_only' directly in the DB.
 *
 * This bypasses API validation (which requires source_plugin_id for protected
 * fields). Only access_mode is patched; protected is intentionally left unset
 * because the masking logic only reads access_mode, not protected.
 *
 * Throws if psql is unavailable or the query fails.
 */
export function setFieldAsSharedOnly(fieldId: string): void {
    setFieldAccessMode(fieldId, 'shared_only');
}

/**
 * Set the field back to public (no access_mode attr) directly in the DB.
 * Used by round-trip verification tests: masking is a no-op for public fields,
 * so flipping the field back, reading the raw stored CEL, then flipping again
 * is the only way to verify what's actually persisted — the masking feature
 * flag is loaded at server boot and cannot be flipped via runtime config.
 */
export function setFieldAsPublic(fieldId: string): void {
    setFieldAccessMode(fieldId, '');
}

/**
 * Read a policy's rule expressions straight from the AccessControlPolicies table.
 * Bypasses the API masking pipeline entirely — what you get is what's persisted,
 * which is the only way to verify merge-on-save correctness for masked policies:
 * the masking feature flag is loaded at server boot and cannot be flipped via
 * runtime config, so going through the API would return the masked view.
 *
 * Returns an array of rule expressions in storage order.
 */
export function getStoredPolicyRuleExpressions(policyId: string): string[] {
    if (!/^[a-z0-9]{26}$/.test(policyId)) {
        throw new Error(
            `getStoredPolicyRuleExpressions: refusing to use untrusted policy id ${JSON.stringify(policyId)}`,
        );
    }

    const dbUrl = resolveDbUrl();
    // jsonb_array_elements extracts each rule object; ->>'expression' grabs the
    // raw CEL string. -A -t gives us bare values, one per row.
    const sql = `SELECT rule->>'expression' FROM AccessControlPolicies, jsonb_array_elements(Data->'rules') AS rule WHERE ID = '${policyId}';`;

    const out = execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-c', sql], {
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out
        .toString('utf8')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

function setFieldAccessMode(fieldId: string, accessMode: string): void {
    // Mattermost IDs are 26 chars of [a-z0-9]. Reject anything else before inlining
    // into raw SQL — psql's :'var' interpolation does not work in -c mode, so the
    // value has to be embedded directly. The format check keeps that safe.
    if (!/^[a-z0-9]{26}$/.test(fieldId)) {
        throw new Error(`setFieldAccessMode: refusing to use untrusted field id ${JSON.stringify(fieldId)}`);
    }
    if (!/^[a-z_]*$/.test(accessMode)) {
        throw new Error(`setFieldAccessMode: refusing untrusted access mode ${JSON.stringify(accessMode)}`);
    }

    const dbUrl = resolveDbUrl();
    const sql =
        accessMode === ''
            ? [
                  // Empty access_mode = public. Remove the key entirely so the field looks
                  // exactly like a freshly-created public field.
                  `UPDATE propertyfields`,
                  `SET attrs = (COALESCE(attrs, '{}'::jsonb) - 'access_mode'),`,
                  `updateat = EXTRACT(EPOCH FROM NOW())::bigint * 1000`,
                  `WHERE id = '${fieldId}';`,
              ].join(' ')
            : [
                  `UPDATE propertyfields`,
                  `SET attrs = jsonb_set(COALESCE(attrs, '{}'::jsonb), '{access_mode}', to_json('${accessMode}'::text)::jsonb),`,
                  `updateat = EXTRACT(EPOCH FROM NOW())::bigint * 1000`,
                  `WHERE id = '${fieldId}';`,
              ].join(' ');

    execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-c', sql], {stdio: 'pipe'});
}
