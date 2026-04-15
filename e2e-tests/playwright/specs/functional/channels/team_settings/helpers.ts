// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';
import {expect} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {newTestPassword} from '@mattermost/playwright-lib';

export async function enableABACConfig(client: Client4) {
    await client.patchConfig({
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: true,
        },
    });
}

export async function ensureDepartmentAttribute(client: Client4) {
    let fields: any[] = [];
    try {
        fields = await (client as any).doFetch(`${client.getBaseRoute()}/custom_profile_attributes/fields`, {
            method: 'GET',
        });
    } catch {
        // May not exist yet
    }
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

export async function createPublicChannel(client: Client4, teamId: string) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    return client.createChannel({team_id: teamId, name: `pub-${id}`, display_name: `PUB-${id}`, type: 'O'} as any);
}

export async function createTeamAdmin(adminClient: Client4, teamId: string) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const user = await adminClient.createUser(
        {
            email: `teamadmin-${id}@sample.mattermost.com`,
            username: `teamadmin${id}`,
            password: newTestPassword(),
        } as any,
        '',
        '',
    );
    user.password = newTestPassword();

    await adminClient.savePreferences(user.id, [
        {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
        {user_id: user.id, category: 'onboarding', name: 'complete', value: 'true'},
    ]);
    await adminClient.addToTeam(teamId, user.id);
    await (adminClient as any).doFetch(`${adminClient.getBaseRoute()}/teams/${teamId}/members/${user.id}/roles`, {
        method: 'put',
        body: JSON.stringify({roles: 'team_user team_admin'}),
    });

    return user;
}

/**
 * Adds an attribute rule row in the policy editor and fills in a value.
 * Handles the auto-opening attribute selector menu.
 */
export async function addAttributeRule(container: Locator, page: Page, value: string, attributeName = 'Department') {
    const addAttrBtn = container.getByRole('button', {name: /Add attribute/});
    await expect(addAttrBtn).toBeEnabled({timeout: 10000});
    await addAttrBtn.click();

    // The attribute selector menu auto-opens — select by name, not by position.
    // Clicking the first item is unreliable when multiple attributes exist (e.g. Location
    // sorts before Department and gets picked instead, causing self-inclusion to fail).
    const attributeMenu = page.locator('[id^="attribute-selector-menu"]');
    await attributeMenu.waitFor({state: 'visible', timeout: 5000});
    await attributeMenu.locator('li').filter({hasText: attributeName}).first().click();

    // Fill value in the simple input (text-type attribute renders direct input)
    const valueInput = container.locator('.values-editor__simple-input').first();
    await valueInput.waitFor({state: 'visible', timeout: 10000});
    await valueInput.fill(value);

    // Blur the input so React commits the onChange before the caller proceeds
    await valueInput.press('Tab');
}

/**
 * Adds a channel to the policy via the channel selector modal.
 */
export async function addChannelToPolicy(container: Locator, page: Page, channelDisplayName: string) {
    await container.getByRole('button', {name: /Add channels/}).click();
    const channelModal = page.locator('.channel-selector-modal');
    await channelModal.waitFor();
    await expect(channelModal.locator('.more-modal__row').first()).toBeVisible({timeout: 10000});
    await channelModal.locator('.more-modal__row').filter({hasText: channelDisplayName}).click();
    await channelModal.getByRole('button', {name: 'Add'}).click();

    // Wait for the modal to fully close before returning — callers must not proceed
    // until the channel is committed to form state, otherwise a save click races
    // against the React state update and the confirmation modal never appears.
    await channelModal.waitFor({state: 'hidden', timeout: 20000});
}
