// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a user who belongs to multiple teams can switch between them and log out to the sign-in page.
 *
 * MM-T432 is a duplicate of MM-T430 and is covered by this test.
 */
test('MM-T430 MM-T432 switches between teams and logs out', {tag: '@multi_team'}, async ({pw}) => {
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
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // # Switch to the second team
    await channelsPage.switchToTeam(secondTeam.name);

    // * Verify the second team is displayed
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/${secondTeam.name}/`);

    // # Switch back to the first team
    await channelsPage.switchToTeam(team.name);

    // * Verify the first team is displayed
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/${team.name}/`);

    // # Log out
    await channelsPage.logout();

    // * Verify the user is returned to the sign-in page
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain('/login');
});
