// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createLinkBookmark} from './support';

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
