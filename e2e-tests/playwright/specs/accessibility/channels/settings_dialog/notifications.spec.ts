// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('Accessibility of Notifications Settings in Settings Dialog', async ({pw, axe}) => {
    // # Create and sign in a new user
    const {user} = await pw.initSetup();

    // # Log in a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit a default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    const settings = await channelsPage.openSettings();

    // * Analyze the Settings dialog
    const accessibilityScanResults = await axe
        .builder(page, {disableColorContrast: true})
        .disableRules([
            'color-contrast',

            // Known issue: These fail due to the way setting tabs are grouped.
            'aria-required-children',
            'aria-required-parent',
        ])
        .include(settings.getContainerId())
        .analyze();

    // * Should have no violation
    expect(accessibilityScanResults.violations).toHaveLength(0);
});
