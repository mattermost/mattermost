// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

test('Should be able to change threads with arrow keys', async ({pw}, testInfo) => {
    test.skip(testInfo.project.name === 'ipad');

    const {team, user} = await pw.initSetup();

    const {channelsPage, page, threadsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Start some threads, and leave a draft in one of them
    await channelsPage.centerView.postCreate.postMessage('aaa');
    await (await channelsPage.getLastPost()).openAThread();
    await channelsPage.sidebarRight.postMessage('aaa reply');

    await channelsPage.centerView.postCreate.postMessage('bbb');
    await (await channelsPage.getLastPost()).openAThread();
    await channelsPage.sidebarRight.postMessage('bbb reply');
    await channelsPage.sidebarRight.postCreate.writeMessage('bbb second reply');

    await channelsPage.centerView.postCreate.postMessage('ccc');
    await (await channelsPage.getLastPost()).openAThread();
    await channelsPage.sidebarRight.postMessage('ccc reply');

    // * Ensure that there's a draft
    await channelsPage.sidebarLeft.draftsVisible();

    // # Switch to the threads list
    await threadsPage.goto(team.name);
    await threadsPage.toBeVisible();

    // * Ensure no thread starts selected
    await threadsPage.toNotHaveThreadSelected();

    // # Press the down arrow to select a thread
    await page.keyboard.press('ArrowDown');

    // * Ensure the latest thread was selected
    await threadsPage.toHaveThreadSelected();
    (await threadsPage.getLastPost()).toContainText('ccc reply');

    // # Press the down arrow again
    await page.keyboard.press('ArrowDown');

    // * Ensure the latest thread was selected
    await threadsPage.toHaveThreadSelected();
    (await threadsPage.getLastPost()).toContainText('bbb reply');

    await threadsPage.threadsList.focus();

    // # Press the down arrow again
    await page.keyboard.press('ArrowDown');

    // * Ensure the latest thread was selected
    await threadsPage.toHaveThreadSelected();
    (await threadsPage.getLastPost()).toContainText('aaa reply');

    // # Press the up arrow
    await page.keyboard.press('ArrowUp');

    // * Ensure the latest thread was selected
    await threadsPage.toHaveThreadSelected();
    (await threadsPage.getLastPost()).toContainText('bbb reply');

    // # Press the up arrow
    await page.keyboard.press('ArrowUp');

    // * Ensure the latest thread was selected
    await threadsPage.toHaveThreadSelected();
    (await threadsPage.getLastPost()).toContainText('ccc reply');
});
