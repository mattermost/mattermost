// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify members can be added to an existing group message with history when the feature flag is on.
 */
test('MM-25966 Add member to existing group message preserves history', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();

    const config = await adminClient.getConfig();
    test.skip(
        config.FeatureFlags?.EnableMutableGroupMessages !== true &&
            config.FeatureFlags?.EnableMutableGroupMessages !== 'true',
        'Requires FeatureFlags.EnableMutableGroupMessages=true on the server',
    );

    const participants = await adminClient.createUsers(team.id, 3, 'gm-add');
    const groupChannel = await adminClient.createGroupChannel([user.id, participants[0].id, participants[1].id]);
    await adminClient.createPost({
        channel_id: groupChannel.id,
        message: 'history before adding member',
    });

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, groupChannel.name);
    await channelsPage.toBeVisible();

    // # Open Members RHS and invite a new person into this GM
    await channelsPage.centerView.header.openChannelMenu();
    await page.locator('#channelMembers').click();
    await channelsPage.sidebarRight.toBeVisible();
    await page.getByRole('button', {name: 'Add people'}).click();

    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible();

    // * Verify history warning is shown
    await expect(dialog.getByText('Conversation history will be visible')).toBeVisible();

    // # Add the third participant
    const searchInput = dialog.getByLabel(/Search for people/);
    await searchInput.fill(participants[2].username);
    await page.locator('#multiSelectList').getByText(participants[2].username).first().click();
    await dialog.getByRole('button', {name: 'Add'}).click();

    // * Stay in the same group message and see the add system message plus prior history
    await expect(page.getByText('history before adding member')).toBeVisible();
    await expect(page.getByText(new RegExp(`${participants[2].username}.*added to the channel`, 'i'))).toBeVisible();

    const updated = await adminClient.getChannel(groupChannel.id);
    expect(updated.id).toBe(groupChannel.id);
    expect(updated.name).not.toBe(groupChannel.name);
});
