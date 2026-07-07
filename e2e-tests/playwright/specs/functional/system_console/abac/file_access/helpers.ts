// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createPrivateChannelForABAC, ensureUserAttributes} from '../support';

export async function setupUserAndChannel(
    adminClient: any,
    team: any,
): Promise<{
    testUser: any;
    channelName: string;
    channelId: string;
}> {
    // Ensure at least one user attribute field exists so the permission policy
    // CEL editor's "Switch to Advanced Mode" button is enabled in the UI.
    await ensureUserAttributes(adminClient, ['Department']);

    const randomId = Math.random().toString(36).substring(2, 9);
    const username = `user${randomId}`;
    const testUser = await adminClient.createUser(
        {email: `${username}@example.com`, username, password: 'Passwd4Testing!'} as any,
        '',
        '',
    );
    (testUser as any).password = 'Passwd4Testing!';

    await adminClient.addToTeam(team.id, testUser.id);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(testUser.id, channel.id);

    return {testUser, channelName: channel.name, channelId: channel.id};
}
