// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, testConfig} from '@mattermost/playwright-lib';

/**
 * @objective Verify any GM member can remove others and leave when mutable GMs are enabled.
 */
test('MM-25966 Remove and leave members of an existing group message', async ({pw}) => {
    // Boot-time flag; CI/baseline set it, ensureFeatureFlag covers reused testcontainers stacks.
    if (testConfig.useTestContainers) {
        await pw.ensureFeatureFlag('EnableMutableGroupMessages', true);
    }

    const {adminClient, team, user} = await pw.initSetup();

    const config = await adminClient.getConfig();
    test.skip(
        config.FeatureFlags?.EnableMutableGroupMessages !== true &&
            config.FeatureFlags?.EnableMutableGroupMessages !== 'true',
        'Requires FeatureFlags.EnableMutableGroupMessages=true on the server',
    );

    const participants = await adminClient.createUsers(team.id, 3, 'gm-manage');
    const groupChannel = await adminClient.createGroupChannel([
        user.id,
        participants[0].id,
        participants[1].id,
        participants[2].id,
    ]);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, groupChannel.name);
    await channelsPage.toBeVisible();

    // # Open Members RHS and enter manage mode
    await channelsPage.centerView.header.openChannelMenu();
    await page.locator('#channelMembers').click();
    await channelsPage.sidebarRight.toBeVisible();
    await page.getByRole('button', {name: 'Manage'}).click();

    // # Remove one participant
    await page.getByTestId(`memberline-${participants[2].id}`).getByTestId('removeFromChannel').click();
    await page.getByRole('button', {name: /yes, remove/i}).click();
    await expect(page.getByTestId(`memberline-${participants[2].id}`)).toHaveCount(0);

    const afterRemove = await adminClient.getChannel(groupChannel.id);
    expect(afterRemove.id).toBe(groupChannel.id);
    expect(afterRemove.name).not.toBe(groupChannel.name);

    // # Leave the group message from the channel header
    await channelsPage.centerView.header.openChannelMenu();
    await page.locator('#channelLeaveChannel').click();
    await page.getByRole('button', {name: /leave/i}).click();

    // * User is no longer a member of the GM
    await expect(adminClient.getChannelMember(groupChannel.id, user.id)).rejects.toBeTruthy();
});
