// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, postWith, test} from '@mattermost/playwright-lib';
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
    const {user, team, adminClient, userClient, townSquare: channel} = await pw.initSetup();
    const userPost = await userClient.createPost({
        channel_id: channel.id,
        message: 'Test for no status of a system message',
    });
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
    // # Open the channel
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const systemPost = await postWith(app.center.postList, {text: newHeader});

    // * The post is styled as a system message and shows no availability status
    await expect(systemPost).toContainText(newHeader);
    await expect(systemPost).toHaveClass(/post--system/);
    await expect(systemPost.avatar.status).not.toBeVisible();

    if (messageDisplay === 'clean') {
        // * A user's post does show the status (so the check above isn't vacuous)
        await expect(app.center.postList.post(userPost).avatar.status).toBeVisible();
    }
}
