// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that while the emoji picker is open over a post, scrolling the center channel with
 * PageUp is disabled (the posts stay in place).
 */
test('MM-T2365 disables center channel scrolling while the emoji picker is open', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Scrolling ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    // # Fill the channel with enough posts to make it scrollable
    for (let i = 0; i < 40; i++) {
        await adminClient.createPost({channel_id: channel.id, user_id: user.id, message: `filler ${i}`});
    }

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Post a message and open the emoji (reaction) picker over it
    const message = `react target ${pw.random.id()}`;
    await channelsPage.postMessage(message);
    const post = await channelsPage.getLastPost();
    await post.openReactionPicker();
    await expect(channelsPage.reactionEmojiPicker.container).toBeVisible();

    // # Record the target post position, then press PageUp
    const before = await post.container.boundingBox();
    await page.keyboard.press('PageUp');
    await pw.wait(pw.duration.one_sec);
    const after = await post.container.boundingBox();

    // * Verify the post did not move (the channel did not scroll while the picker was open)
    if (!before || !after) {
        throw new Error('Expected the post to have a bounding box while the emoji picker is open');
    }
    expect(Math.abs(after.y - before.y)).toBeLessThan(5);

    // # Close the emoji picker and press PageUp again
    await page.keyboard.press('Escape');
    await expect(channelsPage.reactionEmojiPicker.container).not.toBeVisible();
    await page.keyboard.press('PageUp');
    await pw.wait(pw.duration.one_sec);

    // * Verify scrolling works again once the picker is closed (control: the post now moves)
    const afterClose = await post.container.boundingBox();
    if (!afterClose) {
        throw new Error('Expected the post to have a bounding box after the emoji picker is closed');
    }
    expect(Math.abs(afterClose.y - before.y)).toBeGreaterThan(5);
});
