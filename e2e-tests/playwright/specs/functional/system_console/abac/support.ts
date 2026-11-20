// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Shared ABAC test helper functions
 * These functions are used across multiple ABAC test files to reduce duplication
 */

import type {Page} from '@playwright/test';
import type {AccessControlTestResult} from '@mattermost/types/access_control';
import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {Channel} from '@mattermost/types/channels';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {
    Api,
    App,
    expect,
    getRandomId,
    newTestPassword,
    duration,
    setCelExpression,
    settle,
    waitForApi,
} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeValuesForUser} from '../../channels/custom_profile_attributes/helpers';

// The access rule table's controls, in whichever rule table is on the page: every table is `<area>.rules`, each rule
// `<area>.rules.row:<n>` with these parts.
export const RULE_ATTRIBUTE_BUTTON = /\.rules\.row\.attribute--button$/;
export const RULE_OPERATOR_BUTTON = /\.rules\.row\.operator--button$/;
export const RULE_VALUE_BUTTON = /\.rules\.row\.value--button$/;
export const RULE_VALUE_TEXTBOX = /\.rules\.row\.value--textbox$/;
export const RULE_VALUE_CONTROL = /\.rules\.row\.value--(button|textbox)$/;

/**
 * Create user attribute field via API
 */
export async function createUserAttributeField(client: Client4, name: string, type: string = 'text'): Promise<any> {
    const url = `${client.getBaseRoute()}/custom_profile_attributes/fields`;
    const field = {
        name,
        type,
        attrs: {
            managed: 'admin', // Admin-managed attribute
            visibility: 'when_set',
        },
    };

    const response = await (client as any).doFetch(url, {
        method: 'POST',
        body: JSON.stringify(field),
    });
    return response;
}

/**
 * Membership policy UI loads CPA fields from GET .../cel/autocomplete/fields.
 * Fail fast here instead of timing out on disabled "Test access rule" when fields lag.
 */
export async function assertAccessControlAutocompleteContains(
    adminClient: Client4,
    fieldNames: string[],
): Promise<void> {
    const fields = await adminClient.getAccessControlFields('', 100);
    const names = new Set(fields.map((f) => f.name));
    for (const n of fieldNames) {
        expect(
            names.has(n),
            `ABAC autocomplete API missing "${n}" — policy editor will treat attributes as unusable. Got: ${[...names].join(', ')}`,
        ).toBe(true);
    }
}

export async function enableUserManagedAttributes(client: Client4): Promise<void> {
    try {
        await client.patchConfig({
            AccessControlSettings: {
                EnableUserManagedAttributes: true,
            },
        } as any);
    } catch {
        // console.warn('Failed to enable EnableUserManagedAttributes:', _error.message || String(_error));
    }
}

/**
 * Ensure required user attributes exist via API
 */
export async function ensureUserAttributes(client: Client4, attributeNames?: string[]): Promise<void> {
    const attributesToCreate = attributeNames || ['Department'];
    await enableUserManagedAttributes(client);

    let existingAttributes: any[] = [];
    try {
        existingAttributes = await (client as any).doFetch(
            `${client.getBaseRoute()}/custom_profile_attributes/fields`,
            {method: 'GET'},
        );
    } catch {
        // console.warn(`Failed to fetch existing attributes:`, _error.message);
    }

    for (const attrName of attributesToCreate) {
        const exists = existingAttributes.some((attr: any) => attr.name === attrName);

        if (!exists) {
            try {
                await createUserAttributeField(client, attrName);
            } catch {
                throw new Error(`Cannot proceed: Attribute "${attrName}" does not exist and could not be created`);
            }
        }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Resolve a user (CPA) attribute field by name. Attribute-picker menu items are
 * keyed by field id (`#attribute-<id>`), so callers targeting a specific user
 * attribute must look up its id rather than hardcoding its name.
 */
export async function getUserAttributeFieldByName(client: Client4, name: string): Promise<UserPropertyField> {
    const fields = await client.getCustomProfileAttributeFields();
    const field = fields.find((f) => f.name === name);
    if (!field) {
        throw new Error(`User attribute "${name}" not found`);
    }
    return field;
}

/**
 * ABAC-specific helper to create user and set attributes using proper CPA helpers
 */
export async function createUserForABAC(
    adminClient: Client4,
    attributeFieldsMap: Record<string, UserPropertyField>,
    attributes: CustomProfileAttribute[],
): Promise<UserProfile> {
    // Username must start with a letter
    const username = `user${getRandomId()}`.toLowerCase();
    const password = newTestPassword();

    // Create the user
    const user = await adminClient.createUser(
        {
            email: `${username}@example.com`,
            username,
            password,
        } as any,
        '',
        '',
    );

    await setupCustomProfileAttributeValuesForUser(adminClient, attributes, attributeFieldsMap, user.id);

    // Attach the password back to the user object so pw.testBrowser.login() can authenticate.
    // The API response does not include the password field.
    (user as any).password = password;

    return user;
}

/**
 * Test Access Rule Result interface
 */
export interface TestAccessRuleResult {
    totalMatches: number;
    matchingUsernames: string[];
    expectedUsersMatch: boolean;
    unexpectedUsersMatch: boolean;
}

/**
 * Test Access Rule Helper
 * Clicks the "Test access rule" button and verifies which users match the policy
 */
export async function testAccessRule(
    page: Page,
    options: {
        expectedMatchingUsers?: string[]; // usernames that SHOULD match
        expectedNonMatchingUsers?: string[]; // usernames that should NOT match
        searchForUser?: string; // optional: search for a specific user in the modal
    } = {},
): Promise<TestAccessRuleResult> {
    const app = new App(page);
    // This helper's remaining caller tests the per-team System Console editor.
    const testButton = app.admin.team.accessRules.rules.testButton;
    await expect(testButton).toBeVisible();
    await expect(testButton).toBeEnabled({timeout: duration.half_min});
    const initial = await settle(testButton, {wait: Api.TestAccessControlPolicyExpression}).click();
    const modal = app.policyTestModal;
    const {users} = modal;
    await expect(modal.container).toBeVisible();
    await expect(users.searchTextbox).toBeVisible();

    // The unfiltered list shows ten users per page; a search shows every returned match, like its name buttons.
    async function readMatchingUsernames(result: AccessControlTestResult, term = ''): Promise<string[]> {
        const results = result.users ?? [];
        const displayed = term ? results : results.slice(0, 10);
        const expectedIds = displayed.map((user) => user.id);
        await expect.poll(() => users.userList.keys()).toEqual(expectedIds);
        if (result.total === 0) {
            await expect(users.noUsersText).toBeVisible();
        } else {
            await expect(users.countText).toBeVisible();
            await expect
                .poll(async () => {
                    const count = await users.countText.text();
                    const total = count.match(/of\s*([\d,]+)\s*total/i)?.[1];
                    return total ? Number(total.replaceAll(',', '')) : undefined;
                })
                .toBe(result.total);
        }
        const usernames: string[] = [];
        for (const id of expectedIds) {
            const user = result.users.find((candidate) => candidate.id === id);
            if (!user) {
                throw new Error(`Access-rule result does not contain user ${id}`);
            }
            await expect(users.user(id).nameText).toContainText(`@${user.username}`);
            const name = await users.user(id).nameText.text();
            const username = name.trim().match(/^@([^\s]+)/)?.[1];
            if (!username) {
                throw new Error(`Access-rule result name has no username: ${name}`);
            }
            usernames.push(username);
        }
        return usernames;
    }

    const totalMatches = initial.total;
    const matchingUsernames = await readMatchingUsernames(initial);
    await expect(users.searchTextbox).toHaveValue('');
    let latestTerm = '';
    let latestResult = initial;

    async function search(term: string): Promise<string[]> {
        if ((await users.searchTextbox.value()) === term) {
            if (latestTerm !== term) {
                throw new Error(`Access-rule search changed without a matching result: ${term}`);
            }
            return readMatchingUsernames(latestResult, term);
        }
        const [result] = await Promise.all([
            waitForApi(page, Api.TestAccessControlPolicyExpression),
            users.searchTextbox.fill(term),
        ]);
        await expect(users.searchTextbox).toHaveValue(term);
        latestTerm = term;
        latestResult = result;
        return readMatchingUsernames(result, term);
    }

    if (options.searchForUser) {
        await search(options.searchForUser);
    }

    let expectedUsersMatch = true;
    for (const username of options.expectedMatchingUsers ?? []) {
        if (!(await search(username)).includes(username)) {
            expectedUsersMatch = false;
        }
        await search('');
    }

    let unexpectedUsersMatch = false;
    for (const username of options.expectedNonMatchingUsers ?? []) {
        if ((await search(username)).includes(username)) {
            unexpectedUsersMatch = true;
        }
        await search('');
    }

    await modal.closeButton.click();
    await expect(modal.container).not.toBeVisible();
    return {totalMatches, matchingUsernames, expectedUsersMatch, unexpectedUsersMatch};
}

/**
 * Create private channel with unique ID for ABAC testing
 */
export async function createPrivateChannelForABAC(client: Client4, teamId: string): Promise<Channel> {
    // Generate unique ID - lowercase alphanumeric only
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const channel = await client.createChannel({
        team_id: teamId,
        name: `abac${uniqueId}`,
        display_name: `ABAC-${uniqueId}`,
        type: 'P', // Private channel
    });
    return channel;
}

/**
 * Activate a policy (set active: true)
 */
export async function activatePolicy(client: Client4, policyId: string): Promise<void> {
    const url = `${client.getBaseRoute()}/access_control_policies/${policyId}/activate?active=true`;
    await (client as any).doFetch(url, {method: 'GET'});
}

/**
 * Wait for a sync job to complete.
 *
 * When `expectedJobId` is supplied (obtained from `runSyncJob()` which
 * intercepts the POST /api/v4/jobs response), polls GET /api/v4/jobs/{id}
 * directly — race-free under PW_WORKERS >= 2 because it checks the exact
 * job, not the first row of a shared list.
 *
 * When `expectedJobId` is not supplied, falls back to reading the first row
 * of the UI sync-jobs table (racy under concurrency; avoid when possible by
 * passing the ID returned from `runSyncJob()` or `createBasicPolicy()`).
 *
 * Both paths use `expect.poll` with 500 ms intervals and a 30 s timeout so
 * individual CI jobs that are delayed in the queue don't cause false failures.
 */
export async function waitForLatestSyncJob(
    page: Page,
    _retries?: number,
    expectedJobId?: string | null,
    timeoutMs: number = 90_000,
): Promise<any> {
    // ── Race-safe path: poll the exact job by ID ──────────────────────────
    if (expectedJobId) {
        await expect
            .poll(
                async () => {
                    try {
                        const job: any = await page.evaluate(async (id: string) => {
                            const resp = await fetch(`/api/v4/jobs/${encodeURIComponent(id)}`, {
                                credentials: 'include',
                            });
                            if (!resp.ok) {
                                return {status: `http_${resp.status}`};
                            }
                            return resp.json();
                        }, expectedJobId);
                        const status = (job?.status ?? '').toLowerCase();
                        if (['error', 'failed', 'canceled', 'cancel_requested'].includes(status)) {
                            throw new Error(`Sync job ${expectedJobId} failed: ${status}`);
                        }
                        return status;
                    } catch (err) {
                        if (err instanceof Error && err.message.startsWith('Sync job')) {
                            throw err;
                        }
                        return 'pending'; // network hiccup — keep polling
                    }
                },
                {
                    timeout: timeoutMs,
                    intervals: [500, 500, 500, 1000, 1000, 2000],
                    message: `Sync job ${expectedJobId} did not reach success within ${timeoutMs / 1000} s`,
                },
            )
            .toBe('success');
        return;
    }

    // Read the newest row when the caller has no job ID.
    // RACY under PW_WORKERS >= 2 — use the jobId path when possible.
    await expect
        .poll(
            async () => {
                await page.reload();
                await page.waitForLoadState('networkidle');
                const jobs = new App(page).admin.jobs.table('access_control_sync');
                const [latestJobId] = await jobs.jobList.keys();
                if (!latestJobId) {
                    return 'no_jobs';
                }
                const latestJobRow = jobs.job(latestJobId).container.locator;
                if (!(await latestJobRow.isVisible({timeout: duration.four_sec}).catch(() => false))) {
                    return 'no_jobs';
                }
                // JobTable renders status in its first cell, which has no generated status part.
                const status = (await latestJobRow.locator('td').first().textContent()) ?? '';
                const s = status.trim().toLowerCase();
                if (s === 'error' || s === 'failed') {
                    throw new Error(`Sync job failed with status: ${status.trim()}`);
                }
                return s;
            },
            {
                timeout: duration.two_min,
                intervals: [2000, 2000, 3000, 3000],
                message: 'Sync job did not complete within 90 s (legacy path)',
            },
        )
        .toBe('success');
}

/**
 * Wait for a policy-specific access_control_sync job to complete.
 *
 * Queries the server API directly with a policy_id filter so it is race-safe
 * under PW_WORKERS >= 2: another shard's sync job cannot be mistaken for ours.
 *
 * Uses `expect.poll` with 500 ms intervals and a 30 s timeout so jobs that are
 * briefly delayed in the queue do not cause spurious failures.
 */
export async function waitForPolicySyncJob(client: Client4, policyId: string, timeoutMs = 60_000): Promise<void> {
    await expect
        .poll(
            async () => {
                try {
                    const jobs: any[] = await (client as any).doFetch(
                        `${client.getBaseRoute()}/jobs/type/access_control_sync?policy_id=${encodeURIComponent(policyId)}&page=0&per_page=5`,
                        {method: 'GET'},
                    );
                    if (!Array.isArray(jobs) || jobs.length === 0) {
                        return 'pending';
                    }
                    // Sort by create_at descending so jobs[0] is the latest.
                    // The API does not guarantee order, so without this sort
                    // jobs[0] can be an older already-successful job, causing
                    // us to return early before the newest sync has finished.
                    jobs.sort((a: any, b: any) => (b.create_at ?? 0) - (a.create_at ?? 0));
                    const status: string = jobs[0].status ?? 'pending';
                    if (status === 'error' || status === 'canceled' || status === 'cancel_requested') {
                        throw new Error(`Policy sync job failed: ${status}`);
                    }
                    return status;
                } catch (err) {
                    if (err instanceof Error && err.message.startsWith('Policy sync job')) {
                        throw err;
                    }
                    return 'pending'; // network hiccup — keep polling
                }
            },
            {
                timeout: timeoutMs,
                intervals: [500, 500, 500, 1000, 1000, 2000],
                message: `Policy sync job for ${policyId} did not reach success within ${timeoutMs / 1000} s`,
            },
        )
        .toBe('success');
}

/**
 * Get policy ID by name using search API (with retry)
 */
export async function getPolicyIdByName(
    client: Client4,
    policyName: string,
    retries: number = 3,
): Promise<string | null> {
    const searchUrl = `${client.getBaseRoute()}/access_control_policies/search`;

    // Extract the base name without the random ID suffix for search
    // e.g., "Auto-Add Policy 48b0141" -> "Auto-Add Policy"
    const baseNameMatch = policyName.match(/^(.+?)\s+[a-z0-9]+$/i);
    const searchTerm = baseNameMatch ? baseNameMatch[1] : policyName;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Use the search API
            const result = await (client as any).doFetch(searchUrl, {
                method: 'POST',
                body: JSON.stringify({
                    term: searchTerm,
                }),
            });

            const policies = result?.policies || [];

            if (policies.length > 0) {
                // Try exact match first
                let policy = policies.find((p: any) => p.name === policyName);

                // If no exact match, try partial match
                if (!policy) {
                    policy = policies.find((p: any) => p.name.includes(searchTerm));
                }

                // If still no match, just take the first result
                if (!policy && policies.length > 0) {
                    policy = policies[0];
                }

                if (policy) {
                    return policy.id;
                }
                // Wait before retrying
                if (attempt < retries) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            } else if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        } catch {
            // console.error(`Failed to search policies (attempt ${attempt}):`, _error.message || String(_error));

            if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    }

    return null;
}

/**
 * Create a permission policy using the CEL (Advanced) editor.
 * Caller must already be on the Permission Policies list page.
 * Available permissions: 'Download Files' | 'Upload Files' | 'Channel Read Access' | 'Channel Write Access' | 'Manage Channel' | 'Create Burn-on-Read Message'
 * Available roles: 'system_guest' | 'system_user' | 'system_admin' | 'system_bot' (Bot accounts)
 */
export async function createPermissionPolicy(
    page: Page,
    options: {
        name: string;
        celExpression: string;
        permissions: Array<
            | 'Download Files'
            | 'Upload Files'
            | 'Channel Read Access'
            | 'Channel Write Access'
            | 'Manage Channel'
            | 'Create Burn-on-Read Message'
        >;
        role?: 'system_guest' | 'system_user' | 'system_admin' | 'system_bot';
        adminClient?: Client4;
    },
): Promise<void> {
    if (options.adminClient) {
        await ensureUserAttributes(options.adminClient);
    }

    const app = new App(page);
    const list = app.admin.permissionPolicies;
    const policy = app.admin.permissionPolicy;

    async function openEditor() {
        await navigateToPermissionPoliciesPage(page);
        await list.addButton.click();
        await expect(list.edit.name.valueTextbox).toBeVisible();
        await list.edit.name.valueTextbox.fill(options.name);
        await expect(list.edit.name.valueTextbox).toHaveValue(options.name);
        if (options.role && options.role !== 'system_user') {
            await policy.roleButton.click();
            await expect(policy.roleMenu.role(options.role)).toBeVisible();
            await policy.roleMenu.role(options.role).click();
            await expect(policy.roleMenu.role(options.role)).not.toBeVisible();
        }
    }

    await openEditor();

    // Older fields can leave the mode switch disabled; recreate them and reopen the form before retrying.
    if (await policy.switchModeButton.isDisabled()) {
        if (options.adminClient) {
            await ensureUserAttributes(options.adminClient);
        }
        await openEditor();
    }
    await expect(policy.switchModeButton).toBeEnabled();
    await setCelExpression(app, policy, options.celExpression);

    const permissions: Record<
        (typeof options.permissions)[number],
        Parameters<typeof policy.permissionMenu.permission>[0]
    > = {
        'Download Files': 'download_file_attachment',
        'Upload Files': 'upload_file_attachment',
        'Channel Read Access': 'channel_read_access',
        'Channel Write Access': 'channel_write_access',
        'Manage Channel': 'channel_management_access',
        'Create Burn-on-Read Message': 'create_burn_on_read_post',
    };
    for (const permission of options.permissions) {
        await policy.addPermissionButton.click();
        const item = policy.permissionMenu.permission(permissions[permission]);
        await expect(item).toBeVisible();
        await item.click();
        await expect(item).not.toBeVisible();
    }

    // A policy with Channel Read Access or Manage Channel asks for confirmation before saving; Channel Write Access
    // and file-only policies save straight through.
    if (options.permissions.includes('Channel Read Access') || options.permissions.includes('Manage Channel')) {
        await app.admin.saveButton.click();
        await expect(policy.channelAccessConfirm.confirmButton).toBeVisible();
        await settle(policy.channelAccessConfirm.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();
    } else {
        await settle(app.admin.saveButton, {wait: Api.CreateAccessControlPolicy}).click();
    }
    await expect(page).toHaveURL(/\/admin_console\/system_attributes\/permission_policies$/);
    await expect(list.addButton).toBeVisible();
}

/**
 * Navigate to Permission Policies and ensure the route is available.
 * Throws a clear error when the webapp bundle does not include this page.
 */
export async function navigateToPermissionPoliciesPage(page: Page): Promise<void> {
    await page.goto('/admin_console/system_attributes/permission_policies');

    if (page.url().includes('/admin_console/about/license')) {
        throw new Error(
            'Permission Policies page is unavailable and redirected to License. Rebuild and run webapp from a branch that includes the permission policies route before running ABAC tests.',
        );
    }
    await expect(new App(page).admin.permissionPolicies.addButton).toBeVisible();
}

/**
 * Delete a permission policy by name using the API.
 * Searches for the policy by name, then deletes it by ID.
 * Safe to call even if the policy does not exist (no-op).
 */
/**
 * Delete a permission policy by name via the REST API.
 * Uses doFetch (same pattern as getPolicyIdByName) to find the policy by name,
 * then issues a DELETE. Safe to call even if the policy does not exist.
 */
/**
 * Rewrite the CEL expression on every rule of an existing permission policy.
 *
 * API rather than the CEL editor: SavePolicy publishes permission_policy_updated whichever
 * surface issued the change, and driving the admin UI would test the editor instead.
 *
 * Revoke by narrowing the expression, never by removing an action. An action no rule grants is
 * implicitly allowed, so dropping one widens access instead of withdrawing it.
 */
export async function updatePermissionPolicyExpression(
    client: Client4,
    policyName: string,
    expression: string,
): Promise<void> {
    const policyId = await getPolicyIdByName(client, policyName);
    expect(policyId, `Could not find permission policy "${policyName}" to update`).toBeTruthy();

    const policy = await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies/${policyId}`, {
        method: 'GET',
    });

    policy.rules = (policy.rules || []).map((rule: any) => ({...rule, expression}));

    await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies`, {
        method: 'PUT',
        body: JSON.stringify(policy),
    });
}

export async function deletePermissionPolicyByName(client: Client4, policyName: string): Promise<void> {
    try {
        const searchUrl = `${client.getBaseRoute()}/access_control_policies/search`;
        const result = await (client as any).doFetch(searchUrl, {
            method: 'POST',
            body: JSON.stringify({term: policyName, type: 'permission'}),
        });

        // Response may be the array directly or wrapped in {policies: [...]}
        const policies: any[] = Array.isArray(result) ? result : result?.policies || [];
        const match = policies.find((p: any) => p.name === policyName && p.type === 'permission');

        if (match?.id) {
            await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies/${match.id}`, {
                method: 'DELETE',
            });
        }
    } catch {
        // Policy may not exist or deletion may have already occurred — safe to ignore
    }
}

/**
 * Delete ALL permission policies in the system.
 * Call this at the start of file-permission E2E tests to ensure no stale
 * policies from previous runs interfere with the "no-policy = implicit allow" assertions.
 */
/**
 * Delete ALL permission policies in the system.
 * Uses the typed searchPermissionPolicies client method which sends the correct
 * cursor + limit payload. Falls back to a doFetch approach if needed.
 * Safe to call when no policies exist.
 */
export async function cleanupAllPermissionPolicies(client: Client4): Promise<void> {
    let cursor = '';
    const limit = 100;

    while (true) {
        let policies: any[] = [];
        try {
            // Use the typed method (available in the rebuilt @mattermost/client dist)
            const result = await (client as any).searchPermissionPolicies('', cursor, limit);
            policies = result?.policies || [];
        } catch {
            // Typed method unavailable — fall back to raw doFetch with explicit limit
            try {
                const searchUrl = `${client.getBaseRoute()}/access_control_policies/search`;
                const result = await (client as any).doFetch(searchUrl, {
                    method: 'POST',
                    body: JSON.stringify({term: '', type: 'permission', cursor: {id: cursor}, limit}),
                });
                policies = Array.isArray(result) ? result : result?.policies || [];
            } catch {
                break;
            }
        }

        if (policies.length === 0) {
            break;
        }

        await Promise.all(
            policies.map(async (policy: any) => {
                if (policy?.id) {
                    try {
                        await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies/${policy.id}`, {
                            method: 'DELETE',
                        });
                    } catch {
                        // ignore individual delete failures
                    }
                }
            }),
        );

        if (policies.length < limit) {
            break;
        }

        cursor = policies[policies.length - 1].id;
    }
}
