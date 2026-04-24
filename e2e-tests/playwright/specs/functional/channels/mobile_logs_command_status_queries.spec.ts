// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {setAttachLogsPreference} from './support';

test.describe('/mobile-logs slash command', () => {
    /**
     * @objective Verify that /mobile-logs status reports disabled by default for a fresh user.
     */
    test(
        'MM-T67880 reports mobile logs status as disabled for a fresh user',
        {tag: '@slash_commands'},
        async ({pw}) => {
            // # Initialize setup
            const {team, user} = await pw.initSetup();

            // # Log in as the user and navigate to town-square
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Execute /mobile-logs status
            await channelsPage.postMessage('/mobile-logs status');

            // * Verify ephemeral response shows disabled
            const lastPost = await channelsPage.getLastPost();
            await lastPost.toContainText('Mobile app log attachment is currently disabled for you');
        },
    );

    /**
     * @objective Verify that /mobile-logs status reports enabled after the preference
     *            has been set to true via API.
     */
    test(
        'MM-T67880 reports mobile logs status as enabled after preference is set',
        {tag: '@slash_commands'},
        async ({pw}) => {
            // # Initialize setup
            const {team, user, userClient} = await pw.initSetup();

            // # Pre-enable the preference via API
            await setAttachLogsPreference(userClient, user.id, 'true');

            // # Log in as the user and navigate to town-square
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Execute /mobile-logs status
            await channelsPage.postMessage('/mobile-logs status');

            // * Verify ephemeral response shows enabled
            const lastPost = await channelsPage.getLastPost();
            await lastPost.toContainText('Mobile app log attachment is currently enabled for you');
        },
    );

    /**
     * @objective Verify that a system admin can check the mobile logs status for another
     *            user and it correctly reflects the current preference state.
     */
    test('MM-T67880 admin checks mobile logs status for another user', {tag: '@slash_commands'}, async ({pw}) => {
        // # Initialize setup
        const {team, adminUser, user} = await pw.initSetup();

        // # Log in as admin and navigate to town-square
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Check status (default off)
        await channelsPage.postMessage(`/mobile-logs status @${user.username}`);

        // * Verify status shows disabled
        const statusOffPost = await channelsPage.getLastPost();
        await statusOffPost.toContainText(`Mobile app log attachment is currently disabled for @${user.username}`);
    });
});
