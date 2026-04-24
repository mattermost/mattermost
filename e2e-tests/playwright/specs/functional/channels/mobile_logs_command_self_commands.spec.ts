// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getAttachLogsPreference, setAttachLogsPreference} from './support';

test.describe('/mobile-logs slash command', () => {
    /**
     * @objective Verify that /mobile-logs on sets the attach_app_logs preference to true
     *            and returns an ephemeral confirmation visible only to the invoking user.
     */
    test(
        'MM-T67880 enables mobile logs for self and confirms preference is set',
        {tag: '@slash_commands'},
        async ({pw}) => {
            // # Initialize setup
            const {team, user, userClient} = await pw.initSetup();

            // # Log in as the user and navigate to town-square
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Execute /mobile-logs on
            await channelsPage.postMessage('/mobile-logs on');

            // * Verify ephemeral response confirms logs enabled
            const lastPost = await channelsPage.getLastPost();
            await lastPost.toContainText('Mobile app log attachment is now enabled for you');

            // * Verify the response is ephemeral (only visible to the user)
            await expect(lastPost.container.locator('.post__visibility')).toContainText('(Only visible to you)');

            // * Verify the preference was actually set via API
            const logPref = await getAttachLogsPreference(userClient, user.id);
            expect(logPref).toBeDefined();
            expect(logPref!.value).toBe('true');
        },
    );

    /**
     * @objective Verify that /mobile-logs off sets the attach_app_logs preference to false
     *            and returns an ephemeral confirmation.
     */
    test('MM-T67880 disables mobile logs for self after enabling via API', {tag: '@slash_commands'}, async ({pw}) => {
        // # Initialize setup
        const {team, user, userClient} = await pw.initSetup();

        // # Pre-enable the preference via API to avoid back-to-back commands
        await setAttachLogsPreference(userClient, user.id, 'true');

        // # Log in as the user and navigate to town-square
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Execute /mobile-logs off
        await channelsPage.postMessage('/mobile-logs off');

        // * Verify ephemeral response confirms logs disabled
        const lastPost = await channelsPage.getLastPost();
        await lastPost.toContainText('Mobile app log attachment is now disabled for you');

        // * Verify the preference was set to false via API
        const logPref = await getAttachLogsPreference(userClient, user.id);
        expect(logPref).toBeDefined();
        expect(logPref!.value).toBe('false');
    });

    /**
     * @objective Verify that /mobile-logs displays a usage hint when invoked
     *            without arguments or with an invalid action.
     */
    test('MM-T67880 displays usage hint for invalid or missing arguments', {tag: '@slash_commands'}, async ({pw}) => {
        // # Initialize setup
        const {team, user} = await pw.initSetup();

        // # Log in as the user and navigate to town-square
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Execute /mobile-logs with an invalid action
        await channelsPage.postMessage('/mobile-logs invalid');

        // * Verify usage message is shown
        const lastPost = await channelsPage.getLastPost();
        await lastPost.toContainText('Usage: /mobile-logs [on|off|status] [@username]');
    });
});
