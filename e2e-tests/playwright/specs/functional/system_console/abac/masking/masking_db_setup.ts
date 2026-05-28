// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * masking_db_setup.ts — direct DB helpers for the masking E2E suite.
 *
 * Why direct DB access:
 *   - access_mode=shared_only requires protected=true, which requires
 *     source_plugin_id (plugin-only). There is no admin/sysadmin bypass via API.
 *   - The masking feature flag is loaded at server boot and cannot be flipped at
 *     runtime, so going through the API would return the masked view and we'd
 *     have no way to verify what was actually persisted.
 *
 * Helpers use a one-shot `pg.Client` so we don't keep a connection pool open
 * for the lifetime of the test run, and use parameterized queries throughout.
 *
 * DB URL resolution order:
 *   1. MM_TEST_DB_URL env var
 *   2. default: postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable
 */

import {Client} from 'pg';

const DEFAULT_DB_URL =
    'postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable&connect_timeout=10&binary_parameters=yes';

function resolveDbUrl(): string {
    return process.env.MM_TEST_DB_URL ?? DEFAULT_DB_URL;
}

async function runQuery<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const client = new Client({connectionString: resolveDbUrl()});
    await client.connect();
    try {
        const result = await client.query(sql, params);
        return result.rows as T[];
    } finally {
        await client.end();
    }
}

/**
 * Set a CPA field's access_mode to 'shared_only' directly in the DB.
 * Bypasses API validation (which requires source_plugin_id for protected fields).
 */
export async function setFieldAsSharedOnly(fieldId: string): Promise<void> {
    await setFieldAccessMode(fieldId, 'shared_only');
}

/**
 * Set a CPA field's access_mode to 'source_only' directly in the DB.
 * Bypasses API validation (which requires source_plugin_id for protected fields).
 */
export async function setFieldAsSourceOnly(fieldId: string): Promise<void> {
    await setFieldAccessMode(fieldId, 'source_only');
}

/**
 * Set the field back to public (removes the access_mode attr).
 */
export async function setFieldAsPublic(fieldId: string): Promise<void> {
    await setFieldAccessMode(fieldId, '');
}

/**
 * Read a policy's rule expressions straight from the AccessControlPolicies table.
 * Bypasses the API masking pipeline entirely — what you get is what's persisted.
 * Returns an array of rule expressions in storage order.
 */
export async function getStoredPolicyRuleExpressions(policyId: string): Promise<string[]> {
    if (!/^[a-z0-9]{26}$/.test(policyId)) {
        throw new Error(
            `getStoredPolicyRuleExpressions: refusing to use untrusted policy id ${JSON.stringify(policyId)}`,
        );
    }

    const rows = await runQuery<{expression: string | null}>(
        `SELECT rule->>'expression' AS expression
           FROM AccessControlPolicies, jsonb_array_elements(Data->'rules') AS rule
          WHERE ID = $1`,
        [policyId],
    );
    return rows.map((r) => (r.expression ?? '').trim()).filter((s) => s.length > 0);
}

/**
 * Hard-delete a CPA field directly in the DB by setting deleteat.
 * Use this instead of the API for fields that were flipped to protected=true
 * via setFieldAsSharedOnly / setFieldAsSourceOnly — the API rejects deletes
 * for protected fields (403), so calling it from a finally block silently
 * leaves the field behind and the 200-field global limit fills up over time.
 */
export async function deleteFieldFromDB(fieldId: string): Promise<void> {
    if (!/^[a-z0-9]{26}$/.test(fieldId)) {
        throw new Error(`deleteFieldFromDB: refusing to use untrusted field id ${JSON.stringify(fieldId)}`);
    }
    await runQuery(
        `UPDATE propertyfields
            SET deleteat = EXTRACT(EPOCH FROM NOW())::bigint * 1000
          WHERE id = $1`,
        [fieldId],
    );
}

/**
 * Soft-delete all CPA fields whose name starts with the given prefix.
 * Used in beforeAll to purge orphaned test fields from previous failed runs,
 * including protected ones that the API cannot delete.
 */
export async function purgeFieldsByPrefix(prefix: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]+$/.test(prefix)) {
        throw new Error(`purgeFieldsByPrefix: refusing untrusted prefix ${JSON.stringify(prefix)}`);
    }
    await runQuery(
        `UPDATE propertyfields
            SET deleteat = EXTRACT(EPOCH FROM NOW())::bigint * 1000
          WHERE name LIKE $1
            AND deleteat = 0`,
        [`${prefix}%`],
    );
}

async function setFieldAccessMode(fieldId: string, accessMode: string): Promise<void> {
    if (!/^[a-z0-9]{26}$/.test(fieldId)) {
        throw new Error(`setFieldAccessMode: refusing to use untrusted field id ${JSON.stringify(fieldId)}`);
    }
    if (!/^[a-z_]*$/.test(accessMode)) {
        throw new Error(`setFieldAccessMode: refusing untrusted access mode ${JSON.stringify(accessMode)}`);
    }

    if (accessMode === '') {
        // Public = remove both access_mode and protected keys, and clear the protected column.
        await runQuery(
            `UPDATE propertyfields
                SET attrs = (COALESCE(attrs, '{}'::jsonb) - 'access_mode' - 'protected'),
                    protected = false,
                    updateat = EXTRACT(EPOCH FROM NOW())::bigint * 1000
              WHERE id = $1`,
            [fieldId],
        );
        return;
    }

    await runQuery(
        `UPDATE propertyfields
            SET attrs = jsonb_set(
                    jsonb_set(COALESCE(attrs, '{}'::jsonb), '{access_mode}', to_jsonb($2::text)),
                    '{protected}',
                    'true'::jsonb
                ),
                protected = true,
                updateat = EXTRACT(EPOCH FROM NOW())::bigint * 1000
          WHERE id = $1`,
        [fieldId, accessMode],
    );
}
