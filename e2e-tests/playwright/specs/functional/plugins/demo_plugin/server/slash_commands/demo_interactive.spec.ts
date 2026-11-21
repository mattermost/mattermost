// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {centerPostWithText, sendDemoSlashCommand} from '../../helpers';

test('should post interactive button and respond with click attribution via /interactive command', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {app} = await pw.testBrowser.login(user);

    // # Navigate to Town Square
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Send /interactive command
    const interactivePost = centerPostWithText(app, 'Test interactive button');
    await sendDemoSlashCommand(app, '/interactive');

    // * Verify post appears with 'Test interactive button' and an 'Interactive Button' button
    await expect(interactivePost).toBeVisible();
    await expect(interactivePost.getByRole('button', {name: 'Interactive Button'})).toBeVisible();

    // # Click the Interactive Button
    await interactivePost.getByRole('button', {name: 'Interactive Button'}).click();
    const replyButton = interactivePost.getByRole('button', {name: /\d+ repl(y|ies)/});
    await expect(replyButton).toBeVisible();

    // # Open the thread
    await replyButton.click();

    // * Verify bot response in the thread panel
    const threadPanel = app.page.getByRole('region', {name: /Thread/});
    await expect(threadPanel).toBeVisible();

    // Verify response credits the user who clicked
    await expect(
        threadPanel.locator('p').filter({hasText: `${user.username} clicked an interactive button.`}),
    ).toBeVisible();

    // Verify JSON payload contains expected static fields
    await expect(
        threadPanel.locator('code').filter({hasText: new RegExp(`"user_name"\\s*:\\s*"${user.username}"`)}),
    ).toBeVisible();
    await expect(threadPanel.locator('code').filter({hasText: '"type": "button"'})).toBeVisible();
});
