// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that while the emoji picker is open over a post, scrolling the center channel with
 * PageUp is disabled (the posts stay in place).
 */
test('MM-T2365 disables center channel scrolling while the emoji picker is open', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Scrolling ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    const [other] = await adminClient.createUsers(team.id, 1, 'filler');
    await adminClient.addToChannel(other.id, channel.id);

    // # Fill the channel so it can scroll, then post the message to react to last
    for (let i = 0; i < 40; i++) {
        await pw.postAs(other, {channel_id: channel.id, message: `filler ${i}`});
    }
    const target = await userClient.createPost({channel_id: channel.id, message: `react target ${pw.random.id()}`});

    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Open the emoji picker from the post's Add Reaction button
    const post = app.center.postList.post(target);
    await post.container.hover();
    await post.menu.addReactionButton.clickTo(app.emojiPicker.searchTextbox);
    await expect(app.emojiPicker.searchTextbox).toBeVisible();

    // # Press PageUp while the picker is open
    const before = await post.locator.boundingBox();
    await page.keyboard.press('PageUp');
    await expect(app.emojiPicker.searchTextbox).toBeVisible();

    await pw.wait(pw.duration.one_sec);
    const after = await post.locator.boundingBox();

    // * Verify the posts did not scroll
    if (!before || !after) {
        throw new Error('Expected the post to have a bounding box while the emoji picker is open');
    }
    expect(Math.abs(after.y - before.y)).toBeLessThan(5);

    // # Close the picker and press PageUp again
    await page.keyboard.press('Escape');
    await expect(app.emojiPicker.searchTextbox).not.toBeVisible();
    await page.keyboard.press('PageUp');

    // * Verify the posts scrolled this time
    await expect
        .poll(async () => Math.abs(((await post.locator.boundingBox())?.y ?? before.y) - before.y), {
            message: 'PageUp scrolls the posts once the emoji picker is closed',
        })
        .toBeGreaterThan(5);
});
