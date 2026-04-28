// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Helper to find the attach_app_logs preference for a given user.
 */
async function getAttachLogsPreference(
    userClient: {
        getUserPreferences: (userId: string) => Promise<Array<{category: string; name: string; value: string}>>;
    },
    userId: string,
) {
    const prefs = await userClient.getUserPreferences(userId);
    return prefs.find(
        (p: {category: string; name: string}) => p.category === 'advanced_settings' && p.name === 'attach_app_logs',
    );
}

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
        await userClient.savePreferences(user.id, [
            {user_id: user.id, category: 'advanced_settings', name: 'attach_app_logs', value: 'true'},
        ]);

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
            await userClient.savePreferences(user.id, [
                {user_id: user.id, category: 'advanced_settings', name: 'attach_app_logs', value: 'true'},
            ]);

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
            await adminClient.savePreferences(user.id, [
                {user_id: user.id, category: 'advanced_settings', name: 'attach_app_logs', value: 'true'},
            ]);

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
