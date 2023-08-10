// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('Intro to channel', async ({pw, pages, axe}) => {
    // Create and sign in a new user
    const {user} = await pw.initSetup();

    // Log in a user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // Visit a default channel page
    const channelsPage = new pages.ChannelsPage(page);
    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage('hello');
    await channelsPage.sendMessage();

    // # Analyze the page
    // Disable 'color-contrast' to be addressed by MM-53814
    const accessibilityScanResults = await axe.builder(page, {disableColorContrast: true}).analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});
