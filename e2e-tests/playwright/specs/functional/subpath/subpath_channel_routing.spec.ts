// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect, requireSubpathServer} from '@mattermost/playwright-lib';

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
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // * Verify the channel loads
        await channelsPage.centerView.header.toHaveTitle('Town Square');
    });

    /**
     * @objective Verify a permalink resolves and rejoins the channel when visited under a subpath.
     */
    test('rejoins a channel via permalink', async ({pw}) => {
        const {user, team, adminClient} = await pw.initSetup();
        const channel = await adminClient.createPublicChannel(team.id, 'Subpath Channel', 'subpath-channel');
        await adminClient.addToChannel(user.id, channel.id);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Post a message and build its permalink
        const message = `Subpath permalink message ${pw.random.id()}`;
        await channelsPage.postMessage(message);
        const lastPost = await channelsPage.getLastPost();
        const postId = await lastPost.getId();
        const permalink = `${subpathBaseURL}/${team.name}/pl/${postId}`;

        // # Leave the channel
        const channelMenu = await channelsPage.openChannelMenu();
        await channelMenu.leaveChannel.click();
        await channelsPage.centerView.header.toHaveTitle('Town Square');

        // # Visit the permalink
        await channelsPage.page.goto(permalink);

        // * Verify the channel is rejoined and the post is visible
        await channelsPage.centerView.header.toHaveTitle(channel.display_name);
        await channelsPage.centerView.waitUntilPostWithIdContains(postId, message);
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
        await pw.loginPage.toBeVisible();
        await pw.loginPage.loginInput.fill(user.username);
        await pw.loginPage.passwordInput.fill(user.password);
        await pw.loginPage.signInButton.click();

        // * Verify redirected into the DM, still under the subpath
        await expect.poll(() => page.url()).toBe(`${subpathBaseURL}/${team.name}/messages/@${otherUser.username}`);
    });
});
