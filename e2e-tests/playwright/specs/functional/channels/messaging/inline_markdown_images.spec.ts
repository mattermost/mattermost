// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, setupFileServer, test} from '@mattermost/playwright-lib';

let fileServerUrl: string;
setupFileServer().then((serverUrl) => {
    fileServerUrl = serverUrl;
});

type Box = {x: number; y: number; width: number; height: number};

/**
 * Bounding box of a text-node substring. Locator.getByText matches the wrapping
 * <p>, which also contains the images and would overlap them even after a wrap.
 */
async function textNodeBox(scope: Locator, needle: string): Promise<Box | null> {
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
        return null;
    }, needle);
}

/**
 * @objective Verify an inline Markdown image opens in the image preview.
 */
test('MM-T187 Inline markdown images open preview window', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const imageUrl =
        'https://raw.githubusercontent.com/mattermost/mattermost/master/e2e-tests/cypress/tests/fixtures/image-small-height.png';

    // # Log in and post an inline Markdown image
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(`Hello ![test image](${imageUrl})`);

    // * Verify the inline image is visible
    const imagePost = await channelsPage.getLastPost();
    await expect(imagePost.getInlineImage('test image')).toBeVisible();

    // # Click the inline image
    await imagePost.openInlineImagePreview('test image');

    // * Verify the image opens in the preview
    await channelsPage.imagePreviewModal.toBeVisible();
});

/**
 * @objective Verify an inline Markdown image nested in a link renders correctly and points to the external destination.
 */
test('MM-T188 Inline markdown image that is a link, opens the link', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const linkUrl = 'https://www.google.com';
    const imageUrl =
        'https://raw.githubusercontent.com/mattermost/mattermost/master/e2e-tests/cypress/tests/fixtures/mattermost-icon_128x128.png';
    const label = 'Build Status';

    // # Log in and post a linked inline Markdown image
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(`[![${label}](${imageUrl})](${linkUrl})`);

    // * Verify the image link has the correct destination and opens in a new tab
    const imagePost = await channelsPage.getLastPost();
    const imageLink = imagePost.getInlineImageLink(label);
    await expect(imageLink).toHaveAttribute('href', linkUrl);
    await expect(imageLink).toHaveAttribute('target', '_blank');

    // * Verify the linked image is visible with the expected source and alt text
    const linkedImage = imagePost.getInlineImage(label);
    await expect(linkedImage).toBeVisible();
    await expect(linkedImage).toHaveAttribute('src', imageUrl);
});

/**
 * @objective Verify inline Markdown images stay in the text flow instead of each starting a new line.
 */
test('inline markdown images share a line with the surrounding text', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // Stay under EXPANDABLE_INLINE_IMAGE_MIN_HEIGHT so the images aren't wrapped in the
    // block-level collapse control, which legitimately takes a line of its own.
    const imageUrl = `${fileServerUrl}/small-image.png`;

    // # Log in and post two inline Markdown images surrounded by text
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(`foo bar ![first](${imageUrl}) ![second](${imageUrl}) hello world`);

    // * Verify both images are visible
    const imagePost = await channelsPage.getLastPost();
    const firstImage = imagePost.getInlineImage('first');
    const secondImage = imagePost.getInlineImage('second');
    await expect(firstImage).toBeVisible();
    await expect(secondImage).toBeVisible();

    // * Verify the two images sit next to each other on the same line
    const firstBox = (await firstImage.boundingBox())!;
    const secondBox = (await secondImage.boundingBox())!;
    expect(secondBox.y).toBeCloseTo(firstBox.y, 0);
    expect(secondBox.x).toBeGreaterThan(firstBox.x + firstBox.width);

    // * Verify "hello world" shares a row with both images. The 24x24 fixture is
    // short enough that a wrapped text line can still sit under firstBox.height * 2.
    const helloBox = await textNodeBox(imagePost.body, 'hello world');
    expect(helloBox).not.toBeNull();
    expect(helloBox!.y).toBeLessThan(firstBox.y + firstBox.height);
    expect(helloBox!.y + helloBox!.height).toBeGreaterThan(firstBox.y);
    expect(helloBox!.y).toBeLessThan(secondBox.y + secondBox.height);
    expect(helloBox!.y + helloBox!.height).toBeGreaterThan(secondBox.y);
    expect(helloBox!.x).toBeGreaterThan(secondBox.x + secondBox.width);

    // * Verify the message still occupies a single line, so the text wasn't pushed around the images
    const messageBox = (await imagePost.body.boundingBox())!;
    expect(messageBox.height).toBeLessThan(firstBox.height * 2);
});
