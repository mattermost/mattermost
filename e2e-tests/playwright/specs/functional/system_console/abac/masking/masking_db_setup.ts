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

import {execSync} from 'child_process';

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
    const dbUrl = resolveDbUrl();
    const sql = [
        `UPDATE propertyfields`,
        `SET attrs = jsonb_set(COALESCE(attrs, '{}'::jsonb), '{access_mode}', to_json('shared_only'::text)::jsonb),`,
        `updateat = EXTRACT(EPOCH FROM NOW())::bigint * 1000`,
        `WHERE id = '${fieldId}';`,
    ].join(' ');

    execSync(`psql "${dbUrl}" -c "${sql}"`, {stdio: 'pipe'});
}
