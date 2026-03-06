// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

export async function enableABACConfig(client: Client4) {
    const config = await client.getConfig();
    config.AccessControlSettings = {
        ...config.AccessControlSettings,
        EnableAttributeBasedAccessControl: true,
        EnableUserManagedAttributes: true,
    };
    await client.updateConfig(config);
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
        await (client as any).doFetch(`${client.getBaseRoute()}/custom_profile_attributes/fields`, {
            method: 'POST',
            body: JSON.stringify({name: 'Department', type: 'text', attrs: {visibility: 'when_set'}}),
        });
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

export async function createPrivateChannel(client: Client4, teamId: string) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    return client.createChannel({team_id: teamId, name: `abac-${id}`, display_name: `ABAC-${id}`, type: 'P'} as any);
}

export async function createTeamAdmin(adminClient: Client4, teamId: string) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const user = await adminClient.createUser(
        {
            email: `teamadmin-${id}@sample.mattermost.com`,
            username: `teamadmin${id}`,
            password: 'Password123!',
        } as any,
        '',
        '',
    );
    user.password = 'Password123!';

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
