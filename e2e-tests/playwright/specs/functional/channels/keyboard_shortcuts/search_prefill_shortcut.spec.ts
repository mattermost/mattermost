// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
