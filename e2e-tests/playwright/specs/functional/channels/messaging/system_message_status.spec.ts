// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

/**
 * @objective Verify a system message does not show a user availability status in standard message display.
 */
test('MM-T427_1 system message has no status in standard view', async ({pw}) => {
    await verifySystemMessageHasNoStatus(pw, 'clean');
});

/**
 * @objective Verify a system message does not show a user availability status in compact message display.
 */
test('MM-T427_2 system message has no status in compact view', async ({pw}) => {
    await verifySystemMessageHasNoStatus(pw, 'compact');
});

async function verifySystemMessageHasNoStatus(pw: PlaywrightExtended, messageDisplay: 'clean' | 'compact') {
    // # Create a channel header system message and set the user's message display preference
    const {user, team, adminClient, userClient} = await pw.initSetup();
    const channel = await userClient.getChannelByName(team.id, 'town-square');
    await userClient.createPost({channel_id: channel.id, message: 'Test for no status of a system message'});
    const newHeader = `Updated header ${pw.random.id()}`;
    await adminClient.patchChannel(channel.id, {header: newHeader});
    await userClient.savePreferences(user.id, [
        {
            user_id: user.id,
            category: 'display_settings',
            name: 'message_display',
            value: messageDisplay,
        },
    ]);

    // # Open the channel and locate the resulting system message
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    await channelsPage.centerView.waitUntilLastPostContains(newHeader);
    const systemPost = await channelsPage.getLastPost();

    // * Verify the post is styled only as a system message and has no availability status icon
    await systemPost.toBeSystemMessageContaining(newHeader);
}
