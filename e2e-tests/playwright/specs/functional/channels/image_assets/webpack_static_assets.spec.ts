// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that webpack-bundled static image assets are not broken by
 * the image-minimizer-webpack-plugin (sharp) migration.
 *
 * Sharp runs at build time and compresses PNG/JPEG/SVG assets bundled into the
 * app. If it mis-encodes a file the asset will either 404, return a wrong
 * content-type, or decode to a zero-width image in the browser.
 *
 * This test catches that by reloading the page and asserting:
 *  - no static asset request returns 4xx/5xx
 *  - no <img> in the DOM has naturalWidth === 0 (failed to decode)
 */

test('app loads without any broken image assets on the main channel view', {tag: '@image_assets'}, async ({pw}) => {
    const {user, team, townSquare} = await pw.initSetup();
    const {app, page} = await pw.testBrowser.login(user);
    const messageBox = app.center.postCreate.message.container;

    await app.channelsPage.goto({team, channel: townSquare});
    await expect(messageBox).toBeVisible();

    // # Collect image/font load errors on reload so the response listener is
    // active before any requests fire.
    const failedImageUrls: string[] = [];
    page.on('response', (response) => {
        const url = response.url();
        const isImage = /\.(png|jpg|jpeg|svg|gif|woff2|woff)(\?|$)/.test(url);
        if (isImage && response.status() >= 400) {
            failedImageUrls.push(`${response.status()} ${url}`);
        }
    });

    await page.reload();
    await expect(messageBox).toBeVisible();

    // * No image/font requests should return 4xx or 5xx
    expect(failedImageUrls, `Failed asset requests:\n${failedImageUrls.join('\n')}`).toHaveLength(0);

    // * No <img> element should have naturalWidth === 0 (means the file was
    // served but the browser could not decode it — typical of a sharp corruption)
    const brokenImages = await page.evaluate(() => {
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- every <img> in the document is under test, including ones no component gives an id
        return Array.from(document.querySelectorAll('img'))
            .filter((img) => img.complete && img.naturalWidth === 0 && Boolean(img.src))
            .map((img) => img.src);
    });

    expect(brokenImages, `Broken <img> elements found:\n${brokenImages.join('\n')}`).toHaveLength(0);
});
