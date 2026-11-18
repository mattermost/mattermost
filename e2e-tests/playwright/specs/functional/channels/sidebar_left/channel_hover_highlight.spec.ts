// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

function backgroundColor(item: Locator): Promise<string> {
    return item.evaluate((el) => window.getComputedStyle(el).backgroundColor);
}

/**
 * @objective Verify that hovering different channel types (public channel and direct message) in the
 * sidebar highlights them by changing their background.
 */
test(
    'MM-T842 highlights public channel and direct message items on hover',
    {tag: '@channels_sidebar'},
    async ({pw}) => {
        const {adminClient, adminUser, team, user, townSquare} = await pw.initSetup();

        // # Create a public channel the user is a member of but is not currently viewing
        const publicChannel = await adminClient.createPublicChannel(team.id, `Highlight ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, publicChannel.id);

        // # Create a direct message and post to it so it appears in the sidebar
        const dmChannel = await adminClient.createDirectChannel([adminUser.id, user.id]);
        await adminClient.createPost({channel_id: dmChannel.id, message: 'hi there'});

        // # Log in and view Town Square so the other items are not the active channel
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        for (const channel of [publicChannel, dmChannel]) {
            // * The item's background changes on hover
            const item = app.lhs.channelList.channel(channel).locator;
            await expect(item).toBeVisible();
            const before = await backgroundColor(item);
            await item.hover();
            await expect.poll(() => backgroundColor(item)).not.toBe(before);
        }
    },
);
