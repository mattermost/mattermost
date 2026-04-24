// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createAnonymousUrlChannel,
    createChannelFromUI,
    createTeamFromUI,
    expectObfuscatedSlug,
    getChannelByDisplayName,
    getTeamByDisplayName,
    setAnonymousUrls,
    skipIfNoAdvancedLicense,
} from './support';

test.describe('Anonymous URLs', () => {
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
});
