// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../../helpers';

test('should post interactive button and respond with click attribution via /interactive command', async ({pw}) => {
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

    // 4. Send /interactive command
    await channelsPage.centerView.postCreate.input.fill('/interactive');
    await channelsPage.centerView.postCreate.sendMessage();

    // 5. Confirm post appears with 'Test interactive button' and an 'Interactive Button' button
    const interactivePost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'Test interactive button'})
        .last();
    await expect(interactivePost).toBeVisible();
    await expect(interactivePost.getByRole('button', {name: 'Interactive Button'})).toBeVisible();

    // 6. Click the Interactive Button
    await interactivePost.getByRole('button', {name: 'Interactive Button'}).click();

    // 7. Wait for thread reply indicator and open the thread
    await expect(interactivePost.getByRole('button', {name: /1 reply/})).toBeVisible();
    await interactivePost.getByRole('button', {name: /1 reply/}).click();

    // 8. Confirm bot response in the thread panel
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
