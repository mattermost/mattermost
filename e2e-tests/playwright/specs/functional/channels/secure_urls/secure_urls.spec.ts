// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test.describe('Secure URLs', () => {
    /**
     * @objective Verify that the secure URLs setting can be toggled on from System Console and persists after navigation
     *
     * @precondition
     * Server must have an Enterprise Advanced license
     */
    test(
        'enables secure URLs setting from System Console and verifies it persists',
        {tag: '@secure_urls'},
        async ({pw}) => {
            // # Initialize setup and check license
            const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
            const license = await adminClient.getClientLicenseOld();
            test.skip(
                license.SkuShortName !== 'advanced',
                'Skipping test - server does not have enterprise advanced license',
            );

            // # Log in as admin
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);

            // # Visit System Console
            await systemConsolePage.goto();
            await systemConsolePage.toBeVisible();

            // # Navigate to Users and Teams
            await systemConsolePage.sidebar.siteConfiguration.usersAndTeams.click();
            await systemConsolePage.usersAndTeams.toBeVisible();

            // * Verify the secure URLs radio group is visible
            await systemConsolePage.usersAndTeams.useSecureURLs.toBeVisible();

            // * Verify the setting is initially false
            await systemConsolePage.usersAndTeams.useSecureURLs.toBeFalse();

            // # Enable secure URLs by clicking the True radio
            await systemConsolePage.usersAndTeams.useSecureURLs.selectTrue();

            // * Verify it is now true
            await systemConsolePage.usersAndTeams.useSecureURLs.toBeTrue();

            // # Save settings
            await systemConsolePage.usersAndTeams.save();
            await pw.waitUntil(async () => (await systemConsolePage.usersAndTeams.saveButton.textContent()) === 'Save');

            // # Navigate away and come back
            await systemConsolePage.sidebar.siteConfiguration.notifications.click();
            await systemConsolePage.notifications.toBeVisible();

            await systemConsolePage.sidebar.siteConfiguration.usersAndTeams.click();
            await systemConsolePage.usersAndTeams.toBeVisible();

            // * Verify the setting is still enabled
            await systemConsolePage.usersAndTeams.useSecureURLs.toBeTrue();

            // # Reset to false for cleanup
            await systemConsolePage.usersAndTeams.useSecureURLs.selectFalse();
            await systemConsolePage.usersAndTeams.save();
            await pw.waitUntil(async () => (await systemConsolePage.usersAndTeams.saveButton.textContent()) === 'Save');
        },
    );

    /**
     * @objective Verify that the channel URL editor is hidden when creating a new channel with secure URLs enabled
     *
     * @precondition
     * Server must have an Enterprise Advanced license
     */
    test(
        'hides channel URL editor when creating new channel with secure URLs enabled',
        {tag: '@secure_urls'},
        async ({pw}) => {
            // # Initialize setup and configure secure URLs
            const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
            const license = await adminClient.getClientLicenseOld();
            test.skip(
                license.SkuShortName !== 'advanced',
                'Skipping test - server does not have enterprise advanced license',
            );

            const config = await adminClient.getConfig();
            config.PrivacySettings.UseAnonymousURLs = true;
            await adminClient.updateConfig(config);

            // # Log in and go to channels
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            // # Open new channel modal
            await channelsPage.sidebarLeft.browseOrCreateChannelButton.click();
            await channelsPage.page.locator('#createNewChannelMenuItem').click();
            await channelsPage.newChannelModal.toBeVisible();

            // # Fill in a channel name
            await channelsPage.newChannelModal.fillDisplayName('Secure Test Channel');

            // * Verify the URL editor section is not visible
            await expect(channelsPage.newChannelModal.urlSection).not.toBeVisible();

            // # Cancel modal
            await channelsPage.newChannelModal.cancel();
        },
    );

    /**
     * @objective Verify that a channel created with secure URLs enabled has an obfuscated slug that does not match the display name
     *
     * @precondition
     * Server must have an Enterprise Advanced license
     */
    test('creates channel with obfuscated URL slug when secure URLs enabled', {tag: '@secure_urls'}, async ({pw}) => {
        // # Initialize setup
        const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        const config = await adminClient.getConfig();
        config.PrivacySettings.UseAnonymousURLs = true;
        await adminClient.updateConfig(config);

        // # Add admin to the test team so they can create channels there
        await adminClient.addToTeam(team.id, adminUser.id);

        // # Log in and go to the test team
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Create a new channel via UI
        const channelDisplayName = 'Obfuscated Channel ' + Date.now();
        await channelsPage.sidebarLeft.browseOrCreateChannelButton.click();
        await channelsPage.page.locator('#createNewChannelMenuItem').click();
        await channelsPage.newChannelModal.toBeVisible();
        await channelsPage.newChannelModal.fillDisplayName(channelDisplayName);
        await channelsPage.newChannelModal.create();

        // # Wait for channel to be created and navigated to
        await channelsPage.toBeVisible();
        await pw.wait(pw.duration.two_sec);

        // # Fetch all channels for the team to find the newly created one by display name
        const allChannels = await adminClient.getChannels(team.id);
        const createdChannel = allChannels.find((ch) => ch.display_name === channelDisplayName);

        // * Verify channel was created
        expect(createdChannel).toBeDefined();

        // * Verify the slug does not match a cleaned version of the display name
        const humanReadableSlug = channelDisplayName.toLowerCase().replace(/\s+/g, '-');
        expect(createdChannel!.name).not.toBe(humanReadableSlug);

        // * Verify the slug looks like a model.NewId (26 chars, alphanumeric)
        expect(createdChannel!.name).toMatch(/^[a-z0-9]{26}$/);

        // * Verify display name is preserved
        expect(createdChannel!.display_name).toBe(channelDisplayName);
    });

    /**
     * @objective Verify that the channel URL editor is visible when creating a new channel with secure URLs disabled (default)
     */
    test(
        'shows channel URL editor when creating new channel with secure URLs disabled',
        {tag: '@secure_urls'},
        async ({pw}) => {
            // # Initialize setup
            const {adminUser} = await pw.initSetup({withDefaultProfileImage: false});

            // # Log in and go to channels
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            // # Open new channel modal
            await channelsPage.sidebarLeft.browseOrCreateChannelButton.click();
            await channelsPage.page.locator('#createNewChannelMenuItem').click();
            await channelsPage.newChannelModal.toBeVisible();

            // # Type a display name to trigger URL generation
            await channelsPage.newChannelModal.fillDisplayName('Test Channel URL');

            // * Verify the URL editor section is visible
            await expect(channelsPage.newChannelModal.urlSection).toBeVisible();

            // # Cancel modal
            await channelsPage.newChannelModal.cancel();
        },
    );

    /**
     * @objective Verify that the team URL step is skipped when creating a team with secure URLs enabled and the team is created directly after entering display name
     *
     * @precondition
     * Server must have an Enterprise Advanced license
     */
    test('skips team URL step when creating team with secure URLs enabled', {tag: '@secure_urls'}, async ({pw}) => {
        // # Initialize setup
        const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            license.SkuShortName !== 'advanced',
            'Skipping test - server does not have enterprise advanced license',
        );

        const config = await adminClient.getConfig();
        config.PrivacySettings.UseAnonymousURLs = true;
        await adminClient.updateConfig(config);

        // # Log in and go to channels
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open team menu and click Create a team
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();
        await channelsPage.teamMenu.clickCreateTeam();

        // # Wait for create team form
        await channelsPage.createTeamForm.toBeVisible();

        // * Verify the display name input is visible
        await expect(channelsPage.createTeamForm.teamNameInput).toBeVisible();

        // * Verify the submit button text says "Finish" (not "Next") because URL step is skipped
        await expect(channelsPage.createTeamForm.teamNameNextButton).toContainText('Finish');

        // # Enter team name and submit
        const teamName = 'Secure Team ' + Date.now();
        await channelsPage.createTeamForm.fillTeamName(teamName);
        await channelsPage.createTeamForm.submitDisplayName();

        // * Verify the team is created and user is redirected (no URL step shown)
        await channelsPage.toBeVisible();

        // # Verify the team has an obfuscated slug
        const teams = await adminClient.getMyTeams();
        const createdTeam = teams.find((t) => t.display_name === teamName);
        expect(createdTeam).toBeDefined();
        expect(createdTeam!.name).toMatch(/^[a-z0-9]{26}$/);
    });

    /**
     * @objective Verify that the team URL step is shown when creating a team with secure URLs disabled (default)
     */
    test('shows team URL step when creating team with secure URLs disabled', {tag: '@secure_urls'}, async ({pw}) => {
        // # Initialize setup
        const {adminUser} = await pw.initSetup({withDefaultProfileImage: false});

        // # Log in and go to channels
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Open team menu and click Create a team
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();
        await channelsPage.teamMenu.clickCreateTeam();

        // # Wait for create team form
        await channelsPage.createTeamForm.toBeVisible();

        // * Verify the submit button says "Next" (not "Finish") indicating URL step follows
        await expect(channelsPage.createTeamForm.teamNameNextButton).toContainText('Next');

        // # Enter team name and click Next
        await channelsPage.createTeamForm.fillTeamName('Test Team URL Step');
        await channelsPage.createTeamForm.submitDisplayName();

        // * Verify the team URL step is now visible
        await expect(channelsPage.createTeamForm.teamURLInput).toBeVisible();
        await expect(channelsPage.createTeamForm.teamURLFinishButton).toBeVisible();
    });
});
