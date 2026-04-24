// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getAttachLogsPreference, setAttachLogsPreference} from './support';

test.describe('/mobile-logs slash command', () => {
    /**
     * @objective Verify that a system admin can enable mobile logs for another user
     *            and the preference is persisted on the target user's account.
     */
    test(
        'MM-T67880 admin enables mobile logs for another user and preference is persisted',
        {tag: '@slash_commands'},
        async ({pw}) => {
            // # Initialize setup
            const {team, adminUser, user, userClient} = await pw.initSetup();

            // # Log in as admin and navigate to town-square
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Execute /mobile-logs on for the regular user
            await channelsPage.postMessage(`/mobile-logs on @${user.username}`);

            // * Verify ephemeral response confirms logs enabled for the target user
            const lastPost = await channelsPage.getLastPost();
            await lastPost.toContainText(`Mobile app log attachment is now enabled for @${user.username}`);

            // * Verify the preference was set on the target user via API
            const logPref = await getAttachLogsPreference(userClient, user.id);
            expect(logPref).toBeDefined();
            expect(logPref!.value).toBe('true');
        },
    );

    /**
     * @objective Verify that a system admin can disable mobile logs for another user
     *            after they have been enabled.
     */
    test(
        'MM-T67880 admin disables mobile logs for another user after enabling via API',
        {tag: '@slash_commands'},
        async ({pw}) => {
            // # Initialize setup
            const {team, adminUser, user, userClient} = await pw.initSetup();

            // # Pre-enable the preference for the target user via API
            const {adminClient} = await pw.getAdminClient();
            await setAttachLogsPreference(adminClient, user.id, 'true');

            // # Log in as admin and navigate to town-square
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // # Disable for the regular user
            await channelsPage.postMessage(`/mobile-logs off @${user.username}`);

            // * Verify ephemeral response confirms logs disabled
            const lastPost = await channelsPage.getLastPost();
            await lastPost.toContainText(`Mobile app log attachment is now disabled for @${user.username}`);

            // * Verify the preference was set to false on the target user
            const logPref = await getAttachLogsPreference(userClient, user.id);
            expect(logPref).toBeDefined();
            expect(logPref!.value).toBe('false');
        },
    );

    /**
     * @objective Verify that /mobile-logs returns a user-not-found error when targeting
     *            a nonexistent username.
     */
    test('MM-T67880 returns error for nonexistent target user', {tag: '@slash_commands'}, async ({pw}) => {
        // # Initialize setup
        const {team, adminUser} = await pw.initSetup();

        // # Log in as admin
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Try to enable for a nonexistent user
        await channelsPage.postMessage('/mobile-logs on @nonexistentuser12345');

        // * Verify user not found message
        const lastPost = await channelsPage.getLastPost();
        await lastPost.toContainText('Could not find user "nonexistentuser12345"');
    });
});
