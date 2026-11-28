// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {Api, expect, settle, setupFileServer, test} from '@mattermost/playwright-lib';

let fileServerUrl: string;
setupFileServer().then((serverUrl) => {
    fileServerUrl = serverUrl;
});

type Box = {x: number; y: number; width: number; height: number};

/**
 * Bounding box of a text-node substring. Locator.getByText matches the wrapping
 * <p>, which also contains the images and would overlap them even after a wrap.
 * Range.getBoundingClientRect is viewport-relative, like Playwright boundingBox().
 */
async function textNodeBox(scope: Locator, needle: string): Promise<Box> {
    return scope.evaluate((root, text) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null = walker.nextNode();
        while (node) {
            const value = node.textContent ?? '';
            const index = value.indexOf(text);
            if (index >= 0) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + text.length);
                const {x, y, width, height} = range.getBoundingClientRect();
                return {x, y, width, height};
            }
            node = walker.nextNode();
        }
        throw new Error(`Couldn't find "${text}" in the post message`);
    }, needle);
}

/** Bounding box of an element, viewport-relative like Playwright boundingBox(). */
async function boxOf(scope: Locator): Promise<Box> {
    return scope.evaluate((element) => {
        const {x, y, width, height} = element.getBoundingClientRect();
        return {x, y, width, height};
    });
}

/**
 * @objective Verify an inline Markdown image opens in the image preview.
 */
test('MM-T187 Inline markdown images open preview window', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, userClient, offTopic: channel} = await pw.initSetup();
    const imageUrl =
        'https://raw.githubusercontent.com/mattermost/mattermost/master/e2e-tests/cypress/tests/fixtures/image-small-height.png';
    const post = await userClient.createPost({channel_id: channel.id, message: `Hello ![test image](${imageUrl})`});

    // # Log in and open the channel
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const markdown = app.center.postList.post(post).markdown;

    // * The inline image is visible
    await expect(markdown.image.container).toBeVisible();
    await expect(markdown.image.container).toHaveAttribute('alt', 'test image');

    // # Click the inline image
    // An inline image opens its preview on click but is exposed as an image, not a button.
    await markdown.image.container.click();

    // * The image opens in the preview
    await expect(app.filePreviewModal).toBeVisible();
});

/**
 * @objective Verify an inline Markdown image nested in a link renders correctly and points to the external destination.
 */
test('MM-T188 Inline markdown image that is a link, opens the link', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, userClient, offTopic: channel} = await pw.initSetup();
    const linkUrl = 'https://www.google.com';
    const imageUrl =
        'https://raw.githubusercontent.com/mattermost/mattermost/master/e2e-tests/cypress/tests/fixtures/mattermost-icon_128x128.png';
    const label = 'Build Status';
    const post = await userClient.createPost({
        channel_id: channel.id,
        message: `[![${label}](${imageUrl})](${linkUrl})`,
    });

    // # Log in and open the channel
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const markdown = app.center.postList.post(post).markdown;

    // * The image's link has the right destination and opens in a new tab
    await expect(markdown.linkLink).toHaveAttribute('href', linkUrl);
    await expect(markdown.linkLink).toHaveAttribute('target', '_blank');

    // * The linked image is visible with the expected source and alt text
    await expect(markdown.image.container).toBeVisible();
    await expect(markdown.image.container).toHaveAttribute('src', imageUrl);
    await expect(markdown.image.container).toHaveAttribute('alt', label);
});

/**
 * @objective Verify inline Markdown images stay in the text flow instead of each starting a new line.
 */
test('inline markdown images share a line with the surrounding text', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, offTopic: channel} = await pw.initSetup();
    // Stay under EXPANDABLE_INLINE_IMAGE_MIN_HEIGHT so the images aren't wrapped in the
    // block-level collapse control, which legitimately takes a line of its own.
    const imageUrl = `${fileServerUrl}/small-image.png`;

    // # Log in and post two inline Markdown images surrounded by text
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const composer = app.center.postCreate;
    await composer.message.container.fill(`foo bar ![first](${imageUrl}) ![second](${imageUrl}) hello world`);
    const created = await settle(composer.sendButton, {wait: Api.CreatePost}).click();
    const imagePost = app.center.postList.post(created);
    const markdown = imagePost.markdown;

    // * Verify both images are visible, in message order
    const firstImage = markdown.image.container.locator.nth(0);
    const secondImage = markdown.image.container.locator.nth(1);
    await expect(firstImage).toBeVisible();
    await expect(firstImage).toHaveAttribute('alt', 'first');
    await expect(secondImage).toBeVisible();
    await expect(secondImage).toHaveAttribute('alt', 'second');

    // * Verify the two images sit next to each other on the same line
    const firstBox = await boxOf(firstImage);
    const secondBox = await boxOf(secondImage);
    expect(Math.abs(secondBox.y - firstBox.y) < 0.5).toBe(true);
    expect(secondBox.x > firstBox.x + firstBox.width).toBe(true);

    // * Verify "hello world" shares a row with both images. The 24x24 fixture is
    // short enough that a wrapped text line can still sit under firstBox.height * 2.
    const helloBox = await textNodeBox(imagePost.body.locator, 'hello world');
    expect(helloBox.y).toBeLessThan(firstBox.y + firstBox.height);
    expect(helloBox.y + helloBox.height).toBeGreaterThan(firstBox.y);
    expect(helloBox.y).toBeLessThan(secondBox.y + secondBox.height);
    expect(helloBox.y + helloBox.height).toBeGreaterThan(secondBox.y);
    expect(helloBox.x).toBeGreaterThan(secondBox.x + secondBox.width);

    // * Verify the message still occupies a single line, so the text wasn't pushed around the images
    const messageBox = await boxOf(imagePost.body.locator);
    expect(messageBox.height).toBeLessThan(firstBox.height * 2);
});
