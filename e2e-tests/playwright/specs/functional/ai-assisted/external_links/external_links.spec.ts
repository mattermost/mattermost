// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('external link in a posted message opens in a new tab @ai-assisted', async ({pw}) => {
    // # Set up user and login
    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Post a message containing an external URL
    const externalUrl = 'https://example.com';
    await channelsPage.postMessage(`Check out ${externalUrl} for details`);

    // * Verify the URL renders as a clickable link in the channel
    const linkLocator = page.getByRole('link', {name: externalUrl});
    await expect(linkLocator).toBeVisible();

    // # Click the link while waiting for the new tab to open
    const [newPage] = await Promise.all([page.context().waitForEvent('page'), linkLocator.click()]);

    // * Verify the new tab navigates to the external URL
    await expect(newPage).toHaveURL(/example\.com/);
});
