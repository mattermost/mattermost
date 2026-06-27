// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that messages sent in quick succession are posted and displayed in the same
 * order they were sent (no reordering of optimistically-rendered posts).
 */
test('MM-T3309 Posts do not change order when being sent quickly', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Log in a user in a new browser context and visit off-topic
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // # Post an initial message
    await channelsPage.postMessage('hello');

    // # Send 10 messages ("9" down to "0") in quick succession
    const {input} = channelsPage.centerView.postCreate;
    for (let i = 9; i >= 0; i--) {
        await input.fill(String(i));
        await input.press('Enter');
    }

    // * Verify the last 10 posts retain the exact order they were sent ("9" → "0")
    const postViews = channelsPage.centerView.container.getByTestId('postView');
    await expect(postViews.nth(-1)).toBeVisible();
    const count = await postViews.count();

    for (let i = 0; i < 10; i++) {
        const expectedText = String(9 - i);
        const messageText = postViews.nth(count - 10 + i).locator('.post-message__text');
        await expect(messageText).toHaveText(expectedText);
    }
});
