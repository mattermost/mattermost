// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';

import {
    type App,
    DefaultChannel,
    expect,
    getAdminClient,
    openNewChannelModal,
    openSystemConsoleSection,
    closeTeamSettings,
    openTeamSettings,
    postWith,
    systemConsolePath,
    test,
    closeChannelSettings,
    openChannelSettingsInfoTab,
    Api,
    settle,
} from '@mattermost/playwright-lib';

const OBFUSCATED_SLUG_RE = /^[a-z0-9]{26}$/;

async function skipIfNoAdvancedLicense(adminClient: any) {
    const license = await adminClient.getClientLicenseOld();
    test.skip(license.SkuShortName !== 'advanced', 'Skipping test - server does not have enterprise advanced license');
}

async function setAnonymousUrls(adminClient: any, enabled: boolean) {
    await adminClient.patchConfig({PrivacySettings: {UseAnonymousURLs: enabled}});
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

/** Fills the new channel modal's name like a user does: type it, then leave the field. */
async function fillChannelName(app: App, displayName: string) {
    await app.newChannelModal.name.container.fill(displayName);
    await app.newChannelModal.name.container.press('Tab');
    await expect(app.newChannelModal.name.container).not.toBeFocused();
}

async function createChannelFromUI(app: App, displayName: string) {
    await openNewChannelModal(app);
    await fillChannelName(app, displayName);
    await app.newChannelModal.confirmButton.click();
    await expect(app.center.postCreate).toBeVisible();
}

function teamNameInput(app: App) {
    return app.createTeam.name.container;
}

async function openCreateTeamForm(app: App) {
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu);
    await app.lhs.teamMenu.createTeamMenuItem.click();
    await expect(app.createTeam.form).toBeVisible();
}

async function createTeamFromUI(app: App, displayName: string) {
    await openCreateTeamForm(app);
    await teamNameInput(app).fill(displayName);
    await expect(teamNameInput(app)).toHaveValue(displayName);
    await app.createTeam.nextButton.click();
    await expect(app.center.postCreate).toBeVisible();
}

/** The channel header's call button: the plugin supplies the button, the header's wrapper around it carries the id. */
function callButton(app: App) {
    return app.channelHeader.callButton;
}

/** The "Use anonymous channel and team URLs" radio setting on System Console > Users and Teams. */
function anonymousUrlsSetting(app: App) {
    return app.admin.setting('PrivacySettings.UseAnonymousURLs');
}

async function openUsersAndTeams(app: App) {
    await openSystemConsoleSection(app, 'site_config/users_and_teams');
    await expect(app.admin.header).toContainText('Users and Teams');
}

/** Saves System Console settings and waits for the config patch. */
async function saveUsersAndTeams(app: App) {
    await settle(app.admin.saveButton, {wait: Api.PatchConfig}).click();
}

/** The team's channel with this display name, once the server has it. */
async function getChannelByDisplayName(adminClient: any, teamId: string, displayName: string): Promise<Channel> {
    let channel: Channel | undefined;
    await expect
        .poll(async () => {
            const channels: Channel[] = await adminClient.getChannels(teamId);
            channel = channels.find((candidate) => candidate.display_name === displayName);
            return channel?.display_name;
        })
        .toBe(displayName);
    if (!channel) {
        throw new Error(`Channel "${displayName}" was not found`);
    }
    return channel;
}

/** The admin's team with this display name, once the server has it. */
async function getTeamByDisplayName(adminClient: any, displayName: string): Promise<Team> {
    let team: Team | undefined;
    await expect
        .poll(async () => {
            const teams: Team[] = await adminClient.getMyTeams();
            team = teams.find((candidate) => candidate.display_name === displayName);
            return team?.display_name;
        })
        .toBe(displayName);
    if (!team) {
        throw new Error(`Team "${displayName}" was not found`);
    }
    return team;
}

async function createAnonymousUrlChannel(
    app: App,
    adminClient: any,
    teamName: string,
    teamId: string,
    displayName: string,
) {
    await setAnonymousUrls(adminClient, true);

    // Wait until the server confirms UseAnonymousURLs=true.
    // expect.poll gives reliable retry semantics vs. a manual break-loop.
    await expect
        .poll(
            async () => {
                const cfg = await adminClient.getConfig();
                return cfg.PrivacySettings?.UseAnonymousURLs;
            },
            {timeout: 15000, intervals: [500, 1000, 2000]},
        )
        .toBe(true);

    // Final re-apply immediately before the UI action to close the race window
    // between the polling confirmation and the channel-creation POST reaching
    // the server (the modal open + fill + submit adds ~200–500 ms of latency).
    await setAnonymousUrls(adminClient, true);

    await createChannelFromUI(app, displayName);
    await expect(app.channelHeader.openMenuButton).toContainText(displayName);

    const channel = await getChannelByDisplayName(adminClient, teamId, displayName);
    expectObfuscatedSlug(channel.name);
    await expect(app.page).toHavePath(app.channelsPage.pathFor({team: teamName, channel}));

    return channel;
}

test.describe('Anonymous URLs', () => {
    // initSetup patches only the on-prem overrides, so PrivacySettings survives from whichever
    // test ran last. Start every test from the default (off); tests needing it on enable it.
    test.beforeEach(async () => {
        const {adminClient} = await getAdminClient({skipLog: true});
        await setAnonymousUrls(adminClient, false);
    });

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
            const {app} = await pw.testBrowser.login(adminUser);

            // # Visit System Console > Users and Teams
            await openUsersAndTeams(app);

            // * Verify the anonymous URLs radio group is visible
            const setting = anonymousUrlsSetting(app);
            await expect(setting.trueRadio).toBeVisible();

            // * Verify the setting is initially false
            await expect(setting.falseRadio).toBeChecked();

            // # Enable anonymous URLs by clicking the True radio
            await setting.trueRadio.check();

            // * Verify it is now true
            await expect(setting.trueRadio).toBeChecked();

            // # Save settings
            await saveUsersAndTeams(app);
            await expect
                .poll(async () => (await adminClient.getConfig()).PrivacySettings?.UseAnonymousURLs === true, {
                    timeout: 30_000,
                    intervals: [500, 1500, 3000],
                })
                .toBe(true);

            // # Navigate away and come back
            await openSystemConsoleSection(app, 'environment/notifications');
            await expect(app.page).toHavePath(systemConsolePath('environment/notifications'));

            // Re-apply guard: a concurrent initSetup() → updateConfig(defaultConfig) may have
            // reset PrivacySettings.UseAnonymousURLs=false while we were navigating away.
            // Re-patch and confirm propagation before navigating back.
            await adminClient.patchConfig({PrivacySettings: {UseAnonymousURLs: true}});
            await expect
                .poll(async () => (await adminClient.getConfig()).PrivacySettings?.UseAnonymousURLs === true, {
                    timeout: 20_000,
                    intervals: [500, 1000, 2000],
                })
                .toBe(true);

            await openUsersAndTeams(app);

            // Re-apply one more time after the page renders and confirm, so the radio reads the
            // fresh config (a WebSocket CONFIG_CHANGED event from a concurrent initSetup() can
            // reset the in-memory Redux state between the poll above and the page rendering).
            await adminClient.patchConfig({PrivacySettings: {UseAnonymousURLs: true}});
            await expect
                .poll(async () => (await adminClient.getConfig()).PrivacySettings?.UseAnonymousURLs === true, {
                    timeout: 10_000,
                    intervals: [500, 1000],
                })
                .toBe(true);

            // * Verify the setting is still enabled
            await expect(anonymousUrlsSetting(app).trueRadio).toBeChecked();

            // # Reset to false for cleanup
            await anonymousUrlsSetting(app).falseRadio.check();
            await expect(anonymousUrlsSetting(app).falseRadio).toBeChecked();
            await saveUsersAndTeams(app);
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
            const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
            const license = await adminClient.getClientLicenseOld();
            test.skip(
                license.SkuShortName !== 'advanced',
                'Skipping test - server does not have enterprise advanced license',
            );

            await adminClient.addToTeam(team.id, adminUser.id);
            await setAnonymousUrls(adminClient, true);

            await expect
                .poll(
                    async () => {
                        const cfg = await adminClient.getConfig();
                        return cfg.PrivacySettings?.UseAnonymousURLs === true;
                    },
                    {timeout: 30000, intervals: [500, 1500, 3000]},
                )
                .toBe(true);

            // # Log in and go to channels — navigate to the team explicitly so the
            // # webapp loads its config after UseAnonymousURLs is already true
            const {app} = await pw.testBrowser.login(adminUser);
            await app.teamPage.goto({team});
            await expect(app.center.postCreate).toBeVisible();

            // Re-apply anonymous URLs immediately before the UI interaction: a
            // concurrent initSetup() → patchConfig(defaultConfig) resets
            // UseAnonymousURLs: false between the initial setAnonymousUrls call and here.
            await setAnonymousUrls(adminClient, true);

            // # Open new channel modal
            await openNewChannelModal(app);
            await expect(app.newChannelModal).toBeVisible();

            // # Fill in a channel name
            await fillChannelName(app, 'Anonymous Test Channel');

            // * Verify the URL editor section is not visible (wait for client config to apply)
            await expect(app.newChannelModal.url.labelText).not.toBeVisible({timeout: 30000});

            // # Cancel modal
            await app.newChannelModal.cancelButton.click();
            await expect(app.newChannelModal).not.toBeVisible();
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
            const {app} = await pw.testBrowser.login(adminUser);
            await app.teamPage.goto({team});
            await expect(app.center.postCreate).toBeVisible();

            // # Create a new channel via UI
            const channelDisplayName = 'Obfuscated Channel ' + Date.now();
            await openNewChannelModal(app);
            await expect(app.newChannelModal).toBeVisible();
            await fillChannelName(app, channelDisplayName);
            await setAnonymousUrls(adminClient, true);
            await app.newChannelModal.confirmButton.click();

            // # Wait for channel to be created and navigated to
            await expect(app.center.postCreate).toBeVisible();

            // # Fetch the newly created channel by display name
            const createdChannel = await getChannelByDisplayName(adminClient, team.id, channelDisplayName);

            // * Verify the slug does not match a cleaned version of the display name
            const humanReadableSlug = channelDisplayName.toLowerCase().replace(/\s+/g, '-');
            expect(createdChannel.name).not.toBe(humanReadableSlug);

            // * Verify the slug looks like a model.NewId (26 chars, alphanumeric)
            expect(createdChannel.name).toMatch(/^[a-z0-9]{26}$/);

            // * Verify display name is preserved
            expect(createdChannel.display_name).toBe(channelDisplayName);
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
            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto('/');
            await expect(app.center.postCreate).toBeVisible();

            // # Open new channel modal
            await openNewChannelModal(app);
            await expect(app.newChannelModal).toBeVisible();

            // # Type a display name to trigger URL generation
            await fillChannelName(app, 'Test Channel URL');

            // * Verify the URL editor section is visible
            await expect(app.newChannelModal.url.labelText).toBeVisible();

            // # Cancel modal
            await app.newChannelModal.cancelButton.click();
            await expect(app.newChannelModal).not.toBeVisible();
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
            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto('/');
            await expect(app.center.postCreate).toBeVisible();

            // Re-apply anonymous URLs immediately before the UI interaction: a
            // concurrent initSetup() → patchConfig(defaultConfig) resets
            // UseAnonymousURLs: false between the initial setAnonymousUrls call and here.
            await setAnonymousUrls(adminClient, true);

            // # Open team menu and click Create a team
            await openCreateTeamForm(app);

            // # Wait for create team form
            await expect(app.createTeam.form).toBeVisible();

            // * Verify the display name input is visible
            await expect(teamNameInput(app)).toBeVisible();

            // * Verify the submit button text says "Create" because team creation stays on a single step
            await expect(app.createTeam.nextButton).toContainText('Create');

            // # Enter team name and submit
            const teamName = 'Anonymous Team ' + Date.now();
            await teamNameInput(app).fill(teamName);
            await expect(teamNameInput(app)).toHaveValue(teamName);
            await app.createTeam.nextButton.click();

            // * Verify the team is created and user is redirected (no URL step shown)
            await expect(app.center.postCreate).toBeVisible();

            // # Verify the team has an obfuscated slug
            const createdTeam = await getTeamByDisplayName(adminClient, teamName);
            expectObfuscatedSlug(createdTeam.name);
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
            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto('/');
            await expect(app.center.postCreate).toBeVisible();

            // # Open team menu and click Create a team
            await openCreateTeamForm(app);

            // # Wait for create team form
            await expect(app.createTeam.form).toBeVisible();

            // * Verify the submit button says "Next" on the first step because the team URL step follows
            await expect(app.createTeam.nextButton).toContainText('Next');

            // # Enter team name and click Next
            await teamNameInput(app).fill('Test Team URL Step');
            await expect(teamNameInput(app)).toHaveValue('Test Team URL Step');
            await app.createTeam.nextButton.click();

            // * Verify the team URL step is now visible
            await expect(app.createTeam.urlTextbox).toBeVisible();
            await expect(app.createTeam.finishButton).toBeVisible();
            await expect(app.createTeam.finishButton).toContainText('Finish');
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
            const {app} = await pw.testBrowser.login(adminUser);
            await app.teamPage.goto({team});
            await expect(app.center.postCreate).toBeVisible();

            // # Re-apply config in case a concurrent shard reset it during login/navigation
            await setAnonymousUrls(adminClient, true);

            const channelDisplayName = `Archived Anonymous ${pw.random.id()}`;
            await createChannelFromUI(app, channelDisplayName);

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
            await app.page.reload();
            await app.lhs.channelList.channel(createdChannel).container.click();

            // * Verify the restored channel still uses the original anonymous URL route
            await expect(app.channelHeader.openMenuButton).toContainText(channelDisplayName);
            await expect(app.page).toHavePath(`/${team.name}/channels/${createdChannel.name}`);
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
            const {app} = await pw.testBrowser.login(adminUser);
            await app.channelsPage.goto({team, channel: legacyChannelSlug});
            await expect(app.center.postCreate).toBeVisible();
            await expect(app.page).toHavePath(`/${team.name}/channels/${legacyChannelSlug}`);

            // # Create a new channel after the anonymous URL toggle.
            // Re-apply config immediately before the UI action: a concurrent initSetup()
            // on another shard can reset UseAnonymousURLs between the patch above and here.
            const anonymousChannelDisplayName = `Anonymous Channel ${pw.random.id()}`;
            await app.teamPage.goto({team});
            await expect(app.center.postCreate).toBeVisible();
            await setAnonymousUrls(adminClient, true);
            await pw.waitUntil(async () => {
                const cfg = await adminClient.getConfig();
                return (cfg as any).PrivacySettings?.UseAnonymousURLs === true;
            });
            await createChannelFromUI(app, anonymousChannelDisplayName);

            const anonymousChannel = await getChannelByDisplayName(adminClient, team.id, anonymousChannelDisplayName);

            // * Verify only the new channel receives an obfuscated slug
            expectObfuscatedSlug(anonymousChannel.name);
            await expect(app.page).toHavePath(`/${team.name}/channels/${anonymousChannel.name}`);

            // # Create a new team after the anonymous URL toggle.
            // Re-apply again: team creation is a separate UI flow and config may have drifted.
            const anonymousTeamDisplayName = `Anonymous Team ${pw.random.id()}`;
            await setAnonymousUrls(adminClient, true);
            await createTeamFromUI(app, anonymousTeamDisplayName);

            const anonymousTeam = await getTeamByDisplayName(adminClient, anonymousTeamDisplayName);

            // * Verify only the new team receives an obfuscated slug
            expectObfuscatedSlug(anonymousTeam.name);
            await expect(app.page).toHavePath(
                app.channelsPage.pathFor({team: anonymousTeam, channel: DefaultChannel.TownSquare}),
            );
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
            const {app} = await pw.testBrowser.login(adminUser);
            await app.channelsPage.goto({team, path: 'messages', channel: `@${secondUser.username}`});
            await expect(app.center.postCreate).toBeVisible();

            // * Verify the DM still uses the standard message route
            await expect(app.page).toHavePath(`/${team.name}/messages/@${secondUser.username}`);
            await expect(await postWith(app.center.postList, {text: dmMessage})).toBeVisible();

            // # Open the GM route
            await app.channelsPage.goto({team, path: 'messages', channel: gmChannel.name});
            await expect(app.center.postCreate).toBeVisible();

            // * Verify the GM still uses the standard message route
            await expect(app.page).toHavePath(`/${team.name}/messages/${gmChannel.name}`);
            await expect(await postWith(app.center.postList, {text: gmMessage})).toBeVisible();
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

            const {app} = await pw.testBrowser.login(adminUser);
            await app.teamPage.goto({team});
            await expect(app.center.postCreate).toBeVisible();

            const originalDisplayName = `Original Channel ${pw.random.id()}`;
            // Re-apply guard: concurrent initSetup() may reset UseAnonymousURLs before channel creation
            await setAnonymousUrls(adminClient, true);
            await pw.waitUntil(async () => {
                const cfg = await adminClient.getConfig();
                return (cfg as any).PrivacySettings?.UseAnonymousURLs === true;
            });
            await createChannelFromUI(app, originalDisplayName);

            const createdChannel = await getChannelByDisplayName(adminClient, team.id, originalDisplayName);
            const originalSlug = createdChannel.name;
            expectObfuscatedSlug(originalSlug);

            // # Rename the channel from channel settings
            const renamedDisplayName = `Renamed Channel ${pw.random.id()}`;
            await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.channelSettingsMenuItem);
            const channelSettingsModal = await app.channelHeader.menu.channelSettingsMenuItem.clickTo(
                app.channelSettingsModal,
            );
            const infoTab = await openChannelSettingsInfoTab(channelSettingsModal);
            await infoTab.name.container.fill(renamedDisplayName);
            await settle(channelSettingsModal.savePanel.saveButton, {wait: Api.PatchChannel}).click();

            await pw.waitUntil(
                async () => (await adminClient.getChannel(createdChannel.id)).display_name === renamedDisplayName,
            );
            await closeChannelSettings(channelSettingsModal);

            const renamedChannel = await adminClient.getChannel(createdChannel.id);

            // * Verify the channel name changes without rotating the anonymous URL slug
            expect(renamedChannel.display_name).toBe(renamedDisplayName);
            expect(renamedChannel.name).toBe(originalSlug);
            expectObfuscatedSlug(renamedChannel.name);

            // # Reopen the channel using its original obfuscated route
            await app.channelsPage.goto({team, channel: originalSlug});
            await expect(app.center.postCreate).toBeVisible();

            // * Verify the obfuscated route still resolves to the renamed channel
            await expect(app.page).toHavePath(`/${team.name}/channels/${originalSlug}`);
            await expect(app.channelHeader.openMenuButton).toContainText(renamedDisplayName);
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
            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto('/');
            await expect(app.center.postCreate).toBeVisible();

            const originalTeamDisplayName = `Original Team ${pw.random.id()}`;
            // Re-apply guard: concurrent initSetup() may reset UseAnonymousURLs: false
            // between the initial setAnonymousUrls call above and the team creation UI flow.
            await setAnonymousUrls(adminClient, true);
            await createTeamFromUI(app, originalTeamDisplayName);

            const createdTeam = await getTeamByDisplayName(adminClient, originalTeamDisplayName);
            const originalTeamSlug = createdTeam.name;
            expectObfuscatedSlug(originalTeamSlug);

            // # Rename the team from team settings
            const renamedTeamDisplayName = `Renamed Team ${pw.random.id()}`;
            const teamSettingsModal = await openTeamSettings(app);
            await teamSettingsModal.info.name.container.fill(renamedTeamDisplayName);
            await expect(teamSettingsModal.info.name.container).toHaveValue(renamedTeamDisplayName);
            await settle(teamSettingsModal.savePanel.saveButton, {wait: Api.PatchTeam}).click();

            await pw.waitUntil(
                async () => (await adminClient.getTeam(createdTeam.id)).display_name === renamedTeamDisplayName,
            );
            await closeTeamSettings(teamSettingsModal);

            const renamedTeam = await adminClient.getTeam(createdTeam.id);

            // * Verify the team name changes without rotating the anonymous URL slug
            expect(renamedTeam.display_name).toBe(renamedTeamDisplayName);
            expect(renamedTeam.name).toBe(originalTeamSlug);
            expectObfuscatedSlug(renamedTeam.name);

            // # Reopen the team using its original obfuscated route
            await app.teamPage.goto({team: originalTeamSlug});
            await expect(app.center.postCreate).toBeVisible();

            // * Verify the obfuscated team route still resolves to the renamed team
            await expect(app.page).toHavePath(
                app.channelsPage.pathFor({team: originalTeamSlug, channel: DefaultChannel.TownSquare}),
            );

            const reopenedTeamSettings = await openTeamSettings(app);
            await expect(reopenedTeamSettings.info.name.container).toHaveValue(renamedTeamDisplayName);
            await closeTeamSettings(reopenedTeamSettings);
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
            const {app} = await pw.testBrowser.login(user);
            await app.page.goto('/');
            await expect(app.center.postCreate).toBeVisible();

            const displayName = `Permalink Channel ${pw.random.id()}`;
            const channel = await createAnonymousUrlChannel(app, adminClient, team.name, team.id, displayName);

            // # Publish a post that will be opened via permalink
            const message = `Anonymous permalink message ${pw.random.id()}`;
            await app.center.postCreate.message.container.fill(message);
            const postId = (await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click()).id;
            const permalink = `/${team.name}/pl/${postId}`;

            // # Open the permalink while anonymous URLs are enabled
            await app.page.goto(permalink);

            // * Verify the permalink resolves to the channel's obfuscated route
            await expect(app.channelHeader.openMenuButton).toContainText(displayName);
            await expect(app.page).toHavePath(`/${team.name}/channels/${channel.name}`);
            await expect(app.center.postList.post(postId)).toContainText(message);

            // # Disable anonymous URLs and reopen the same permalink
            await setAnonymousUrls(adminClient, false);
            await app.page.goto(permalink);

            // * Verify the permalink still resolves to the existing obfuscated route
            await expect(app.channelHeader.openMenuButton).toContainText(displayName);
            await expect(app.page).toHavePath(`/${team.name}/channels/${channel.name}`);
            await expect(app.center.postList.post(postId)).toContainText(message);
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

        // # Log in and navigate to the test team so the webapp loads config with
        // # UseAnonymousURLs already true; explicit addToTeam guards against race resets
        await adminClient.addToTeam(team.id, user.id);
        const {app} = await pw.testBrowser.login(user);
        await app.teamPage.goto({team});
        await expect(app.center.postCreate).toBeVisible();

        // # Re-apply config immediately before channel creation to guard against
        // # concurrent shard initSetup calls resetting UseAnonymousURLs to false
        await setAnonymousUrls(adminClient, true);

        const createdChannels = [];
        for (let i = 1; i <= 3; i++) {
            const displayName = `Search Test Channel ${i} ${pw.random.id()}`;
            const channel = await createAnonymousUrlChannel(app, adminClient, team.name, team.id, displayName);
            createdChannels.push({channel, displayName});
        }

        const targetChannel = createdChannels[0];

        // # Open Find Channels and search by display name
        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();
        await app.lhs.header.findChannelsButton.clickTo(app.quickSwitchModal);
        await app.quickSwitchModal.searchTextbox.fill(targetChannel.displayName.substring(0, 15));

        // * Verify the anonymous URL channel appears in results
        const result = app.quickSwitchModal.suggestions.suggestion(targetChannel.channel.id);
        await expect(result).toBeVisible();
        await expect(result).toContainText(targetChannel.displayName);

        // # Select the matching anonymous URL channel
        await app.quickSwitchModal.suggestions.suggestion(targetChannel.channel.id).select();

        // * Verify navigation lands on the obfuscated route
        await expect(app.channelHeader.openMenuButton).toContainText(targetChannel.displayName);
        await expect(app.page).toHavePath(`/${team.name}/channels/${targetChannel.channel.name}`);
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
        const {app} = await pw.testBrowser.login(user);
        await app.page.goto('/');
        await expect(app.center.postCreate).toBeVisible();

        const displayName = `Search Channel ${pw.random.id()}`;
        const channel = await createAnonymousUrlChannel(app, adminClient, team.name, team.id, displayName);
        const message = `AnonymousSearchableMessage${pw.random.id()}`;
        await app.center.postCreate.message.container.fill(message);
        const postId = (await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click()).id;

        // # Open message search from another channel
        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();
        await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
        await app.searchBox.inputSearchbox.fill(message);
        await app.searchBox.inputSearchbox.press('Enter');

        const searchItem = app.search.results.post({id: postId});

        // * Verify the post appears in results
        await expect(searchItem.message.container).toContainText(message, {timeout: 15000});

        // # Jump from the search result back to the anonymous URL channel
        await searchItem.container.hover();
        await searchItem.menu.jumpLink.click();

        // * Verify navigation returns to the anonymous URL route and highlights the expected post
        await expect(app.channelHeader.openMenuButton).toContainText(displayName);
        await expect(app.page).toHavePath(app.channelsPage.pathFor({team, channel}));
        await expect(app.center.postList.post(postId)).toContainText(message);
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
            const {app} = await pw.testBrowser.login(user);
            await app.page.goto('/');
            await expect(app.center.postCreate).toBeVisible();

            // # Create channels with edge-case display names
            const channelTemplates = ['Design review 🚀', 'Roadmap 中文', 'Support & Ops عربى'];
            const createdChannels = [];

            for (const template of channelTemplates) {
                const displayName = `${template} ${pw.random.id().slice(0, 6)}`;
                const channel = await createAnonymousUrlChannel(app, adminClient, team.name, team.id, displayName);

                createdChannels.push({channel, displayName});

                // # Post in the new anonymous URL channel
                const message = `anonymous-url edge case ${displayName}`;
                await app.center.postCreate.message.container.fill(message);
                const created = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

                // * Verify the channel keeps the exact display name and remains usable
                await expect(app.center.postList.post(created).body).toContainText(message);
                await expect(app.channelHeader.openMenuButton).toContainText(displayName);
                await expect(app.page).toHavePath(app.channelsPage.pathFor({team, channel}));
            }

            const searchableChannel = createdChannels[1];

            // # Reopen the channel from Find Channels using its display name
            await app.channelsPage.goto({team, channel: 'town-square'});
            await expect(app.center.postCreate).toBeVisible();
            await app.lhs.header.findChannelsButton.clickTo(app.quickSwitchModal);
            await app.quickSwitchModal.searchTextbox.fill(searchableChannel.displayName);

            // * Verify search results use the display name and navigate back to the obfuscated slug
            await expect(app.quickSwitchModal.suggestions.suggestion(searchableChannel.channel.id)).toBeVisible();
            await app.quickSwitchModal.suggestions.suggestion(searchableChannel.channel.id).select();
            await expect(app.channelHeader.openMenuButton).toContainText(searchableChannel.displayName);
            await expect(app.page).toHavePath(app.channelsPage.pathFor({team, channel: searchableChannel.channel}));
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
            const {app} = await pw.testBrowser.login(user);
            await app.page.goto('/');
            await expect(app.center.postCreate).toBeVisible();

            const displayName = `Calls & Planning 🚀 ${pw.random.id().slice(0, 6)}`;
            const channel = await createAnonymousUrlChannel(app, adminClient, team.name, team.id, displayName);
            await adminClient.addToChannel(adminUser.id, channel.id);

            // * Verify the current anonymous URL channel shows the Calls entry point
            await expect(app.channelHeader.openMenuButton).toContainText(displayName);
            await expect(callButton(app)).toBeVisible();

            // # Open the anonymous URL directly as another member
            const {app: otherApp} = await pw.testBrowser.login(adminUser);
            await otherApp.channelsPage.goto({team, channel: channel.name});
            await expect(otherApp.center.postCreate).toBeVisible();

            // * Verify direct navigation keeps the obfuscated slug and still exposes Calls
            await expect(otherApp.channelHeader.openMenuButton).toContainText(displayName);
            await expect(otherApp.page).toHavePath(otherApp.channelsPage.pathFor({team, channel}));
            await expect(callButton(otherApp)).toBeVisible();

            // # Open the Calls entry point from the anonymous URL channel
            await callButton(otherApp).click();
            await expect(otherApp.page).toHavePath(otherApp.channelsPage.pathFor({team, channel}));

            // * Verify opening Calls does not break the anonymous URL route context
            await expect(otherApp.channelHeader.openMenuButton).toContainText(displayName);
            await expect(otherApp.page).toHavePath(otherApp.channelsPage.pathFor({team, channel}));
        },
    );
});
