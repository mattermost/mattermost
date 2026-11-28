// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, generated, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that users can navigate through threads list using keyboard arrow keys
 */
test('Should be able to change threads with arrow keys', {tag: ['@smoke']}, async ({pw}, testInfo) => {
    test.skip(testInfo.project.name === 'ipad');

    const {team, user, userClient, townSquare: channel} = await pw.initSetup();
    // # Start three threads, oldest first, and leave a draft reply in the middle one
    const startThread = async (message: string) => {
        const root = await userClient.createPost({channel_id: channel.id, message} as any);
        const reply = await userClient.createPost({
            channel_id: channel.id,
            root_id: root.id,
            message: `${message} reply`,
        } as any);
        return {root, reply};
    };
    const aaa = await startThread('aaa');
    const bbb = await startThread('bbb');
    const ccc = await startThread('ccc');
    await userClient.upsertDraft(
        {user_id: user.id, channel_id: channel.id, root_id: bbb.root.id, message: 'bbb second reply'} as any,
        '',
    );

    // # Open the threads list
    const {app, page} = await pw.testBrowser.login(user);
    await app.threadsPage.goto({team});

    // * The draft is there, the threads are listed newest first, and none is open
    await expect(app.lhs.drafts).toBeVisible();
    await expect(app.threads.feed.threadList).toHaveKeyCount(3);
    for (const [position, thread] of [ccc, bbb, aaa].entries()) {
        await expect(app.threads.feed.thread(position).preview).toContainText(thread.root.message);
    }
    await expect(page).toHavePath(generated.ThreadsPage.path({team}));

    // # Press the down arrow: the newest thread opens
    await page.keyboard.press('ArrowDown');
    await expect(page).toHavePath(generated.ThreadsPage.path({team, threadIdentifier: ccc.root.id}));
    await expect(app.rhs.thread.post(ccc.reply).locator).toBeVisible();

    // # Press the down arrow again: the next one opens
    await page.keyboard.press('ArrowDown');
    await expect(page).toHavePath(generated.ThreadsPage.path({team, threadIdentifier: bbb.root.id}));
    await expect(app.rhs.thread.post(bbb.reply).locator).toBeVisible();

    // # Focus the list and press the down arrow: the oldest thread opens
    await app.threads.feed.container.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page).toHavePath(generated.ThreadsPage.path({team, threadIdentifier: aaa.root.id}));
    await expect(app.rhs.thread.post(aaa.reply).locator).toBeVisible();

    // # Press the up arrow twice: back up the list
    await page.keyboard.press('ArrowUp');
    await expect(page).toHavePath(generated.ThreadsPage.path({team, threadIdentifier: bbb.root.id}));
    await expect(app.rhs.thread.post(bbb.reply).locator).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await expect(page).toHavePath(generated.ThreadsPage.path({team, threadIdentifier: ccc.root.id}));
    await expect(app.rhs.thread.post(ccc.reply).locator).toBeVisible();
});
