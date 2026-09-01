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

/**
 * @objective Verify that the right-hand-side reply panel can be expanded to overlay the center channel and collapsed back while staying open.
 */
test('MM-T440 expands and collapses the RHS reply panel', {tag: '@multi_team'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message and open its thread in the RHS
    await channelsPage.postMessage(`rhs expand ${pw.random.id()}`);
    const post = await channelsPage.getLastPost();
    await post.reply();
    await channelsPage.sidebarRight.toBeVisible();

    // * Verify the RHS starts collapsed with an expand control
    await expect(channelsPage.sidebarRight.expandButton).toBeVisible();

    // # Expand the RHS
    await channelsPage.sidebarRight.expand();

    // * Verify the RHS is expanded (a collapse control is now shown)
    await expect(channelsPage.sidebarRight.collapseButton).toBeVisible();

    // # Collapse the RHS again
    await channelsPage.sidebarRight.collapse();

    // * Verify the RHS collapses but stays open, and the center channel is visible again
    await expect(channelsPage.sidebarRight.expandButton).toBeVisible();
    await channelsPage.sidebarRight.toBeVisible();
    await expect(channelsPage.centerView.postCreate.input).toBeVisible();
});
