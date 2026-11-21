// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {App, expect, newTestPassword} from '@mattermost/playwright-lib';

export async function enableABACConfig(client: Client4) {
    await client.patchConfig({
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: true,
        },
    });
}

/**
 * Enable `ServiceSettings.EnableAPIUserDeletion` so test cleanup can permanently
 * delete the throwaway users it created. Without this, test cleanup spams the
 * console with "Permanent user deletion feature is not enabled" errors and leaks
 * disabled-but-not-deleted test users on the server.
 */
export async function enableAPIUserDeletion(client: Client4) {
    await client.patchConfig({
        ServiceSettings: {
            EnableAPIUserDeletion: true,
        },
    });
}

export async function ensureDepartmentAttribute(client: Client4): Promise<{id: string; name: string}> {
    const fields: any[] = await (client as any).doFetch(`${client.getBaseRoute()}/custom_profile_attributes/fields`, {
        method: 'GET',
    });
    if (!fields.find((f: any) => f.name === 'Department')) {
        try {
            await (client as any).doFetch(`${client.getBaseRoute()}/custom_profile_attributes/fields`, {
                method: 'POST',
                body: JSON.stringify({name: 'Department', type: 'text', attrs: {visibility: 'when_set'}}),
            });
        } catch {
            // Another parallel worker may have created the field between our GET and POST.
            // Re-fetch to confirm it now exists before propagating any error.
            const recheck: any[] = await (client as any).doFetch(
                `${client.getBaseRoute()}/custom_profile_attributes/fields`,
                {method: 'GET'},
            );
            if (!recheck.find((f: any) => f.name === 'Department')) {
                throw new Error('Failed to create Department custom profile attribute field');
            }
        }
    }
    const all: Array<{id: string; name: string}> = await (client as any).doFetch(
        `${client.getBaseRoute()}/custom_profile_attributes/fields`,
        {method: 'GET'},
    );
    const department = all.find((field) => field.name === 'Department');
    if (!department) {
        throw new Error('Department custom profile attribute field is missing');
    }
    return department;
}

/** Adds and commits a text attribute rule in either Team Settings policy editor. */
export async function addRule(
    rules:
        App['teamSettingsModal']['membership']['rules'] | App['teamSettingsModal']['accessPolicies']['editor']['rules'],
    field: {id: string},
    value: string,
) {
    const row = rules.row((await rules.rowList.keys()).length);
    await rules.addButton.click();
    await expect(row.attributeMenu.attribute(field)).toBeVisible();
    await row.attributeMenu.attribute(field).click();
    await expect(row.valueInputTextbox).toBeVisible();
    await row.valueInputTextbox.fill(value);
    await row.valueInputTextbox.press('Tab');
    await expect(row.valueInputTextbox).toHaveValue(value);
}

export async function createParentPolicy(client: Client4, name: string) {
    return (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies`, {
        method: 'put',
        body: JSON.stringify({
            id: '',
            name,
            type: 'parent',
            version: 'v0.2',
            revision: 0,
            rules: [{expression: 'true', actions: ['*']}],
        }),
    });
}

// Parent policy with a real membership expression, assignable to a team (v0.3).
export async function createParentMembershipPolicy(client: Client4, name: string, expression: string) {
    return (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies`, {
        method: 'put',
        body: JSON.stringify({
            id: '',
            name,
            type: 'parent',
            version: 'v0.3',
            revision: 0,
            rules: [{expression, actions: ['membership']}],
        }),
    });
}

export async function assignChannelsToPolicy(client: Client4, policyId: string, channelIds: string[]) {
    const url = `${client.getBaseRoute()}/access_control_policies/${policyId}/assign`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${client.getToken()}`},
        body: JSON.stringify({channel_ids: channelIds}),
    });
    if (!response.ok) {
        throw new Error(`assignChannelsToPolicy failed: ${response.status}`);
    }
}

export async function unassignChannelsFromPolicy(
    client: Client4,
    policyId: string,
    channelIds: string[],
    teamId?: string,
) {
    const url = `${client.getBaseRoute()}/access_control_policies/${policyId}/unassign`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${client.getToken()}`},
        body: JSON.stringify({channel_ids: channelIds, ...(teamId && {team_id: teamId})}),
    });
    if (!response.ok) {
        throw new Error(`unassignChannelsFromPolicy failed: ${response.status}`);
    }
}

export async function deletePolicy(client: Client4, policyId: string, teamId?: string) {
    const teamParam = teamId ? `?team_id=${encodeURIComponent(teamId)}` : '';
    const url = `${client.getBaseRoute()}/access_control_policies/${policyId}${teamParam}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${client.getToken()}`},
    });
    if (!response.ok) {
        throw new Error(`deletePolicy failed: ${response.status}`);
    }
}

export async function searchPolicies(client: Client4, teamId: string): Promise<any[]> {
    const result: any = await (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies/search`, {
        method: 'post',
        body: JSON.stringify({
            term: '',
            type: 'parent',
            cursor: {id: ''},
            limit: 100,
            include_children: true,
            team_id: teamId,
        }),
    });
    return result.policies || [];
}

export async function setUserAttribute(adminClient: Client4, userId: string, fieldName: string, value: string) {
    // Get all fields to find the field ID
    const fields: any[] = await (adminClient as any).doFetch(
        `${adminClient.getBaseRoute()}/custom_profile_attributes/fields`,
        {
            method: 'GET',
        },
    );
    const field = fields.find((f: any) => f.name === fieldName);
    if (!field) {
        throw new Error(`Field "${fieldName}" not found`);
    }
    await adminClient.updateUserCustomProfileAttributesValues(userId, {[field.id]: value});
}

/**
 * Wait until all `expectedUserIds` show up as matching `expression` via the
 * access-control CEL test endpoint.
 *
 * Why this exists: ABAC queries (validateExpressionAgainstRequester,
 * calculateMembershipChanges) read from a Postgres materialized view
 * (`UserAttributeView`). The enterprise access-control service refreshes that view
 * at most once every 30 seconds — so freshly-written CPA values are not visible
 * until the next refresh tick. A test that writes a brand-new CPA value and
 * then immediately clicks "Save" on a rule referencing that value will hit
 * `requester_matches: false` and surface the self-exclusion modal instead of
 * the membership-changes confirmation modal.
 *
 * Polling forces wall-clock time to advance; the next CEL query after the 30s
 * gate elapses will refresh the view and pick up the new attribute values.
 * Default timeout 45s = 30s gate + 15s headroom.
 */
async function usersMatching(adminClient: Client4, expression: string): Promise<Set<string>> {
    const response: any = await (adminClient as any).doFetch(
        `${adminClient.getBaseRoute()}/access_control_policies/cel/test`,
        {
            method: 'post',
            body: JSON.stringify({
                expression,
                term: '',
                after: '',
                limit: 1000,
            }),
        },
    );
    return new Set<string>((response?.users || []).map((u: any) => u.id));
}

export async function waitForAttributeViewToInclude(
    adminClient: Client4,
    expression: string,
    expectedUserIds: string[],
    timeoutMs = 45_000,
    pollIntervalMs = 1_000,
): Promise<void> {
    await expect
        .poll(
            async () => {
                const matching = await usersMatching(adminClient, expression);
                return expectedUserIds.filter((id) => !matching.has(id));
            },
            {
                timeout: timeoutMs,
                intervals: [pollIntervalMs],
                message: `UserAttributeView should include the users for expression "${expression}"`,
            },
        )
        .toEqual([]);
}

export async function waitForAttributeViewToExclude(
    adminClient: Client4,
    expression: string,
    excludedUserIds: string[],
    timeoutMs = 45_000,
    pollIntervalMs = 1_000,
): Promise<void> {
    await expect
        .poll(
            async () => {
                const matching = await usersMatching(adminClient, expression);
                return excludedUserIds.filter((id) => matching.has(id));
            },
            {
                timeout: timeoutMs,
                intervals: [pollIntervalMs],
                message: `UserAttributeView should no longer include the users for expression "${expression}"`,
            },
        )
        .toEqual([]);
}

export async function createPrivateChannel(client: Client4, teamId: string) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    return client.createChannel({team_id: teamId, name: `abac-${id}`, display_name: `ABAC-${id}`, type: 'P'} as any);
}

export async function createGroupConstrainedPrivateChannel(client: Client4, teamId: string) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    return client.createChannel({
        team_id: teamId,
        name: `gc-${id}`,
        display_name: `GC-${id}`,
        type: 'P',
        group_constrained: true,
    } as any);
}

export async function createTeamAdmin(adminClient: Client4, teamId: string) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const password = newTestPassword();
    const user = await adminClient.createUser(
        {
            email: `teamadmin-${id}@sample.mattermost.com`,
            username: `teamadmin${id}`,
            password,
        } as any,
        '',
        '',
    );
    user.password = password;

    await adminClient.savePreferences(user.id, [
        {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
        {user_id: user.id, category: 'onboarding', name: 'complete', value: 'true'},
        // Suppress the onboarding task-list overlay — without these two prefs the
        // overlay appears on first login and blocks hover/click interactions.
        {user_id: user.id, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
        {user_id: user.id, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
    ]);
    await adminClient.addToTeam(teamId, user.id);
    await (adminClient as any).doFetch(`${adminClient.getBaseRoute()}/teams/${teamId}/members/${user.id}/roles`, {
        method: 'put',
        body: JSON.stringify({roles: 'team_user team_admin'}),
    });

    return user;
}

/**
 * Adds an attribute rule row in the channel settings access rules editor and fills in a value.
 * Handles the auto-opening attribute selector menu.
 */
export async function addAttributeRule(container: Locator, page: Page, value: string, attributeName = 'Department') {
    await expect(container).toBeVisible();
    const rules = new App(page).channelSettingsModal.accessRules.rules;
    await expect(rules.addButton).toBeVisible();
    const row = rules.row((await rules.rowList.keys()).length);
    await expect(rules.addButton).toBeEnabled();
    await rules.addButton.click();
    await expect(row.attributeMenu).toBeVisible();
    const attribute = await row.attributeMenu.attributeList.itemWith({text: attributeName});
    await attribute.click();
    await expect(row.valueInputTextbox).toBeVisible();
    await row.valueInputTextbox.fill(value);
    await row.valueInputTextbox.press('Tab');
    await expect(row.valueInputTextbox).toHaveValue(value);
}

export async function enableTeamMembershipABACConfig(client: Client4) {
    await client.patchConfig({
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: true,
        },
        FeatureFlags: {
            TeamMembershipAccessControl: true,
        },
    } as any);
}

export async function createTeamMembershipPolicy(client: Client4, teamId: string, expression: string, autoAdd = false) {
    return (client as any).doFetch(`${client.getBaseRoute()}/access_control_policies`, {
        method: 'put',
        body: JSON.stringify({
            id: teamId,
            name: `team-policy-${teamId}`,
            type: 'team',
            revision: 0,

            // Auto-add lives on the membership rule as a mode; the policy-level
            // `active` field no longer drives the sync job's add pass.
            rules: [{expression, actions: ['membership'], metadata: {auto_add: autoAdd ? 'always' : ''}}],
            imports: [],
        }),
    });
}

export async function assignTeamToParentPolicy(client: Client4, policyId: string, teamId: string) {
    const url = `${client.getBaseRoute()}/access_control_policies/${policyId}/assign`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${client.getToken()}`},
        body: JSON.stringify({team_ids: [teamId]}),
    });
    if (!response.ok) {
        throw new Error(`assignTeamToParentPolicy failed: ${response.status}`);
    }
}

export async function getTeamAccessControlPolicy(client: Client4, teamId: string) {
    return (client as any).doFetch(`${client.getBaseRoute()}/teams/${teamId}/access_control/policy`, {method: 'GET'});
}

/** The team's access control policy, or undefined when it has none (the server answers 404); any other failure throws. */
export async function getTeamAccessControlPolicyIfPresent(client: Client4, teamId: string) {
    try {
        return await getTeamAccessControlPolicy(client, teamId);
    } catch (error) {
        if ((error as {status_code?: number}).status_code === 404) {
            return undefined;
        }
        throw error;
    }
}

/**
 * Reads the auto-add mode off the team child policy's membership rule, which is
 * where the setting lives. Returns undefined when auto-add is off, since the key
 * is absent rather than empty once stored.
 */
export async function getTeamAutoAddMode(client: Client4, teamId: string): Promise<string | undefined> {
    const response: any = await getTeamAccessControlPolicy(client, teamId);
    const membershipRule = response?.policy?.rules?.find(
        (rule: any) => rule.actions?.includes('membership') && !rule.name,
    );
    return membershipRule?.metadata?.auto_add;
}

export async function createPublicTeam(client: Client4, suffix: string) {
    return client.createTeam({
        name: `pub-team-${suffix}`,
        display_name: `Pub Team ${suffix}`,
        type: 'O',
        allow_open_invite: true,
    } as any);
}

export async function createPrivateTeam(client: Client4, suffix: string) {
    return client.createTeam({
        name: `priv-team-${suffix}`,
        display_name: `Priv Team ${suffix}`,
        type: 'I',
        allow_open_invite: false,
    } as any);
}
