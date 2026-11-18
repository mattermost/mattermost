// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

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

    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'off-topic'});
    await expect(app.center.postCreate).toBeVisible();

    // # Switch to the second team
    await app.teamSidebar.team(secondTeam).container.click();

    // * Verify the second team is displayed
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/${secondTeam.name}/`);

    // # Switch back to the first team
    await app.teamSidebar.team(team).container.click();

    // * Verify the first team is displayed
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/${team.name}/`);

    // # Log out
    await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.logOutMenuItem);
    await settle(app.globalHeader.accountMenu.logOutMenuItem, {wait: Api.Logout}).click();

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

    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Switch to the second team and view its Off-Topic channel
    await app.teamSidebar.team(secondTeam).container.click();
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/${secondTeam.name}/`);
    await app.lhs.channelList.channel('off-topic').container.click();
    await expect
        .poll(() => page.url(), {timeout: pw.duration.ten_sec})
        .toContain(`/${secondTeam.name}/channels/off-topic`);

    // # Reopen the app by navigating to the root URL
    await page.goto('/');

    // * Verify the app returns to the previously viewed team and channel
    await expect(app.center.postCreate).toBeVisible();
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
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Post a message and open its thread in the RHS
    await app.center.postCreate.message.container.fill(`rhs expand ${pw.random.id()}`);
    const created = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    const post = app.center.postList.post(created);
    await post.container.hover();
    await post.menu.replyButton.clickTo(app.rhs.thread.header.expandButton);

    // * Verify the RHS starts collapsed with an expand control (one toggle, named for what it does next)
    const toggle = app.rhs.thread.header.expandButton;
    await expect(toggle).toHaveAccessibleName('Expand Sidebar Icon');

    // # Expand the RHS
    await toggle.click();

    // * Verify the RHS is expanded (a collapse control is now shown)
    await expect(toggle).toHaveAccessibleName('Collapse Sidebar Icon');

    // # Collapse the RHS again
    await toggle.click();

    // * Verify the RHS collapses but stays open, and the center channel is visible again
    await expect(toggle).toHaveAccessibleName('Expand Sidebar Icon');
    await expect(app.rhs.container).toBeVisible();
    await expect(app.center.postCreate.message.container).toBeVisible();
});
