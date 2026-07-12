// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, testConfig} from '@mattermost/playwright-lib';

import {createLinkBookmark} from './support';

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
