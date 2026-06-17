// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {deleteFieldFromDB} from './masking_db_setup';

export async function enableMaskingFlag(client: Client4): Promise<void> {
    const config = await client.getConfig();
    config.FeatureFlags = config.FeatureFlags || {};
    (config.FeatureFlags as any).AttributeValueMasking = true;
    await client.updateConfig(config);
}

export async function disableMaskingFlag(client: Client4): Promise<void> {
    const config = await client.getConfig();
    config.FeatureFlags = config.FeatureFlags || {};
    (config.FeatureFlags as any).AttributeValueMasking = false;
    await client.updateConfig(config);
}

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
        try {
            await deleteFieldFromDB(fieldId);
        } catch {
            // best-effort
        }
    }
}

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

export async function setUserAttribute(client: Client4, userId: string, fieldId: string, value: string): Promise<void> {
    await client.updateUserCustomProfileAttributesValues(userId, {[fieldId]: value});
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

    const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
    await nameInput.waitFor({state: 'visible', timeout: 10000});
    await nameInput.fill(name);

    const advancedBtn = page.getByRole('button', {name: /advanced/i});
    await advancedBtn.waitFor({state: 'visible', timeout: 5000});
    await advancedBtn.click();
    await page.waitForTimeout(1000);

    const editorLines = page.locator('.monaco-editor .view-lines').first();
    await editorLines.waitFor({state: 'visible', timeout: 5000});
    await editorLines.click({force: true});
    await page.waitForTimeout(300);
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
    await page.keyboard.type(celExpression, {delay: 10});
    await page.waitForTimeout(1000);

    const saveBtn = page.getByRole('button', {name: 'Save'});
    await saveBtn.waitFor({state: 'visible', timeout: 5000});
    const savePromise = page.waitForResponse(
        (resp) =>
            /\/api\/v4\/access_control_policies(\/[A-Za-z0-9]+)?$/.test(resp.url()) &&
            resp.request().method() === 'PUT' &&
            resp.ok(),
        {timeout: 15000},
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
 */
export async function openExistingPolicy(page: Page, policyName: string): Promise<void> {
    await page.goto('/admin_console/system_attributes/membership_policies');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await searchInput.waitFor({state: 'visible', timeout: 10000});

    const searchResponse = page.waitForResponse(
        (resp) =>
            /\/api\/v4\/access_control_policies\/search$/.test(resp.url()) &&
            resp.request().method() === 'POST' &&
            resp.ok(),
        {timeout: 15000},
    );
    await searchInput.fill(policyName);
    await searchResponse.catch(() => {
        // debounced search may settle from cache
    });
    await page.waitForLoadState('networkidle');

    const policyRow = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName}).first();
    await policyRow.waitFor({state: 'visible', timeout: 20000});
    await policyRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
}

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
 * Re-submit an existing policy with rule[0].expression overwritten by
 * newExpression, using the logged-in caller's own browser session (so per-caller
 * masking applies). Performs the GET -> modify -> PUT round-trip a real client
 * would: fetch the (possibly masked) policy, change one rule's expression, and
 * save it back. Returns the HTTP status and parsed body so callers can assert
 * the server's response (e.g. a fail-closed 403).
 */
export async function resubmitPolicyExpression(
    page: Page,
    policyId: string,
    newExpression: string,
): Promise<{status: number; body: any}> {
    return page.evaluate(
        async ({id, expr}: {id: string; expr: string}) => {
            const getResp = await fetch(`/api/v4/access_control_policies/${id}`, {
                headers: {'X-Requested-With': 'XMLHttpRequest'},
            });
            const policy = await getResp.json();
            if (Array.isArray(policy?.rules) && policy.rules.length > 0) {
                policy.rules[0].expression = expr;
            }
            const putResp = await fetch('/api/v4/access_control_policies', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify(policy),
            });
            const body = await putResp.json().catch(() => ({}));
            return {status: putResp.status, body};
        },
        {id: policyId, expr: newExpression},
    );
}

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
 */
export async function getPolicyIdFromURL(page: Page): Promise<string> {
    const url = page.url();
    const editMatch = url.match(/edit_policy\/([A-Za-z0-9]{26})(?:[/?#]|$)/);
    if (editMatch) {
        return editMatch[1];
    }
    const fallback = url.match(/membership_policies\/([A-Za-z0-9]{26})/);
    if (fallback) {
        return fallback[1];
    }
    throw new Error(`getPolicyIdFromURL: could not extract policy id from URL ${JSON.stringify(url)}`);
}
