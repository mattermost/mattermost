// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that an in-progress file upload can be cancelled from the message file preview,
 * removing the file thumbnail before the message is sent.
 *
 * @precondition
 * Runs on Chromium only: it uses CDP network throttling to keep the upload in progress long enough
 * to cancel it. (The original Cypress test ran on a single Chromium-based browser; Playwright route
 * interception cannot be used here because it suppresses the browser's upload-progress events, which
 * the in-progress file preview depends on.)
 */
test('MM-T307 Cancel a file upload', {tag: '@files_and_attachments'}, async ({pw, browserName}) => {
    test.skip(browserName !== 'chromium', 'CDP network throttling is only available in Chromium');

    const {user, team} = await pw.initSetup();

    // # Log in a user in a new browser context and visit off-topic
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    const hugeImage = 'huge-image.jpg';

    // # Throttle upload bandwidth so the large image upload stays in progress while we cancel it
    const cdp = await channelsPage.page.context().newCDPSession(channelsPage.page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: 30 * 1024,
    });

    const {postCreate} = channelsPage.centerView;

    // # Attach a large image to the message
    await postCreate.attachFiles([hugeImage]);

    // * Verify the ongoing upload is shown in the file preview
    await expect(postCreate.filePreview).toBeVisible();
    await expect(postCreate.filePreview.locator('.post-image__thumbnail')).toBeVisible();
    await expect(postCreate.filePreview.getByText(hugeImage)).toBeVisible();

    // * Verify the file preview shows an in-progress upload indicator (Uploading.../Processing...)
    await expect(postCreate.filePreview.locator('.post-image__uploadingTxt')).toContainText(/Uploading|Processing/);

    // # Cancel the upload by clicking the remove (X) button on the thumbnail
    await postCreate.filePreviewRemoveButton.click();

    // * Verify the file preview and its thumbnail are removed
    await expect(postCreate.filePreview).not.toBeVisible();
    await expect(channelsPage.centerView.container.locator('.post-image')).toHaveCount(0);
});
