// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, testConfig} from '@mattermost/playwright-lib';

import {createLinkBookmark, createLinkBookmarks} from './support';

/**
 * @objective Verify the bookmarks bar remains visible and usable with an announcement banner present.
 */
test('MM-T5609 displays the bookmarks bar correctly with an announcement banner', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Banner ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    await createLinkBookmark(userClient, channel.id, 'Mattermost Community', 'https://community.mattermost.com');
    const bannerText = `Announcement ${pw.random.id()}`;

    // # Enable an announcement banner above a channel with a bookmark
    await adminClient.patchConfig({
        AnnouncementSettings: {
            EnableBanner: true,
            BannerText: bannerText,
        },
    } as any);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // * Verify both the announcement and bookmark display correctly
    await expect(page.getByText(bannerText, {exact: true})).toBeVisible();
    await channelsPage.channelBookmarksBar.toBeVisible();
    await expect(channelsPage.channelBookmarksBar.getBookmark('Mattermost Community')).toBeVisible();
});

/**
 * @objective Verify external bookmarks open in a new tab and internal bookmarks navigate within Mattermost.
 */
test('MM-T5611 opens external and internal bookmark links', {tag: '@channels'}, async ({pw}) => {
    // # Create external and internal link bookmarks
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Open ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await createLinkBookmark(userClient, channel.id, 'External site', 'https://example.com');
    await createLinkBookmark(
        userClient,
        channel.id,
        'Town Square',
        new URL(`/${team.name}/channels/town-square`, testConfig.baseURL).toString(),
    );
    await channelsPage.goto(team.name, channel.name);

    // # Open the external bookmark
    const popupPromise = page.waitForEvent('popup');
    await channelsPage.channelBookmarksBar.getBookmark('External site').click();
    const popup = await popupPromise;
    // * Verify it opens externally in a new tab
    await expect.poll(() => popup.url()).toContain('example.com');
    await popup.close();

    // # Open the internal bookmark
    await channelsPage.channelBookmarksBar.getBookmark('Town Square').click();
    // * Verify it navigates to Town Square in Mattermost
    await expect.poll(() => page.url()).toContain(`/${team.name}/channels/town-square`);
});

/**
 * @objective Verify bookmarks beyond the visible bar remain accessible through the overflow menu.
 */
test(
    'MM-T5612 provides overflow access when the bookmarks bar reaches its visible limit',
    {tag: '@channels'},
    async ({pw}) => {
        // # Create enough bookmarks to overflow the visible bar
        const {adminClient, team, user, userClient} = await pw.initSetup();
        const channel = await adminClient.createPublicChannel(team.id, `Overflow ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, channel.id);
        await createLinkBookmarks(userClient, channel.id, 12);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.channelBookmarksBar.toBeVisible();

        // * Verify the overflow control exposes the last bookmark
        const overflowButton = channelsPage.channelBookmarksBar.getOverflowButton();
        await expect(overflowButton).toBeVisible();
        await overflowButton.click();
        await expect(page.getByRole('menuitem', {name: /Bookmark 12/})).toBeVisible();
    },
);
