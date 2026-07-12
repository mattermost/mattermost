// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createLinkBookmarks} from './support';

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
