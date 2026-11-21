// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {centerPostWithText, sendDemoSlashCommand} from '../../helpers';

test('should parse user and channel mentions from /show_mentions command text', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {app} = await pw.testBrowser.login(user);

    // # Navigate to Town Square
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Send /show_mentions
    const responsePost = centerPostWithText(app, 'contains the following different mentions');
    await sendDemoSlashCommand(app, '/show_mentions @sysadmin ~town-square');
    await expect(responsePost).toBeVisible();

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
