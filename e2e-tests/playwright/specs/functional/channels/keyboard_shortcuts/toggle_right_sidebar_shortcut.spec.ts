// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Ctrl/Cmd+. opens and closes the right-hand sidebar.
 */
test(
    'MM-T4692 opens and closes the right sidebar with the keyboard shortcut',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Post a message and open its reply thread in the right sidebar
        await channelsPage.centerView.postCreate.postMessage('this post is from today');
        const post = await channelsPage.getLastPost();
        await post.openAThread();
        await channelsPage.sidebarRight.toBeVisible();

        // # Press the toggle shortcut to close the right sidebar
        await page.keyboard.press('ControlOrMeta+.');

        // * Verify the right sidebar is closed
        await expect(channelsPage.sidebarRight.container).not.toBeVisible();

        // # Press the toggle shortcut again to reopen the right sidebar
        await page.keyboard.press('ControlOrMeta+.');

        // * Verify the right sidebar is shown again with the reply thread
        await channelsPage.sidebarRight.toBeVisible();
        await expect(channelsPage.sidebarRight.container.getByText('this post is from today')).toBeVisible();
    },
);
