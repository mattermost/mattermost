// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const OBFUSCATED_SLUG_RE = /^[a-z0-9]{26}$/;

async function skipIfNoAdvancedLicense(adminClient: any) {
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have enterprise advanced license');
}

async function setSecureUrls(adminClient: any, enabled: boolean) {
    await adminClient.patchConfig({
        PrivacySettings: {
            UseAnonymousURLs: enabled,
        },
    });
}

function expectObfuscatedSlug(slug: string) {
    expect(slug).toMatch(OBFUSCATED_SLUG_RE);
}

function expectReadableSlug(slug: string, expectedSlug?: string) {
    if (expectedSlug) {
        expect(slug).toBe(expectedSlug);
    }

    expect(slug).not.toMatch(OBFUSCATED_SLUG_RE);
}

async function createChannelFromUI(channelsPage: any, displayName: string) {
    const newChannelModal = await channelsPage.openNewChannelModal();
    await newChannelModal.fillDisplayName(displayName);
    await newChannelModal.create();
    await channelsPage.toBeVisible();
}

async function createTeamFromUI(channelsPage: any, displayName: string) {
    const createTeamForm = await channelsPage.openCreateTeamForm();
    await createTeamForm.fillTeamName(displayName);
    await createTeamForm.submitDisplayName();
    await channelsPage.toBeVisible();
}

async function getChannelByDisplayName(adminClient: any, teamId: string, displayName: string) {
    const channels = await adminClient.getChannels(teamId);
    const channel = channels.find((candidate: any) => candidate.display_name === displayName);

    expect(channel).toBeDefined();

    return channel!;
}

async function getTeamByDisplayName(adminClient: any, displayName: string) {
    const teams = await adminClient.getMyTeams();
    const team = teams.find((candidate: any) => candidate.display_name === displayName);

    expect(team).toBeDefined();

    return team!;
}

async function createSecureUrlChannel(
    channelsPage: any,
    adminClient: any,
    teamName: string,
    teamId: string,
    displayName: string,
) {
    await createChannelFromUI(channelsPage, displayName);
    await channelsPage.centerView.header.toHaveTitle(displayName);

    const channel = await getChannelByDisplayName(adminClient, teamId, displayName);
    expectObfuscatedSlug(channel.name);
    await expect(channelsPage.page).toHaveURL(new RegExp(`/${teamName}/channels/${channel.name}$`));

    return channel;
}

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

            await setSecureUrls(adminClient, true);

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

        await setSecureUrls(adminClient, true);

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

        await setSecureUrls(adminClient, true);

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

    /**
     * @objective Verify that an archived channel created with secure URLs keeps its obfuscated route and becomes usable again after unarchiving.
     */
    test(
        'preserves archived secure channel routes and restores channel access after unarchive',
        {tag: '@secure_urls'},
        async ({pw}) => {
            // # Initialize setup and enable secure URLs
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await setSecureUrls(adminClient, true);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Log in as admin and create a channel with an obfuscated slug
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const channelDisplayName = `Archived Secure ${await pw.random.id()}`;
            await createChannelFromUI(channelsPage, channelDisplayName);

            const createdChannel = await getChannelByDisplayName(adminClient, team.id, channelDisplayName);
            expectObfuscatedSlug(createdChannel.name);

            // # Archive the channel and preserve the secure slug
            await adminClient.deleteChannel(createdChannel.id);
            const archivedChannel = await adminClient.getChannel(createdChannel.id);

            // * Verify archiving does not rotate the secure route slug
            expect(archivedChannel.name).toBe(createdChannel.name);

            // # Restore the archived channel and verify the secure slug is preserved
            const restoredChannel = await adminClient.unarchiveChannel(createdChannel.id);
            expect(restoredChannel.name).toBe(createdChannel.name);

            // # Open the restored channel again from the sidebar
            await channelsPage.page.reload();
            await channelsPage.sidebarLeft.goToItem(createdChannel.name);

            // * Verify the restored channel still uses the original secure route
            await channelsPage.centerView.header.toHaveTitle(channelDisplayName);
            await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${createdChannel.name}`);
        },
    );

    /**
     * @objective Verify that enabling secure URLs does not rewrite existing readable slugs and only affects channels and teams created afterward.
     */
    test(
        'keeps existing readable routes unchanged and obfuscates only newly created channels and teams',
        {tag: '@secure_urls'},
        async ({pw}) => {
            // # Initialize setup with secure URLs disabled by default
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Create a legacy channel and team before enabling secure URLs
            const legacyChannelSlug = `legacy-channel-${await pw.random.id()}`;
            const legacyChannelDisplayName = `Legacy Channel ${await pw.random.id()}`;
            const legacyChannel = await adminClient.createChannel({
                team_id: team.id,
                name: legacyChannelSlug,
                display_name: legacyChannelDisplayName,
                type: 'O',
            });

            const legacyTeamSlug = `legacy-team-${await pw.random.id()}`;
            const legacyTeamDisplayName = `Legacy Team ${await pw.random.id()}`;
            const legacyTeam = await adminClient.createTeam({
                name: legacyTeamSlug,
                display_name: legacyTeamDisplayName,
                type: 'O',
            } as any);

            expectReadableSlug(legacyChannel.name, legacyChannelSlug);
            expectReadableSlug(legacyTeam.name, legacyTeamSlug);

            // # Enable secure URLs after the legacy channel and team already exist
            await setSecureUrls(adminClient, true);

            const legacyChannelAfterToggle = await adminClient.getChannel(legacyChannel.id);
            const legacyTeamAfterToggle = await adminClient.getTeam(legacyTeam.id);

            // * Verify the pre-existing slugs remain readable and unchanged
            expectReadableSlug(legacyChannelAfterToggle.name, legacyChannelSlug);
            expectReadableSlug(legacyTeamAfterToggle.name, legacyTeamSlug);

            // # Log in and verify the original readable channel route still works
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, legacyChannelSlug);
            await channelsPage.toBeVisible();
            await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${legacyChannelSlug}`);

            // # Create a new channel after the secure URL toggle
            const secureChannelDisplayName = `Secure Channel ${await pw.random.id()}`;
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();
            await createChannelFromUI(channelsPage, secureChannelDisplayName);

            const secureChannel = await getChannelByDisplayName(adminClient, team.id, secureChannelDisplayName);

            // * Verify only the new channel receives an obfuscated slug
            expectObfuscatedSlug(secureChannel.name);
            await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${secureChannel.name}`);

            // # Create a new team after the secure URL toggle
            const secureTeamDisplayName = `Secure Team ${await pw.random.id()}`;
            await createTeamFromUI(channelsPage, secureTeamDisplayName);

            const secureTeam = await getTeamByDisplayName(adminClient, secureTeamDisplayName);

            // * Verify only the new team receives an obfuscated slug
            expectObfuscatedSlug(secureTeam.name);
            await expect(channelsPage.page).toHaveURL(new RegExp(`/${secureTeam.name}/`));
        },
    );

    /**
     * @objective Verify that direct and group messages continue using message routes and are excluded from secure URL slug obfuscation.
     */
    test(
        'keeps direct and group message routes readable when secure URLs are enabled',
        {tag: '@secure_urls'},
        async ({pw}) => {
            // # Initialize setup, create message participants, and enable secure URLs
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await setSecureUrls(adminClient, true);
            await adminClient.addToTeam(team.id, adminUser.id);

            const secondUser = await pw.createNewUserProfile(adminClient, {prefix: 'secureurlsdm'});
            const thirdUser = await pw.createNewUserProfile(adminClient, {prefix: 'secureurlsgm'});
            await adminClient.addToTeam(team.id, secondUser.id);
            await adminClient.addToTeam(team.id, thirdUser.id);

            const dmChannel = await adminClient.createDirectChannel([adminUser.id, secondUser.id]);
            const gmChannel = await adminClient.createGroupChannel([adminUser.id, secondUser.id, thirdUser.id]);

            const dmMessage = `Secure URL DM ${await pw.random.id()}`;
            const gmMessage = `Secure URL GM ${await pw.random.id()}`;
            await adminClient.createPost({channel_id: dmChannel.id, message: dmMessage});
            await adminClient.createPost({channel_id: gmChannel.id, message: gmMessage});

            // * Verify DM and GM channel identifiers are not replaced with obfuscated slugs
            expect(dmChannel.type).toBe('D');
            expect(gmChannel.type).toBe('G');
            expectReadableSlug(dmChannel.name);
            expectReadableSlug(gmChannel.name);
            expect(dmChannel.name).toContain(adminUser.id);
            expect(dmChannel.name).toContain(secondUser.id);

            // # Log in as admin and open the DM route
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, `@${secondUser.username}`);
            await channelsPage.toBeVisible();

            // * Verify the DM still uses the standard message route
            await expect(channelsPage.page).toHaveURL(`/${team.name}/messages/@${secondUser.username}`);
            await channelsPage.centerView.waitUntilLastPostContains(dmMessage);

            // # Open the GM route
            await channelsPage.gotoMessage(team.name, gmChannel.name);
            await channelsPage.toBeVisible();

            // * Verify the GM still uses the standard message route
            await expect(channelsPage.page).toHaveURL(`/${team.name}/messages/${gmChannel.name}`);
            await channelsPage.centerView.waitUntilLastPostContains(gmMessage);
        },
    );

    /**
     * @objective Verify that renaming a secure channel changes the display name without rewriting its obfuscated channel slug.
     */
    test('renames a secure channel without changing its obfuscated route', {tag: '@secure_urls'}, async ({pw}) => {
        // # Initialize setup and create a secure channel
        const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoAdvancedLicense(adminClient);
        await setSecureUrls(adminClient, true);
        await adminClient.addToTeam(team.id, adminUser.id);

        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const originalDisplayName = `Original Channel ${await pw.random.id()}`;
        await createChannelFromUI(channelsPage, originalDisplayName);

        const createdChannel = await getChannelByDisplayName(adminClient, team.id, originalDisplayName);
        const originalSlug = createdChannel.name;
        expectObfuscatedSlug(originalSlug);

        // # Rename the channel from channel settings
        const renamedDisplayName = `Renamed Channel ${await pw.random.id()}`;
        const channelSettingsModal = await channelsPage.openChannelSettings();
        const infoTab = await channelSettingsModal.openInfoTab();
        await infoTab.updateName(renamedDisplayName);
        await channelSettingsModal.save();

        await pw.waitUntil(
            async () => (await adminClient.getChannel(createdChannel.id)).display_name === renamedDisplayName,
        );
        await channelSettingsModal.close();

        const renamedChannel = await adminClient.getChannel(createdChannel.id);

        // * Verify the channel name changes without rotating the secure slug
        expect(renamedChannel.display_name).toBe(renamedDisplayName);
        expect(renamedChannel.name).toBe(originalSlug);
        expectObfuscatedSlug(renamedChannel.name);

        // # Reopen the channel using its original obfuscated route
        await channelsPage.goto(team.name, originalSlug);
        await channelsPage.toBeVisible();

        // * Verify the obfuscated route still resolves to the renamed channel
        await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${originalSlug}`);
        await channelsPage.centerView.header.toHaveTitle(renamedDisplayName);
    });

    /**
     * @objective Verify that renaming a secure team changes the display name without rewriting its obfuscated team slug.
     */
    test('renames a secure team without changing its obfuscated route', {tag: '@secure_urls'}, async ({pw}) => {
        // # Initialize setup and enable secure URLs
        const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoAdvancedLicense(adminClient);
        await setSecureUrls(adminClient, true);

        // # Log in as admin and create a team with an obfuscated slug
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const originalTeamDisplayName = `Original Team ${await pw.random.id()}`;
        await createTeamFromUI(channelsPage, originalTeamDisplayName);

        const createdTeam = await getTeamByDisplayName(adminClient, originalTeamDisplayName);
        const originalTeamSlug = createdTeam.name;
        expectObfuscatedSlug(originalTeamSlug);

        // # Rename the team from team settings
        const renamedTeamDisplayName = `Renamed Team ${await pw.random.id()}`;
        const teamSettingsModal = await channelsPage.openTeamSettings();
        const infoTab = await teamSettingsModal.openInfoTab();
        await infoTab.updateName(renamedTeamDisplayName);
        await teamSettingsModal.save();

        await pw.waitUntil(
            async () => (await adminClient.getTeam(createdTeam.id)).display_name === renamedTeamDisplayName,
        );
        await teamSettingsModal.close();

        const renamedTeam = await adminClient.getTeam(createdTeam.id);

        // * Verify the team name changes without rotating the secure slug
        expect(renamedTeam.display_name).toBe(renamedTeamDisplayName);
        expect(renamedTeam.name).toBe(originalTeamSlug);
        expectObfuscatedSlug(renamedTeam.name);

        // # Reopen the team using its original obfuscated route
        await channelsPage.goto(originalTeamSlug);
        await channelsPage.toBeVisible();

        // * Verify the obfuscated team route still resolves to the renamed team
        await expect(channelsPage.page).toHaveURL(new RegExp(`/${originalTeamSlug}/`));

        const reopenedTeamSettings = await channelsPage.openTeamSettings();
        await expect(reopenedTeamSettings.infoSettings.nameInput).toHaveValue(renamedTeamDisplayName);
        await reopenedTeamSettings.close();
    });

    /**
     * @objective Verify that post permalinks created in secure URL channels continue to resolve after the feature is turned off.
     */
    test(
        'opens secure channel permalinks before and after disabling secure URLs',
        {tag: '@secure_urls'},
        async ({pw}) => {
            // # Initialize setup and enable secure URLs
            const {adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await setSecureUrls(adminClient, true);

            // # Log in and create a secure URL channel
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            const displayName = `Permalink Channel ${await pw.random.id()}`;
            const channel = await createSecureUrlChannel(channelsPage, adminClient, team.name, team.id, displayName);

            // # Publish a post that will be opened via permalink
            const message = `Secure permalink message ${await pw.random.id()}`;
            await channelsPage.postMessage(message);

            const lastPost = await channelsPage.getLastPost();
            const postId = await lastPost.getId();
            const permalink = `/${team.name}/pl/${postId}`;

            // # Open the permalink while secure URLs are enabled
            await channelsPage.page.goto(permalink);

            // * Verify the permalink resolves to the channel's obfuscated route
            await channelsPage.centerView.header.toHaveTitle(displayName);
            await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${channel.name}`);
            await channelsPage.centerView.waitUntilPostWithIdContains(postId, message);

            // # Disable secure URLs and reopen the same permalink
            await setSecureUrls(adminClient, false);
            await channelsPage.page.goto(permalink);

            // * Verify the permalink still resolves to the existing obfuscated route
            await channelsPage.centerView.header.toHaveTitle(displayName);
            await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${channel.name}`);
            await channelsPage.centerView.waitUntilPostWithIdContains(postId, message);
        },
    );

    /**
     * @objective Verify that channel search finds secure URL channels by display name and navigates to their obfuscated routes.
     */
    test('channel search finds channels with obfuscated URLs', {tag: '@secure_urls'}, async ({pw}) => {
        // # Initialize setup and enable secure URLs
        const {adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoAdvancedLicense(adminClient);
        await setSecureUrls(adminClient, true);

        // # Log in and create secure URL channels
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const createdChannels = [];
        for (let i = 1; i <= 3; i++) {
            const displayName = `Search Test Channel ${i} ${await pw.random.id()}`;
            const channel = await createSecureUrlChannel(channelsPage, adminClient, team.name, team.id, displayName);
            createdChannels.push({channel, displayName});
        }

        const targetChannel = createdChannels[0];

        // # Open Find Channels and search by display name
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.sidebarLeft.findChannelButton.click();
        await channelsPage.findChannelsModal.toBeVisible();
        await channelsPage.findChannelsModal.input.fill(targetChannel.displayName.substring(0, 15));

        // * Verify the secure URL channel appears in results
        const result = channelsPage.findChannelsModal.getResult(targetChannel.channel.name);
        await expect(result).toBeVisible();
        await expect(result).toContainText(targetChannel.displayName);

        // # Select the matching secure URL channel
        await channelsPage.findChannelsModal.selectChannel(targetChannel.channel.name);

        // * Verify navigation lands on the obfuscated route
        await channelsPage.centerView.header.toHaveTitle(targetChannel.displayName);
        await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${targetChannel.channel.name}`);
    });

    /**
     * @objective Verify that post search results navigate back to the correct secure URL channel route.
     */
    test('navigates post search results back to secure URL channels', {tag: '@secure_urls'}, async ({pw}) => {
        // # Initialize setup and enable secure URLs
        const {adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoAdvancedLicense(adminClient);
        await setSecureUrls(adminClient, true);

        // # Log in and create a secure URL channel with a searchable post
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const displayName = `Search Channel ${await pw.random.id()}`;
        const channel = await createSecureUrlChannel(channelsPage, adminClient, team.name, team.id, displayName);
        const message = `SecureSearchableMessage${await pw.random.id()}`;
        await channelsPage.postMessage(message);

        const lastPost = await channelsPage.getLastPost();
        const postId = await lastPost.getId();

        // # Open message search from another channel
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.globalHeader.openSearch();
        await channelsPage.searchBox.searchInput.fill(message);
        await channelsPage.searchBox.searchInput.press('Enter');

        const searchItem = channelsPage.page.getByTestId('search-item-container').first();

        // * Verify the post appears in results
        await expect(searchItem).toContainText(message, {timeout: 15000});

        // # Jump from the search result back to the secure URL channel
        await searchItem.getByRole('link', {name: 'Jump'}).click();

        // * Verify navigation returns to the secure route and highlights the expected post
        await channelsPage.centerView.header.toHaveTitle(displayName);
        await expect(channelsPage.page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}`));
        await channelsPage.centerView.waitUntilPostWithIdContains(postId, message);
    });

    /**
     * @objective Verify that secure URLs preserve edge-case channel display names while keeping channels discoverable and fully usable.
     */
    test(
        'creates secure URL channels from unicode and emoji display names and keeps them discoverable',
        {tag: '@secure_urls'},
        async ({pw}) => {
            // # Initialize setup and enable secure URLs
            const {user, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await setSecureUrls(adminClient, true);

            // # Log in and open the test team
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            // # Create channels with edge-case display names
            const channelTemplates = ['Design review 🚀', 'Roadmap 中文', 'Support & Ops عربى'];
            const createdChannels = [];

            for (const template of channelTemplates) {
                const displayName = `${template} ${(await pw.random.id()).slice(0, 6)}`;
                const channel = await createSecureUrlChannel(
                    channelsPage,
                    adminClient,
                    team.name,
                    team.id,
                    displayName,
                );

                createdChannels.push({channel, displayName});

                // # Post in the new secure URL channel
                const message = `secure-url edge case ${displayName}`;
                await channelsPage.postMessage(message);

                // * Verify the channel keeps the exact display name and remains usable
                const lastPost = await channelsPage.getLastPost();
                await expect(lastPost.body).toContainText(message);
                await channelsPage.centerView.header.toHaveTitle(displayName);
                await expect(channelsPage.page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}$`));
            }

            const searchableChannel = createdChannels[1];

            // # Reopen the channel from Find Channels using its display name
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();
            await channelsPage.sidebarLeft.findChannelButton.click();
            await channelsPage.findChannelsModal.toBeVisible();
            await channelsPage.findChannelsModal.input.fill(searchableChannel.displayName);

            // * Verify search results use the display name and navigate back to the obfuscated slug
            await expect(channelsPage.findChannelsModal.getResult(searchableChannel.channel.name)).toBeVisible();
            await channelsPage.findChannelsModal.selectChannel(searchableChannel.channel.name);
            await channelsPage.centerView.header.toHaveTitle(searchableChannel.displayName);
            await expect(channelsPage.page).toHaveURL(
                new RegExp(`/${team.name}/channels/${searchableChannel.channel.name}$`),
            );
        },
    );

    /**
     * @objective Verify that secure URL channels with special-character names still expose the Calls entry point after direct navigation.
     *
     * @precondition
     * Calls plugin must be installed in the test environment.
     */
    test(
        'shows calls entry point in secure URL channels with special-character names and preserves the obfuscated route',
        {tag: '@secure_urls'},
        async ({pw}) => {
            // # Initialize setup and validate Calls prerequisites
            const {adminUser, adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);

            const pluginStatuses = await adminClient.getPluginStatuses();
            test.skip(
                !pluginStatuses.some((plugin: {plugin_id: string}) => plugin.plugin_id === 'com.mattermost.calls'),
                'Skipping test - Calls plugin is not installed',
            );

            await pw.ensurePluginsLoaded(['com.mattermost.calls']);
            await pw.shouldHaveCallsEnabled();
            await setSecureUrls(adminClient, true);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Create a secure URL channel with a special-character display name
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            const displayName = `Calls & Planning 🚀 ${(await pw.random.id()).slice(0, 6)}`;
            const channel = await createSecureUrlChannel(channelsPage, adminClient, team.name, team.id, displayName);
            await adminClient.addToChannel(adminUser.id, channel.id);

            // * Verify the current secure URL channel shows the Calls entry point
            await channelsPage.centerView.header.toHaveTitle(displayName);
            await expect(channelsPage.centerView.header.callButton).toBeVisible();

            // # Open the secure URL directly as another member
            const {channelsPage: otherChannelsPage} = await pw.testBrowser.login(adminUser);
            await otherChannelsPage.goto(team.name, channel.name);
            await otherChannelsPage.toBeVisible();

            // * Verify direct navigation keeps the obfuscated slug and still exposes Calls
            await otherChannelsPage.centerView.header.toHaveTitle(displayName);
            await expect(otherChannelsPage.page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}$`));
            await expect(otherChannelsPage.centerView.header.callButton).toBeVisible();

            // # Open the Calls entry point from the secure URL channel
            await otherChannelsPage.centerView.header.openCalls();

            // * Verify opening Calls does not break the secure route context
            await otherChannelsPage.centerView.header.toHaveTitle(displayName);
            await expect(otherChannelsPage.page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}`));
        },
    );
});
