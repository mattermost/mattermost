// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

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
