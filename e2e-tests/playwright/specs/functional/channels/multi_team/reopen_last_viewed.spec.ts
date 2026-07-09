// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that reopening the app returns the user to the previously viewed team and channel.
 */
test('MM-T431 reopens to the previously viewed team and channel', {tag: '@multi_team'}, async ({pw}) => {
    // # Create a user in one team, then add them to a second team
    const {user, team, adminClient} = await pw.initSetup();
    const secondTeam = await pw.createNewTeam(adminClient, {
        name: 'team',
        displayName: 'Second Team',
        type: 'O',
        unique: true,
    });
    await adminClient.addToTeam(secondTeam.id, user.id);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Switch to the second team and view its Off-Topic channel
    await channelsPage.switchToTeam(secondTeam.name);
    await channelsPage.sidebarLeft.goToItem('off-topic');
    await expect
        .poll(() => page.url(), {timeout: pw.duration.ten_sec})
        .toContain(`/${secondTeam.name}/channels/off-topic`);

    // # Reopen the app by navigating to the root URL
    await page.goto('/');

    // * Verify the app returns to the previously viewed team and channel
    await channelsPage.toBeVisible();
    await expect
        .poll(() => page.url(), {timeout: pw.duration.ten_sec})
        .toContain(`/${secondTeam.name}/channels/off-topic`);
});
