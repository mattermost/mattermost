// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const OBFUSCATED_SLUG_RE = /^[a-z0-9]{26}$/;

async function skipIfNoAdvancedLicense(adminClient: any) {
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have enterprise advanced license');
}

async function setAnonymousUrls(adminClient: any, enabled: boolean) {
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

async function createAnonymousUrlChannel(
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

test.describe('Anonymous URLs', () => {
    /**
     * @objective Verify that the anonymous URLs setting can be toggled on from System Console and persists after navigation
     *
     * @precondition
     * Server must have an Enterprise Advanced license
     */
    test(
        'enables anonymous URLs setting from System Console and verifies it persists',
        {tag: '@anonymous_urls'},
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

            // * Verify the anonymous URLs radio group is visible
            await systemConsolePage.usersAndTeams.useAnonymousURLs.toBeVisible();

            // * Verify the setting is initially false
            await systemConsolePage.usersAndTeams.useAnonymousURLs.toBeFalse();

            // # Enable anonymous URLs by clicking the True radio
            await systemConsolePage.usersAndTeams.useAnonymousURLs.selectTrue();

            // * Verify it is now true
            await systemConsolePage.usersAndTeams.useAnonymousURLs.toBeTrue();

            // # Save settings
            await systemConsolePage.usersAndTeams.save();
            await pw.waitUntil(async () => (await systemConsolePage.usersAndTeams.saveButton.textContent()) === 'Save');

            // # Navigate away and come back
            await systemConsolePage.sidebar.siteConfiguration.notifications.click();
            await systemConsolePage.notifications.toBeVisible();

            await systemConsolePage.sidebar.siteConfiguration.usersAndTeams.click();
            await systemConsolePage.usersAndTeams.toBeVisible();

            // * Verify the setting is still enabled
            await systemConsolePage.usersAndTeams.useAnonymousURLs.toBeTrue();

            // # Reset to false for cleanup
            await systemConsolePage.usersAndTeams.useAnonymousURLs.selectFalse();
            await systemConsolePage.usersAndTeams.save();
            await pw.waitUntil(async () => (await systemConsolePage.usersAndTeams.saveButton.textContent()) === 'Save');
        },
    );

    /**
     * @objective Verify that the channel URL editor is hidden when creating a new channel with anonymous URLs enabled
     *
     * @precondition
     * Server must have an Enterprise Advanced license
     */
    test(
        'hides channel URL editor when creating new channel with anonymous URLs enabled',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup and configure anonymous URLs
            const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
            const license = await adminClient.getClientLicenseOld();
            test.skip(
                license.SkuShortName !== 'advanced',
                'Skipping test - server does not have enterprise advanced license',
            );

            await setAnonymousUrls(adminClient, true);

            // # Log in and go to channels
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            // # Open new channel modal
            await channelsPage.sidebarLeft.browseOrCreateChannelButton.click();
            await channelsPage.page.locator('#createNewChannelMenuItem').click();
            await channelsPage.newChannelModal.toBeVisible();

            // # Fill in a channel name
            await channelsPage.newChannelModal.fillDisplayName('Anonymous Test Channel');

            // * Verify the URL editor section is not visible
            await expect(channelsPage.newChannelModal.urlSection).not.toBeVisible();

            // # Cancel modal
            await channelsPage.newChannelModal.cancel();
        },
    );

    /**
     * @objective Verify that a channel created with anonymous URLs enabled has an obfuscated slug that does not match the display name
     *
     * @precondition
     * Server must have an Enterprise Advanced license
     */
    test(
        'creates channel with obfuscated URL slug when anonymous URLs enabled',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            const license = await adminClient.getClientLicenseOld();
            test.skip(
                license.SkuShortName !== 'advanced',
                'Skipping test - server does not have enterprise advanced license',
            );

            await setAnonymousUrls(adminClient, true);

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
        },
    );

    /**
     * @objective Verify that the channel URL editor is visible when creating a new channel with anonymous URLs disabled (default)
     */
    test(
        'shows channel URL editor when creating new channel with anonymous URLs disabled',
        {tag: '@anonymous_urls'},
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
     * @objective Verify that the team URL step is skipped when creating a team with anonymous URLs enabled and the team is created directly after entering display name
     *
     * @precondition
     * Server must have an Enterprise Advanced license
     */
    test(
        'skips team URL step when creating team with anonymous URLs enabled',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup
            const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
            const license = await adminClient.getClientLicenseOld();
            test.skip(
                license.SkuShortName !== 'advanced',
                'Skipping test - server does not have enterprise advanced license',
            );

            await setAnonymousUrls(adminClient, true);

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

            // * Verify the submit button text says "Create" because team creation stays on a single step
            await expect(channelsPage.createTeamForm.teamNameSubmitButton).toContainText('Create');

            // # Enter team name and submit
            const teamName = 'Anonymous Team ' + Date.now();
            await channelsPage.createTeamForm.fillTeamName(teamName);
            await channelsPage.createTeamForm.submitDisplayName();

            // * Verify the team is created and user is redirected (no URL step shown)
            await channelsPage.toBeVisible();

            // # Verify the team has an obfuscated slug
            const teams = await adminClient.getMyTeams();
            const createdTeam = teams.find((t) => t.display_name === teamName);
            expect(createdTeam).toBeDefined();
            expect(createdTeam!.name).toMatch(/^[a-z0-9]{26}$/);
        },
    );

    /**
     * @objective Verify that the team URL step is shown when creating a team with anonymous URLs disabled (default)
     */
    test(
        'shows team URL step when creating team with anonymous URLs disabled',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
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

            // * Verify the submit button says "Next" on the first step because the team URL step follows
            await expect(channelsPage.createTeamForm.teamNameSubmitButton).toContainText('Next');

            // # Enter team name and click Next
            await channelsPage.createTeamForm.fillTeamName('Test Team URL Step');
            await channelsPage.createTeamForm.submitDisplayName();

            // * Verify the team URL step is now visible
            await expect(channelsPage.createTeamForm.teamURLInput).toBeVisible();
            await expect(channelsPage.createTeamForm.teamURLSubmitButton).toBeVisible();
            await expect(channelsPage.createTeamForm.teamURLSubmitButton).toContainText('Finish');
        },
    );

    /**
     * @objective Verify that an archived channel created with anonymous URLs keeps its obfuscated route and becomes usable again after unarchiving.
     */
    test(
        'preserves archived anonymous channel routes and restores channel access after unarchive',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup and enable anonymous URLs
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await setAnonymousUrls(adminClient, true);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Log in as admin and create a channel with an obfuscated slug
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const channelDisplayName = `Archived Anonymous ${pw.random.id()}`;
            await createChannelFromUI(channelsPage, channelDisplayName);

            const createdChannel = await getChannelByDisplayName(adminClient, team.id, channelDisplayName);
            expectObfuscatedSlug(createdChannel.name);

            // # Archive the channel and preserve the anonymous URL slug
            await adminClient.deleteChannel(createdChannel.id);
            const archivedChannel = await adminClient.getChannel(createdChannel.id);

            // * Verify archiving does not rotate the anonymous URL route slug
            expect(archivedChannel.name).toBe(createdChannel.name);

            // # Restore the archived channel and verify the anonymous URL slug is preserved
            const restoredChannel = await adminClient.unarchiveChannel(createdChannel.id);
            expect(restoredChannel.name).toBe(createdChannel.name);

            // # Open the restored channel again from the sidebar
            await channelsPage.page.reload();
            await channelsPage.sidebarLeft.goToItem(createdChannel.name);

            // * Verify the restored channel still uses the original anonymous URL route
            await channelsPage.centerView.header.toHaveTitle(channelDisplayName);
            await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${createdChannel.name}`);
        },
    );

    /**
     * @objective Verify that enabling anonymous URLs does not rewrite existing readable slugs and only affects channels and teams created afterward.
     */
    test(
        'keeps existing readable routes unchanged and obfuscates only newly created channels and teams',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup with anonymous URLs disabled by default
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Create a legacy channel and team before enabling anonymous URLs
            const legacyChannelSlug = `legacy-channel-${pw.random.id()}`;
            const legacyChannelDisplayName = `Legacy Channel ${pw.random.id()}`;
            const legacyChannel = await adminClient.createChannel({
                team_id: team.id,
                name: legacyChannelSlug,
                display_name: legacyChannelDisplayName,
                type: 'O',
            });

            const legacyTeamSlug = `legacy-team-${pw.random.id()}`;
            const legacyTeamDisplayName = `Legacy Team ${pw.random.id()}`;
            const legacyTeam = await adminClient.createTeam({
                name: legacyTeamSlug,
                display_name: legacyTeamDisplayName,
                type: 'O',
            } as any);

            expectReadableSlug(legacyChannel.name, legacyChannelSlug);
            expectReadableSlug(legacyTeam.name, legacyTeamSlug);

            // # Enable anonymous URLs after the legacy channel and team already exist
            await setAnonymousUrls(adminClient, true);

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

            // # Create a new channel after the anonymous URL toggle
            const anonymousChannelDisplayName = `Anonymous Channel ${pw.random.id()}`;
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();
            await createChannelFromUI(channelsPage, anonymousChannelDisplayName);

            const anonymousChannel = await getChannelByDisplayName(adminClient, team.id, anonymousChannelDisplayName);

            // * Verify only the new channel receives an obfuscated slug
            expectObfuscatedSlug(anonymousChannel.name);
            await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${anonymousChannel.name}`);

            // # Create a new team after the anonymous URL toggle
            const anonymousTeamDisplayName = `Anonymous Team ${pw.random.id()}`;
            await createTeamFromUI(channelsPage, anonymousTeamDisplayName);

            const anonymousTeam = await getTeamByDisplayName(adminClient, anonymousTeamDisplayName);

            // * Verify only the new team receives an obfuscated slug
            expectObfuscatedSlug(anonymousTeam.name);
            await expect(channelsPage.page).toHaveURL(new RegExp(`/${anonymousTeam.name}/`));
        },
    );

    /**
     * @objective Verify that direct and group messages continue using message routes and are excluded from anonymous URL slug obfuscation.
     */
    test(
        'keeps direct and group message routes readable when anonymous URLs are enabled',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup, create message participants, and enable anonymous URLs
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await setAnonymousUrls(adminClient, true);
            await adminClient.addToTeam(team.id, adminUser.id);

            const secondUser = await pw.createNewUserProfile(adminClient, {prefix: 'anonymousurlsdm'});
            const thirdUser = await pw.createNewUserProfile(adminClient, {prefix: 'anonymousurlsgm'});
            await adminClient.addToTeam(team.id, secondUser.id);
            await adminClient.addToTeam(team.id, thirdUser.id);

            const dmChannel = await adminClient.createDirectChannel([adminUser.id, secondUser.id]);
            const gmChannel = await adminClient.createGroupChannel([adminUser.id, secondUser.id, thirdUser.id]);

            const dmMessage = `Anonymous URL DM ${pw.random.id()}`;
            const gmMessage = `Anonymous URL GM ${pw.random.id()}`;
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
     * @objective Verify that renaming an anonymous URL channel changes the display name without rewriting its obfuscated channel slug.
     */
    test(
        'renames an anonymous URL channel without changing its obfuscated route',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup and create an anonymous URL channel
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await setAnonymousUrls(adminClient, true);
            await adminClient.addToTeam(team.id, adminUser.id);

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const originalDisplayName = `Original Channel ${pw.random.id()}`;
            await createChannelFromUI(channelsPage, originalDisplayName);

            const createdChannel = await getChannelByDisplayName(adminClient, team.id, originalDisplayName);
            const originalSlug = createdChannel.name;
            expectObfuscatedSlug(originalSlug);

            // # Rename the channel from channel settings
            const renamedDisplayName = `Renamed Channel ${pw.random.id()}`;
            const channelSettingsModal = await channelsPage.openChannelSettings();
            const infoTab = await channelSettingsModal.openInfoTab();
            await infoTab.updateName(renamedDisplayName);
            await channelSettingsModal.save();

            await pw.waitUntil(
                async () => (await adminClient.getChannel(createdChannel.id)).display_name === renamedDisplayName,
            );
            await channelSettingsModal.close();

            const renamedChannel = await adminClient.getChannel(createdChannel.id);

            // * Verify the channel name changes without rotating the anonymous URL slug
            expect(renamedChannel.display_name).toBe(renamedDisplayName);
            expect(renamedChannel.name).toBe(originalSlug);
            expectObfuscatedSlug(renamedChannel.name);

            // # Reopen the channel using its original obfuscated route
            await channelsPage.goto(team.name, originalSlug);
            await channelsPage.toBeVisible();

            // * Verify the obfuscated route still resolves to the renamed channel
            await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${originalSlug}`);
            await channelsPage.centerView.header.toHaveTitle(renamedDisplayName);
        },
    );

    /**
     * @objective Verify that renaming an anonymous URL team changes the display name without rewriting its obfuscated team slug.
     */
    test(
        'renames an anonymous URL team without changing its obfuscated route',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup and enable anonymous URLs
            const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await setAnonymousUrls(adminClient, true);

            // # Log in as admin and create a team with an obfuscated slug
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            const originalTeamDisplayName = `Original Team ${pw.random.id()}`;
            await createTeamFromUI(channelsPage, originalTeamDisplayName);

            const createdTeam = await getTeamByDisplayName(adminClient, originalTeamDisplayName);
            const originalTeamSlug = createdTeam.name;
            expectObfuscatedSlug(originalTeamSlug);

            // # Rename the team from team settings
            const renamedTeamDisplayName = `Renamed Team ${pw.random.id()}`;
            const teamSettingsModal = await channelsPage.openTeamSettings();
            const infoTab = await teamSettingsModal.openInfoTab();
            await infoTab.updateName(renamedTeamDisplayName);
            await teamSettingsModal.save();

            await pw.waitUntil(
                async () => (await adminClient.getTeam(createdTeam.id)).display_name === renamedTeamDisplayName,
            );
            await teamSettingsModal.close();

            const renamedTeam = await adminClient.getTeam(createdTeam.id);

            // * Verify the team name changes without rotating the anonymous URL slug
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
        },
    );

    /**
     * @objective Verify that post permalinks created in anonymous URL channels continue to resolve after the feature is turned off.
     */
    test(
        'opens anonymous channel permalinks before and after disabling anonymous URLs',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup and enable anonymous URLs
            const {adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await setAnonymousUrls(adminClient, true);

            // # Log in and create an anonymous URL channel
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            const displayName = `Permalink Channel ${pw.random.id()}`;
            const channel = await createAnonymousUrlChannel(channelsPage, adminClient, team.name, team.id, displayName);

            // # Publish a post that will be opened via permalink
            const message = `Anonymous permalink message ${pw.random.id()}`;
            await channelsPage.postMessage(message);

            const lastPost = await channelsPage.getLastPost();
            const postId = await lastPost.getId();
            const permalink = `/${team.name}/pl/${postId}`;

            // # Open the permalink while anonymous URLs are enabled
            await channelsPage.page.goto(permalink);

            // * Verify the permalink resolves to the channel's obfuscated route
            await channelsPage.centerView.header.toHaveTitle(displayName);
            await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${channel.name}`);
            await channelsPage.centerView.waitUntilPostWithIdContains(postId, message);

            // # Disable anonymous URLs and reopen the same permalink
            await setAnonymousUrls(adminClient, false);
            await channelsPage.page.goto(permalink);

            // * Verify the permalink still resolves to the existing obfuscated route
            await channelsPage.centerView.header.toHaveTitle(displayName);
            await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${channel.name}`);
            await channelsPage.centerView.waitUntilPostWithIdContains(postId, message);
        },
    );

    /**
     * @objective Verify that channel search finds anonymous URL channels by display name and navigates to their obfuscated routes.
     */
    test('channel search finds channels with obfuscated URLs', {tag: '@anonymous_urls'}, async ({pw}) => {
        // # Initialize setup and enable anonymous URLs
        const {adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoAdvancedLicense(adminClient);
        await setAnonymousUrls(adminClient, true);

        // # Log in and create anonymous URL channels
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const createdChannels = [];
        for (let i = 1; i <= 3; i++) {
            const displayName = `Search Test Channel ${i} ${pw.random.id()}`;
            const channel = await createAnonymousUrlChannel(channelsPage, adminClient, team.name, team.id, displayName);
            createdChannels.push({channel, displayName});
        }

        const targetChannel = createdChannels[0];

        // # Open Find Channels and search by display name
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.sidebarLeft.findChannelButton.click();
        await channelsPage.findChannelsModal.toBeVisible();
        await channelsPage.findChannelsModal.input.fill(targetChannel.displayName.substring(0, 15));

        // * Verify the anonymous URL channel appears in results
        const result = channelsPage.findChannelsModal.getResult(targetChannel.channel.name);
        await expect(result).toBeVisible();
        await expect(result).toContainText(targetChannel.displayName);

        // # Select the matching anonymous URL channel
        await channelsPage.findChannelsModal.selectChannel(targetChannel.channel.name);

        // * Verify navigation lands on the obfuscated route
        await channelsPage.centerView.header.toHaveTitle(targetChannel.displayName);
        await expect(channelsPage.page).toHaveURL(`/${team.name}/channels/${targetChannel.channel.name}`);
    });

    /**
     * @objective Verify that post search results navigate back to the correct anonymous URL channel route.
     */
    test('navigates post search results back to anonymous URL channels', {tag: '@anonymous_urls'}, async ({pw}) => {
        // # Initialize setup and enable anonymous URLs
        const {adminClient, team, user} = await pw.initSetup({withDefaultProfileImage: false});
        await skipIfNoAdvancedLicense(adminClient);
        await setAnonymousUrls(adminClient, true);

        // # Log in and create an anonymous URL channel with a searchable post
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const displayName = `Search Channel ${pw.random.id()}`;
        const channel = await createAnonymousUrlChannel(channelsPage, adminClient, team.name, team.id, displayName);
        const message = `AnonymousSearchableMessage${pw.random.id()}`;
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

        // # Jump from the search result back to the anonymous URL channel
        await searchItem.getByRole('link', {name: 'Jump'}).click();

        // * Verify navigation returns to the anonymous URL route and highlights the expected post
        await channelsPage.centerView.header.toHaveTitle(displayName);
        await expect(channelsPage.page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}`));
        await channelsPage.centerView.waitUntilPostWithIdContains(postId, message);
    });

    /**
     * @objective Verify that anonymous URLs preserve edge-case channel display names while keeping channels discoverable and fully usable.
     */
    test(
        'creates anonymous URL channels from unicode and emoji display names and keeps them discoverable',
        {tag: '@anonymous_urls'},
        async ({pw}) => {
            // # Initialize setup and enable anonymous URLs
            const {user, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            await skipIfNoAdvancedLicense(adminClient);
            await setAnonymousUrls(adminClient, true);

            // # Log in and open the test team
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            // # Create channels with edge-case display names
            const channelTemplates = ['Design review 🚀', 'Roadmap 中文', 'Support & Ops عربى'];
            const createdChannels = [];

            for (const template of channelTemplates) {
                const displayName = `${template} ${pw.random.id().slice(0, 6)}`;
                const channel = await createAnonymousUrlChannel(
                    channelsPage,
                    adminClient,
                    team.name,
                    team.id,
                    displayName,
                );

                createdChannels.push({channel, displayName});

                // # Post in the new anonymous URL channel
                const message = `anonymous-url edge case ${displayName}`;
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
     * @objective Verify that anonymous URL channels with special-character names still expose the Calls entry point after direct navigation.
     *
     * @precondition
     * Calls plugin must be installed in the test environment.
     */
    test(
        'shows calls entry point in anonymous URL channels with special-character names and preserves the obfuscated route',
        {tag: '@anonymous_urls'},
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
            await setAnonymousUrls(adminClient, true);
            await adminClient.addToTeam(team.id, adminUser.id);

            // # Create an anonymous URL channel with a special-character display name
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            const displayName = `Calls & Planning 🚀 ${pw.random.id().slice(0, 6)}`;
            const channel = await createAnonymousUrlChannel(channelsPage, adminClient, team.name, team.id, displayName);
            await adminClient.addToChannel(adminUser.id, channel.id);

            // * Verify the current anonymous URL channel shows the Calls entry point
            await channelsPage.centerView.header.toHaveTitle(displayName);
            await expect(channelsPage.centerView.header.callButton).toBeVisible();

            // # Open the anonymous URL directly as another member
            const {channelsPage: otherChannelsPage} = await pw.testBrowser.login(adminUser);
            await otherChannelsPage.goto(team.name, channel.name);
            await otherChannelsPage.toBeVisible();

            // * Verify direct navigation keeps the obfuscated slug and still exposes Calls
            await otherChannelsPage.centerView.header.toHaveTitle(displayName);
            await expect(otherChannelsPage.page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}$`));
            await expect(otherChannelsPage.centerView.header.callButton).toBeVisible();

            // # Open the Calls entry point from the anonymous URL channel
            await otherChannelsPage.centerView.header.openCalls();

            // * Verify opening Calls does not break the anonymous URL route context
            await otherChannelsPage.centerView.header.toHaveTitle(displayName);
            await expect(otherChannelsPage.page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}`));
        },
    );
});
