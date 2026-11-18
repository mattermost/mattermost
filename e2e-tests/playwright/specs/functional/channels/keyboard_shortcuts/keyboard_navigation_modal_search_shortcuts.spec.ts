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
        const {user, team, offTopic, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: offTopic});
        const title = app.channelHeader.openMenuButton;
        const input = app.center.postCreate.message.container;
        await expect(title).toContainText(offTopic.display_name);

        // # Move to the next channel with the keyboard
        await input.focus();
        await input.press('Alt+ArrowDown');

        // * Verify the next channel in the sidebar is shown
        await expect(title).toContainText(townSquare.display_name);

        // # Move to the previous channel with the keyboard
        await input.press('Alt+ArrowUp');

        // * Verify the original channel is shown again
        await expect(title).toContainText(offTopic.display_name);
    },
);

/**
 * @objective Verify Ctrl/Cmd+Shift+K opens the Direct Messages modal, and Escape closes it.
 */
test(
    'MM-T1276 opens the Direct Messages modal with the keyboard shortcut',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {user, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Focus the message box and press the Direct Messages shortcut
        const input = app.center.postCreate.message.container;
        await input.focus();
        await input.press('ControlOrMeta+Shift+K');

        // * Verify the Direct Messages modal opens
        const search = app.directMessagesModal.options.searchCombobox;
        await expect(search).toBeVisible();

        // # Close the modal with Escape
        await search.press('Escape');

        // * Verify the Direct Messages modal closes
        await expect(search).not.toBeVisible();
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
        const {user, team, offTopic} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: offTopic});

        // # Focus the message box and press the in-channel search shortcut
        const input = app.center.postCreate.message.container;
        await input.focus();
        await input.press('ControlOrMeta+Shift+F');

        // * Verify the search box opens prefilled with the current channel filter
        await expect(app.searchBox.inputSearchbox).toHaveValue(`in:${offTopic.name} `);
    },
);
