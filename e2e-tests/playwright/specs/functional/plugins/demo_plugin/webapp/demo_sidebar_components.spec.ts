// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand} from '../helpers';

test('should show Demo Plugin enabled/disabled status in left sidebar header', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square — slash commands work from any channel
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

    // Local helper: send /demo_plugin <enabled> and wait for the indicator to update
    async function setHooks(enabled: boolean) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill(`/demo_plugin ${enabled}`);
            await channelsPage.centerView.postCreate.sendMessage();
        });
        await expect(hookStatus).toHaveText(enabled ? 'Enabled' : 'Disabled');
    }

    // # Explicitly enable hooks first. A concurrently running instance of this spec
    // (e.g. via --repeat-each) or another worker's spec toggling the same global
    // /demo_plugin hooks state could have left it disabled, so the initial "Enabled"
    // state cannot be assumed as an ambient default.
    await setHooks(true);

    // # Disable hooks
    await setHooks(false);

    // # Re-enable hooks
    await setHooks(true);
});

test('should show demo plugin plug icon at the bottom of the team sidebar', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // * Verify the plug icon is visible in the team sidebar
    // The icon has no accessible name, role, or testid — it is a purely visual,
    // non-interactive element rendered with the fa-plug CSS class.
    // CSS selector is the only viable locator here.
    await expect(channelsPage.page.locator('.fa.fa-plug').first()).toBeVisible();
});

test('should show Demo Plugin Item in Browse or create channels menu and trigger alert with team ID', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Click the "Browse or create channels" button in the channel sidebar header
    await channelsPage.sidebarLeft.browseOrCreateChannelButton.click();

    // * Verify the menu is open and contains the Demo Plugin Item entry
    const menu = channelsPage.page.getByRole('menu', {name: 'Browse or create channels'});
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', {name: 'Demo Plugin Item'})).toBeVisible();

    // # Click "Demo Plugin Item" — triggers a browser alert with the team ID
    const dialogPromise = channelsPage.page.waitForEvent('dialog');
    await menu.getByRole('menuitem', {name: 'Demo Plugin Item'}).click();
    const dialog = await dialogPromise;

    // * Verify alert message contains expected text and dynamic team ID
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toMatch(/^Demo Plugin: Browse menu item clicked! Team ID: [a-z0-9]{26}$/);
    await dialog.accept();
});
