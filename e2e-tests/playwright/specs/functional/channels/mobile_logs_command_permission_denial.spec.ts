// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

test.describe('/mobile-logs slash command', () => {
    /**
     * @objective Verify that a non-admin user is denied when attempting to modify
     *            another user's mobile logs preference.
     */
    test(
        'MM-T67880 rejects mobile log modification when caller is not an admin',
        {tag: '@slash_commands'},
        async ({pw}) => {
            // # Initialize setup with two regular users
            const {team, adminClient, user} = await pw.initSetup();

            const otherUser = await pw.random.user('other');
            const {id: otherUserId} = await adminClient.createUser(otherUser, '', '');
            await adminClient.addToTeam(team.id, otherUserId);

            // # Log in as the first regular user
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Try to enable mobile logs for the other user
            await channelsPage.postMessage(`/mobile-logs on @${otherUser.username}`);

            // * Verify permission denied message
            const lastPost = await channelsPage.getLastPost();
            await lastPost.toContainText('Unable to change mobile log settings for that user.');
        },
    );

    /**
     * @objective Verify that a regular user cannot infer whether a username exists when
     *            attempting to target another account (same denial as missing permission).
     */
    test(
        'MM-T67880 regular user gets permission denial for nonexistent cross-user target',
        {tag: '@slash_commands'},
        async ({pw}) => {
            const {team, user} = await pw.initSetup();

            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Post the mobile-logs command
            await channelsPage.postMessage('/mobile-logs on @nonexistentuser12345');

            const lastPost = await channelsPage.getLastPost();
            // * Expect permission denial message
            await lastPost.toContainText('Unable to change mobile log settings for that user.');
        },
    );
});
