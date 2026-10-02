// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

import {assertRootModal, closeRootModal} from '../helpers';

test('should open Root Modal from post actions menu and all submenu items', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message to use as the target post
    await channelsPage.centerView.postCreate.input.fill('Test post for Root Modal validation');
    await channelsPage.centerView.postCreate.sendMessage();

    const post = await channelsPage.centerView.getLastPost();

    // Local helper: hover the post and open the actions (bolt icon) menu via the library
    // NOTE: Plugin actions are in the "actions" (⚡) button, NOT the "..." (more) button
    async function openActionsMenu() {
        await post.hover();
        await post.postMenu.actionsButton.click();
    }

    // Local helper: open the actions menu and click a plugin menu item, retrying the whole
    // open-menu-and-click sequence if the plugin is transiently unavailable (e.g. during a
    // concurrent plugin_crash.spec.ts recovery cycle, the item may not render in the menu at
    // all, which times out the click rather than failing on an existing locator).
    async function clickPluginMenuItem(click: () => Promise<void>) {
        for (let attempt = 0; attempt < 4; attempt++) {
            await openActionsMenu();
            try {
                await click();
                return;
            } catch (err) {
                if (attempt === 3) {
                    throw err;
                }
                await channelsPage.page.keyboard.press('Escape');
            }
        }
    }

    // # Click the top-level "Demo Plugin" action
    await clickPluginMenuItem(() =>
        channelsPage.page.getByRole('button', {name: 'Demo Plugin'}).click({timeout: duration.ten_sec}),
    );

    // * Verify Root Modal opens — top-level action does NOT show "Element clicked in the menu"
    await assertRootModal(channelsPage.page);
    await expect(channelsPage.page.getByText(/Element clicked in the menu:/)).not.toBeVisible();
    await closeRootModal(channelsPage.page);

    // # Click Submenu Example → First Item
    await clickPluginMenuItem(async () => {
        await channelsPage.page.getByRole('button', {name: /Submenu Example/}).hover();
        // Submenu items have role="button" but a broken aria-label — filter by text content
        await channelsPage.page
            .getByRole('button')
            .filter({hasText: 'First Item'})
            .last()
            .click({timeout: duration.ten_sec});
    });

    // * Verify Root Modal opens with "First Item" as the clicked element
    await assertRootModal(channelsPage.page, 'First Item');
    await closeRootModal(channelsPage.page);

    // # Click Submenu Example → Second Item
    await clickPluginMenuItem(async () => {
        await channelsPage.page.getByRole('button', {name: /Submenu Example/}).hover();
        await channelsPage.page
            .getByRole('button')
            .filter({hasText: 'Second Item'})
            .last()
            .click({timeout: duration.ten_sec});
    });

    // * Verify Root Modal opens with "Second Item" as the clicked element
    await assertRootModal(channelsPage.page, 'Second Item');
    await closeRootModal(channelsPage.page);

    // # Click Submenu Example → Third Item
    await clickPluginMenuItem(async () => {
        await channelsPage.page.getByRole('button', {name: /Submenu Example/}).hover();
        await channelsPage.page
            .getByRole('button')
            .filter({hasText: 'Third Item'})
            .last()
            .click({timeout: duration.ten_sec});
    });

    // * Verify Root Modal opens with "Third Item" as the clicked element
    await assertRootModal(channelsPage.page, 'Third Item');
    await closeRootModal(channelsPage.page);
});
