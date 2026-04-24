// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createChannelFromUI,
    createTeamFromUI,
    expectObfuscatedSlug,
    expectReadableSlug,
    getChannelByDisplayName,
    getTeamByDisplayName,
    setAnonymousUrls,
    skipIfNoAdvancedLicense,
} from './support';

test.describe('Anonymous URLs', () => {
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
});
