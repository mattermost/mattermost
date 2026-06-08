// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared helpers for the attribute-value-masking E2E suite.
 *
 * DB helpers live in masking_db_setup.ts; UI/API helpers shared across the
 * masking spec files live here.
 */

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {deleteFieldFromDB} from './masking_db_setup';

/** Enable AttributeValueMasking feature flag */
export async function enableMaskingFlag(client: Client4): Promise<void> {
    const config = await client.getConfig();
    config.FeatureFlags = config.FeatureFlags || {};
    (config.FeatureFlags as any).AttributeValueMasking = true;
    await client.updateConfig(config);
}

/** Disable AttributeValueMasking feature flag */
export async function disableMaskingFlag(client: Client4): Promise<void> {
    const config = await client.getConfig();
    config.FeatureFlags = config.FeatureFlags || {};
    (config.FeatureFlags as any).AttributeValueMasking = false;
    await client.updateConfig(config);
}

/**
 * Create a plain text CPA field and return its ID.
 * Uses a caller-supplied unique name so each test owns its own field.
 */
export async function createMaskingTextField(client: Client4, fieldName: string): Promise<string> {
    const url = `${client.getBaseRoute()}/custom_profile_attributes/fields`;
    const created = await (client as any).doFetch(url, {
        method: 'POST',
        body: JSON.stringify({
            name: fieldName,
            type: 'text',
            attrs: {
                sort_order: 99,
                managed: 'admin',
                visibility: 'when_set',
            },
        }),
    });
    return created.id as string;
}

/**
 * Create a multiselect CPA field with the given options and return its ID.
 */
export async function createMaskingMultiselectField(
    client: Client4,
    fieldName: string,
    options: string[],
): Promise<string> {
    const url = `${client.getBaseRoute()}/custom_profile_attributes/fields`;
    const created = await (client as any).doFetch(url, {
        method: 'POST',
        body: JSON.stringify({
            name: fieldName,
            type: 'multiselect',
            attrs: {
                sort_order: 99,
                managed: 'admin',
                visibility: 'when_set',
                options: options.map((name) => ({name, color: ''})),
            },
        }),
    });
    return created.id as string;
}

/**
 * Delete a CPA field by ID. Tries the API first; falls back to a direct DB
 * soft-delete for fields that were flipped to protected=true via
 * setFieldAsSharedOnly / setFieldAsSourceOnly (the API returns 403 for those).
 * Never throws.
 */
export async function deleteCPAField(client: Client4, fieldId: string): Promise<void> {
    if (!fieldId) {
        return;
    }
    try {
        await (client as any).doFetch(`${client.getBaseRoute()}/custom_profile_attributes/fields/${fieldId}`, {
            method: 'DELETE',
        });
    } catch {
        // API failed (e.g. 403 for protected fields) — fall back to DB delete.
        try {
            await deleteFieldFromDB(fieldId);
        } catch {
            // best-effort
        }
    }
}

/**
 * Delete a membership policy by ID. Best-effort — never throws.
 */
export async function deletePolicy(client: Client4, policyId: string): Promise<void> {
    if (!policyId) {
        return;
    }
    try {
        await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies/${policyId}`, {
            method: 'DELETE',
        });
    } catch {
        // best-effort
    }
}

/**
 * Set an attribute value for a user via the admin client.
 */
export async function setUserAttribute(client: Client4, userId: string, fieldId: string, value: string): Promise<void> {
    await client.updateUserCustomProfileAttributesValues(userId, {[fieldId]: value});
}

/**
 * Ensure a role has a specific permission, adding it if missing.
 *
 * Why: the server's stored team_admin / channel_admin roles in this test
 * environment may be missing the access-rules permissions even though they're
 * in the model defaults (no migration run, or pre-permission seed). Reads the
 * current permissions and only PATCHes when the permission is absent.
 */
export async function ensureRoleHasPermission(client: Client4, roleName: string, permissionId: string): Promise<void> {
    const role = await client.getRoleByName(roleName);
    if (role.permissions.includes(permissionId)) {
        return;
    }
    await client.patchRole(role.id, {permissions: [...role.permissions, permissionId]});
}

/**
 * Create a membership policy using the Advanced (CEL) editor in the UI.
 * Does NOT add channels so there is no "Apply policy" gate to click through.
 * Returns the policy ID extracted from the URL after saving.
 */
export async function createPolicyWithCEL(page: Page, name: string, celExpression: string): Promise<string> {
    await page.goto('/admin_console/system_attributes/membership_policies');
    await page.waitForLoadState('networkidle');

    const addPolicyBtn = page.getByRole('button', {name: 'Add policy'});
    await addPolicyBtn.waitFor({state: 'visible', timeout: 15000});
    await addPolicyBtn.click();
    await page.waitForLoadState('networkidle');

    // Fill policy name
    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await nameInput.waitFor({state: 'visible', timeout: 10000});
    await nameInput.fill(name);

    // Switch to Advanced (CEL) mode
    const advancedBtn = page.getByRole('button', {name: /advanced/i});
    await advancedBtn.waitFor({state: 'visible', timeout: 5000});
    await advancedBtn.click();
    await page.waitForTimeout(1000);

    // Type CEL expression into the Monaco editor
    const editorLines = page.locator('.monaco-editor .view-lines').first();
    await editorLines.waitFor({state: 'visible', timeout: 5000});
    await editorLines.click({force: true});
    await page.waitForTimeout(300);
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
    await page.keyboard.type(celExpression, {delay: 10});
    await page.waitForTimeout(1000);

    // Save — no channels so no "Apply Policy" confirmation modal. Capture the
    // PUT response: saving redirects to the list view, so the URL no longer
    // carries the policy id. The API response body always has it.
    const saveBtn = page.getByRole('button', {name: 'Save'});
    await saveBtn.waitFor({state: 'visible', timeout: 5000});
    const savePromise = page.waitForResponse(
        (resp) =>
            /\/api\/v4\/access_control_policies(\/[A-Za-z0-9]+)?$/.test(resp.url()) &&
            resp.request().method() === 'PUT' &&
            resp.ok(),
    );
    await saveBtn.click();
    const saveResp = await savePromise;
    const saved = await saveResp.json();
    await page.waitForLoadState('networkidle');

    const id = (saved?.id ?? saved?.ID ?? '') as string;
    if (!/^[A-Za-z0-9]{26}$/.test(id)) {
        throw new Error(
            `createPolicyWithCEL: save response did not include a valid policy id (got ${JSON.stringify(id)})`,
        );
    }
    return id;
}

/**
 * Navigate to the membership-policies list and open the editor for the named policy.
 *
 * Many tests create accumulating `MaskingPolicy <rand>` rows during a single
 * run, so the target row is often beyond the first page. We rely on the search
 * box to filter, and explicitly wait for the search request to land before
 * looking for the row — otherwise we race the network and time out on a stale
 * page.
 */
export async function openExistingPolicy(page: Page, policyName: string): Promise<void> {
    await page.goto('/admin_console/system_attributes/membership_policies');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await searchInput.waitFor({state: 'visible', timeout: 10000});

    // Wait for the search response triggered by typing the policy name.
    // The list uses POST /access_control_policies/search with the term in the body,
    // so we match by URL only and ignore the query payload.
    const searchResponse = page.waitForResponse(
        (resp) =>
            /\/api\/v4\/access_control_policies\/search$/.test(resp.url()) &&
            resp.request().method() === 'POST' &&
            resp.ok(),
    );
    await searchInput.fill(policyName);
    await searchResponse.catch(() => {
        // List components debounce; some renders may not fire a fresh request if
        // the cached result already matches. Fall back to a short settle.
    });
    await page.waitForLoadState('networkidle');

    const policyRow = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
    await policyRow.waitFor({state: 'visible', timeout: 20000});
    await policyRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
}

/**
 * Fetch the policy expression from the server. When the masking flag is ON,
 * any value the caller does not hold is replaced with the masked-token
 * sentinel (e.g. "--------") in the returned expression.
 */
export async function getRawPolicyExpression(page: Page, policyId: string): Promise<string> {
    const data = await page.evaluate(async (id: string) => {
        const resp = await fetch(`/api/v4/access_control_policies/${id}`, {
            headers: {'X-Requested-With': 'XMLHttpRequest'},
        });
        return resp.json();
    }, policyId);
    return (data?.rules?.[0]?.expression ?? '') as string;
}

/**
 * Search for policies and return the first match's first rule expression.
 */
export async function searchPoliciesExpression(page: Page, term: string): Promise<string> {
    const data = await page.evaluate(async (t: string) => {
        const resp = await fetch('/api/v4/access_control_policies/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({term: t}),
        });
        return resp.json();
    }, term);
    const policies = data?.policies ?? (Array.isArray(data) ? data : []);
    return (policies[0]?.rules?.[0]?.expression ?? '') as string;
}

/**
 * Extract the policy ID from the current URL after the editor has opened.
 * The route is `/admin_console/system_attributes/membership_policies/edit_policy/{id}`
 * — the previous regex captured `edit_policy` (the literal path segment) instead of
 * the actual id, so getRawPolicyExpression silently fetched against a non-existent
 * id and returned empty data, masking real test failures.
 */
export async function getPolicyIdFromURL(page: Page): Promise<string> {
    const url = page.url();
    // Match `/edit_policy/<id>` first; fall back to `/membership_policies/<id>` for
    // older route shapes if the route is ever simplified.
    const editMatch = url.match(/edit_policy\/([A-Za-z0-9]+)/);
    if (editMatch) {
        return editMatch[1];
    }
    const fallback = url.match(/membership_policies\/([A-Za-z0-9]{26})/);
    if (fallback) {
        return fallback[1];
    }
    throw new Error(`getPolicyIdFromURL: could not extract policy id from URL ${JSON.stringify(url)}`);
}
