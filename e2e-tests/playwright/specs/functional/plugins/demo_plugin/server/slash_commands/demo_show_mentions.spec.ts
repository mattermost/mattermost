// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../../helpers';

test('should parse user and channel mentions from /show_mentions command text', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 3. Navigate to Town Square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 4. Send /show_mentions with a user mention and a channel mention
    // sysadmin is a stable known user in every PW environment
    await channelsPage.centerView.postCreate.input.fill('/show_mentions @sysadmin ~town-square');
    await channelsPage.centerView.postCreate.sendMessage();

    // 5. Wait for bot response
    const responsePost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'contains the following different mentions'})
        .last();
    await expect(responsePost).toBeVisible();

    // 6. Assert user mentions section
    await expect(responsePost.getByRole('heading', {name: 'Mentions to users in the team'})).toBeVisible();
    await expect(responsePost.getByRole('columnheader', {name: 'User name'})).toBeVisible();
    await expect(responsePost.getByRole('cell', {name: '@sysadmin'})).toBeVisible();

    // 7. Assert channel mentions section
    await expect(responsePost.getByRole('heading', {name: 'Mentions to public channels'})).toBeVisible();
    await expect(responsePost.getByRole('columnheader', {name: 'Channel name'})).toBeVisible();
    await expect(responsePost.getByRole('cell', {name: '~Town Square'})).toBeVisible();

    // 8. Assert ~Town Square is a link pointing to the town-square channel
    await expect(responsePost.getByRole('link', {name: '~Town Square'})).toHaveAttribute(
        'href',
        /\/channels\/town-square$/,
    );
});
