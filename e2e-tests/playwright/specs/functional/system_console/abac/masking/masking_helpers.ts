// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {expect, type App} from '@mattermost/playwright-lib';

import {createMembershipPolicy, openPolicy, policyIdByName, setAbacEnabled} from '../surface';

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
 * Turns attribute-based access on and creates a membership policy in the CEL editor, with no channels so there is
 * no "Apply policy" step. Returns its id.
 */
export async function createPolicyWithCEL(app: App, client: Client4, name: string, cel: string): Promise<string> {
    await setAbacEnabled(app, true);
    await createMembershipPolicy(app, {name, cel});
    return policyIdByName(client, name);
}

/**
 * Opens a policy's editor and waits for its first rule row, which the editor fills in once it has loaded (and masked)
 * the policy. Returns the editor and that row.
 */
export async function openMaskedPolicy(
    app: App,
    policyId: string,
): Promise<{
    policy: App['admin']['accessControl']['policy'];
    row: ReturnType<App['admin']['accessControl']['policy']['rules']['row']>;
}> {
    const policy = await openPolicy(app, policyId);
    const row = policy.rules.row(0);
    await expect(row.attributeButton).toBeVisible();
    return {policy, row};
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
