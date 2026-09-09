// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../helpers';

test('should show Demo Plugin enabled/disabled status in left sidebar header', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square — slash commands work from any channel
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // The sidebar indicator: a span containing "Demo Plugin:" with a sibling span for the status
    const hookStatus = channelsPage.page
        .locator('span')
        .filter({hasText: 'Demo Plugin:'})
        .locator('..')
        .locator('span')
        .last();

    // 3. Verify initial state — hooks enabled by setupDemoPlugin
    await expect(hookStatus).toHaveText('Enabled');

    // 4. Disable hooks and verify indicator updates
    await channelsPage.centerView.postCreate.input.fill('/demo_plugin false');
    await channelsPage.centerView.postCreate.sendMessage();
    await expect(hookStatus).toHaveText('Disabled');

    // 5. Re-enable hooks and verify indicator restores
    await channelsPage.centerView.postCreate.input.fill('/demo_plugin true');
    await channelsPage.centerView.postCreate.sendMessage();
    await expect(hookStatus).toHaveText('Enabled');
});

test('should show demo plugin plug icon at the bottom of the team sidebar', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Verify the plug icon is visible in the team sidebar
    // The icon has no accessible name, role, or testid — it is a purely visual,
    // non-interactive element rendered with the fa-plug CSS class.
    // CSS selector is the only viable locator here.
    await expect(channelsPage.page.locator('.fa.fa-plug').first()).toBeVisible();
});

test('should show Demo Plugin Item in Browse or create channels menu and trigger alert with team ID', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Click the "Browse or create channels" button in the channel sidebar header
    await channelsPage.sidebarLeft.browseOrCreateChannelButton.click();

    // 4. Verify the menu is open and contains the Demo Plugin Item entry
    const menu = channelsPage.page.getByRole('menu', {name: 'Browse or create channels'});
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', {name: 'Demo Plugin Item'})).toBeVisible();

    // 5. Click "Demo Plugin Item" — triggers a browser alert with the team ID
    const dialogPromise = channelsPage.page.waitForEvent('dialog');
    await menu.getByRole('menuitem', {name: 'Demo Plugin Item'}).click();
    const dialog = await dialogPromise;

    // 6. Assert alert message contains expected text and dynamic team ID
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toMatch(/^Demo Plugin: Browse menu item clicked! Team ID: [a-z0-9]{26}$/);
    await dialog.accept();
});
