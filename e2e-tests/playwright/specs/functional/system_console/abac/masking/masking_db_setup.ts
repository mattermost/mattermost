// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// TEMPORARILY DISABLED — pg dependency and all DB helpers commented out while
// masking E2E tests are skipped to isolate CI failures.
// Re-enable together with attribute_value_masking.spec.ts and the pg dependency.

// import {Client} from 'pg';
//
// const DEFAULT_DB_URL = 'postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable';
//
// function resolveDbUrl(): string {
//     return process.env.MM_TEST_DB_URL ?? DEFAULT_DB_URL;
// }
//
// async function runQuery<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
//     const client = new Client({connectionString: resolveDbUrl()});
//     await client.connect();
//     try {
//         const result = await client.query(sql, params);
//         return result.rows as T[];
//     } finally {
//         await client.end();
//     }
// }
//
// export async function setFieldAsSharedOnly(fieldId: string): Promise<void> {
//     await setFieldAccessMode(fieldId, 'shared_only');
// }
//
// export async function setFieldAsSourceOnly(fieldId: string): Promise<void> {
//     await setFieldAccessMode(fieldId, 'source_only');
// }
//
// export async function setFieldAsPublic(fieldId: string): Promise<void> {
//     await setFieldAccessMode(fieldId, '');
// }
//
// export async function getStoredPolicyRuleExpressions(policyId: string): Promise<string[]> {
//     if (!/^[a-z0-9]{26}$/.test(policyId)) {
//         throw new Error(
//             `getStoredPolicyRuleExpressions: refusing to use untrusted policy id ${JSON.stringify(policyId)}`,
//         );
//     }
//     const rows = await runQuery<{expression: string | null}>(
//         `SELECT rule->>'expression' AS expression
//            FROM AccessControlPolicies, jsonb_array_elements(Data->'rules') AS rule
//           WHERE ID = $1`,
//         [policyId],
//     );
//     return rows.map((r) => (r.expression ?? '').trim()).filter((s) => s.length > 0);
// }
//
// export async function deleteFieldFromDB(fieldId: string): Promise<void> {
//     if (!/^[a-z0-9]{26}$/.test(fieldId)) {
//         throw new Error(`deleteFieldFromDB: refusing to use untrusted field id ${JSON.stringify(fieldId)}`);
//     }
//     await runQuery(
//         `UPDATE propertyfields
//             SET deleteat = EXTRACT(EPOCH FROM NOW())::bigint * 1000
//           WHERE id = $1`,
//         [fieldId],
//     );
// }
//
// export async function purgeFieldsByPrefix(prefix: string): Promise<void> {
//     if (!/^[A-Za-z0-9_-]+$/.test(prefix)) {
//         throw new Error(`purgeFieldsByPrefix: refusing untrusted prefix ${JSON.stringify(prefix)}`);
//     }
//     await runQuery(
//         `UPDATE propertyfields
//             SET deleteat = EXTRACT(EPOCH FROM NOW())::bigint * 1000
//           WHERE name LIKE $1
//             AND deleteat = 0`,
//         [`${prefix}%`],
//     );
// }
//
// async function setFieldAccessMode(fieldId: string, accessMode: string): Promise<void> {
//     if (!/^[a-z0-9]{26}$/.test(fieldId)) {
//         throw new Error(`setFieldAccessMode: refusing to use untrusted field id ${JSON.stringify(fieldId)}`);
//     }
//     if (!/^[a-z_]*$/.test(accessMode)) {
//         throw new Error(`setFieldAccessMode: refusing untrusted access mode ${JSON.stringify(accessMode)}`);
//     }
//     if (accessMode === '') {
//         await runQuery(
//             `UPDATE propertyfields
//                 SET attrs = (COALESCE(attrs, '{}'::jsonb) - 'access_mode'),
//                     updateat = EXTRACT(EPOCH FROM NOW())::bigint * 1000
//               WHERE id = $1`,
//             [fieldId],
//         );
//         return;
//     }
//     await runQuery(
//         `UPDATE propertyfields
//             SET attrs = jsonb_set(
//                     jsonb_set(COALESCE(attrs, '{}'::jsonb), '{access_mode}', to_jsonb($2::text)),
//                     '{protected}',
//                     'true'::jsonb
//                 ),
//                 protected = true,
//                 updateat = EXTRACT(EPOCH FROM NOW())::bigint * 1000
//           WHERE id = $1`,
//         [fieldId, accessMode],
//     );
// }
