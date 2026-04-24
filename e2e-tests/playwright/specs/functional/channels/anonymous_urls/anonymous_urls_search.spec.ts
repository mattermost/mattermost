// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createAnonymousUrlChannel, setAnonymousUrls, skipIfNoAdvancedLicense} from './support';

test.describe('Anonymous URLs', () => {
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
});
