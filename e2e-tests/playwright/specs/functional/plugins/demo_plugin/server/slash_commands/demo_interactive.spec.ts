// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand} from '../../helpers';

test('should post interactive button and respond with click attribution via /interactive command', async ({pw}) => {
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

    // # Send /interactive command (retry once on a UI timing miss)
    const interactivePost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'Test interactive button'})
        .last();
    for (let attempt = 0; attempt < 4; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/interactive');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            await expect(interactivePost).toBeVisible({timeout: duration.ten_sec});
            break;
        } catch (err) {
            if (attempt === 3) {
                throw err;
            }
        }
    }

    // * Verify post appears with 'Test interactive button' and an 'Interactive Button' button
    await expect(interactivePost).toBeVisible();
    await expect(interactivePost.getByRole('button', {name: 'Interactive Button'})).toBeVisible();

    // # Click the Interactive Button
    await interactivePost.getByRole('button', {name: 'Interactive Button'}).click();

    // # Wait for thread reply indicator and open the thread
    await expect(interactivePost.getByRole('button', {name: /1 reply/})).toBeVisible();
    await interactivePost.getByRole('button', {name: /1 reply/}).click();

    // * Verify bot response in the thread panel
    const threadPanel = channelsPage.page.getByRole('region', {name: /Thread/});
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
