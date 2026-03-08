// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the Recaps sidebar link icon remains aligned with its label
 */
test(
    'displays recaps sidebar link aligned correctly',
    {tag: ['@visual', '@recaps', '@snapshots']},
    async ({pw, browserName, viewport}, testInfo) => {
        // # Initialize setup and enable the Recaps feature flag
        const {team, user, adminClient} = await pw.initSetup();
        await adminClient.patchConfig({
            FeatureFlags: {EnableAIRecaps: true},
        });

        // # Log in as a regular user and open a stable channel view
        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // * Verify the Recaps link is visible and visually aligned
        const recapsRow = page.locator('#sidebar-recaps-button');
        await expect(recapsRow).toBeVisible();
        await pw.matchSnapshot(testInfo, {page, browserName, viewport, locator: recapsRow});
    },
);
