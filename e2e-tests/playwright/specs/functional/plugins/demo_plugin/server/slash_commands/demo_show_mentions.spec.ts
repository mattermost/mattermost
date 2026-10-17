// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

test('should parse user and channel mentions from /show_mentions command text', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Navigate to Town Square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Send /show_mentions (retry once on a UI timing miss)
    const responsePost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'contains the following different mentions'})
        .last();
    for (let attempt = 0; attempt < 2; attempt++) {
        await channelsPage.centerView.postCreate.input.fill('/show_mentions @sysadmin ~town-square');
        await channelsPage.centerView.postCreate.sendMessage();
        try {
            await expect(responsePost).toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 1) {
                throw err;
            }
        }
    }

    // * Verify user mentions section
    await expect(responsePost.getByRole('heading', {name: 'Mentions to users in the team'})).toBeVisible();
    await expect(responsePost.getByRole('columnheader', {name: 'User name'})).toBeVisible();
    await expect(responsePost.getByRole('cell', {name: '@sysadmin'})).toBeVisible();

    // * Verify channel mentions section
    await expect(responsePost.getByRole('heading', {name: 'Mentions to public channels'})).toBeVisible();
    await expect(responsePost.getByRole('columnheader', {name: 'Channel name'})).toBeVisible();
    await expect(responsePost.getByRole('cell', {name: '~Town Square'})).toBeVisible();

    // * Verify ~Town Square is a link pointing to the town-square channel
    await expect(responsePost.getByRole('link', {name: '~Town Square'})).toHaveAttribute(
        'href',
        /\/channels\/town-square$/,
    );
});
