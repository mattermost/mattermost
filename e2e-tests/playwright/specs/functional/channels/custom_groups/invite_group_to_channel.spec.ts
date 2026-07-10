// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a custom user group can be invited to a channel with the /invite slash command, adding
 * the group's members to the channel.
 */
test('MM-T5598 invites a custom group to a channel', {tag: '@channels'}, async ({pw}) => {
    const {user, team, userClient, adminClient} = await pw.initSetup();

    // # Create a second team member and a custom group containing both users
    const [member] = await adminClient.createUsers(team.id, 1, 'member');
    const groupName = `group${pw.random.id()}`.toLowerCase();
    await userClient.createGroupWithUserIds({
        name: groupName,
        display_name: `Group ${pw.random.id()}`,
        source: 'custom',
        allow_reference: true,
        user_ids: [user.id, member.id],
    });

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Create a new channel
    const channelName = `Group Channel ${pw.random.id()}`;
    await channelsPage.newChannel(channelName, 'O');
    await channelsPage.centerView.header.toHaveTitle(channelName);

    // # Invite the custom group to the channel with the slash command
    await channelsPage.centerView.postCreate.writeMessage(`/invite @${groupName} `);
    await channelsPage.centerView.postCreate.sendMessage();

    // * Verify the group's member was added to the channel
    await channelsPage.centerView.waitUntilLastPostContains('added to the channel');
    await channelsPage.centerView.waitUntilLastPostContains(member.username);
});
