// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    expectLoginHeading,
    Api,
    App,
    settle,
    test,
    expect,
    logIn,
    requireSubpathServer,
} from '@mattermost/playwright-lib';

test.describe('Subpath - channel routing', {tag: '@subpath'}, () => {
    let subpathBaseURL: string;

    test.beforeAll(() => {
        subpathBaseURL = requireSubpathServer();
    });

    /**
     * @objective Verify Town Square loads correctly when the server is deployed under a subpath.
     */
    test('loads Town Square under the subpath URL', async ({pw}) => {
        const {user, team} = await pw.initSetup();

        // # Log in and go to town square
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: {name: 'town-square'}});
        await expect(app.center.postCreate).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // * Verify the channel loads
        await expect(app.channelHeader.openMenuButton).toContainText('Town Square');
    });

    /**
     * @objective Verify a permalink resolves and rejoins the channel when visited under a subpath.
     */
    test('rejoins a channel via permalink', async ({pw}) => {
        const {user, team, adminClient} = await pw.initSetup();
        const channel = await adminClient.createPublicChannel(team.id, 'Subpath Channel', 'subpath-channel');
        await adminClient.addToChannel(user.id, channel.id);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel});
        await expect(app.center.postCreate).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Post a message and build its permalink
        const message = `Subpath permalink message ${pw.random.id()}`;
        const composer = app.center.postCreate;
        await composer.message.container.fill(message);
        await expect(composer.message.container).toHaveValue(message);
        await expect(composer.sendButton).toBeVisible();
        await expect(composer.sendButton).toBeEnabled();
        const sent = await settle(composer.sendButton, {wait: Api.CreatePost}).click();
        const postId = sent.id;
        await expect(app.center.postList.post({id: postId}).message.container).toHaveText(message);
        const permalink = `${subpathBaseURL}/${team.name}/pl/${postId}`;

        // # Leave the channel
        await expect(app.channelHeader.openMenuButton).toBeVisible();
        await app.channelHeader.openMenuButton.click();
        const channelMenu = app.channelHeader.menu;
        await expect(channelMenu.leaveChannelMenuItem).toBeVisible();
        // This public channel has no enforced policy, so its leave action runs directly without a confirmation modal.
        await settle(channelMenu.leaveChannelMenuItem, {
            wait: Api.RemoveUserFromChannel,
            params: {channel_id: channel.id, user_id: user.id},
        }).click();
        await expect(app.channelHeader.openMenuButton).toContainText('Town Square');

        // # Visit the permalink
        await app.page.goto(permalink);

        // * Verify the channel is rejoined and the post is visible
        await expect(app.channelHeader.openMenuButton).toBeVisible();
        await expect(app.channelHeader.openMenuButton).toContainText(channel.display_name);
        await expect(app.center.postList.post({id: postId})).toContainText(message, {timeout: pw.duration.ten_sec});
    });

    /**
     * @objective Verify visiting a DM URL while logged out redirects into that DM after login.
     */
    test('redirects to a DM after login when visited while logged out', async ({page, pw}) => {
        const {user, team, adminClient} = await pw.initSetup();
        const [otherUser] = await adminClient.createUsers(team.id, 1, 'subpathdm');
        await adminClient.createDirectChannel([user.id, otherUser.id]);

        // # Suppress the "open in desktop app?" interstitial, then visit the DM URL while logged out
        await pw.hasSeenLandingPage(subpathBaseURL);
        await page.goto(`${subpathBaseURL}/${team.name}/messages/@${otherUser.username}`);

        // # Log in
        const app = new App(page);
        await expect(app.login.loginId.container).toBeVisible();

        await expectLoginHeading(app);
        await expect(app.login.password.container).toBeVisible();
        await logIn(app, user.username, user.password);

        // * Verify redirected into the DM, still under the subpath
        await expect.poll(() => page.url()).toBe(`${subpathBaseURL}/${team.name}/messages/@${otherUser.username}`);
    });
});
