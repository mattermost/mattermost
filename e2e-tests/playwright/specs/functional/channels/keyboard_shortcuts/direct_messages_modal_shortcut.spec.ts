// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
