// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createAnonymousUrlChannel, setAnonymousUrls, skipIfNoAdvancedLicense} from './support';

test.describe('Anonymous URLs', () => {
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
