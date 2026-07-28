// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the keyboard shortcuts for moving to the previous and next channel in the sidebar
 * switch between channels.
 */
test(
    'MM-T1259 moves to the previous and next channel with the keyboard',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();
        await channelsPage.centerView.header.toHaveTitle('Off-Topic');

        // # Move to the next channel with the keyboard
        await channelsPage.centerView.postCreate.input.focus();
        await page.keyboard.press('Alt+ArrowDown');

        // * Verify the next channel in the sidebar is shown
        await channelsPage.centerView.header.toHaveTitle('Town Square');

        // # Move to the previous channel with the keyboard
        await page.keyboard.press('Alt+ArrowUp');

        // * Verify the original channel is shown again
        await channelsPage.centerView.header.toHaveTitle('Off-Topic');
    },
);

/**
 * @objective Verify Ctrl/Cmd+Shift+K opens the Direct Messages modal, and Escape closes it.
 */
test(
    'MM-T1276 opens the Direct Messages modal with the keyboard shortcut',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Focus the message box and press the Direct Messages shortcut
        await channelsPage.centerView.postCreate.input.focus();
        await page.keyboard.press('ControlOrMeta+Shift+K');

        // * Verify the Direct Messages modal opens
        await channelsPage.directChannelsModal.toBeVisible();

        // # Close the modal with Escape
        await page.keyboard.press('Escape');

        // * Verify the Direct Messages modal closes
        await expect(channelsPage.directChannelsModal.container).not.toBeVisible();
    },
);

/**
 * @objective Verify Ctrl/Cmd+Shift+F opens the search box prefilled with the current channel filter.
 *
 * MM-T4872 covers the same behavior as MM-T1435 and is covered by this test.
 */
test(
    'MM-T1435 MM-T4872 prefills the search box with the channel filter using the keyboard shortcut',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        // # Focus the message box and press the in-channel search shortcut
        await channelsPage.centerView.postCreate.input.focus();
        await page.keyboard.press('ControlOrMeta+Shift+F');

        // * Verify the search box opens prefilled with the current channel filter
        await channelsPage.searchBox.toBeVisible();
        await expect(channelsPage.searchBox.searchInput).toHaveValue('in:off-topic ');
    },
);
