// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the Recaps sidebar link icon is vertically aligned with its label.
 */
test('Recaps sidebar link icon is vertically aligned with its label', {tag: '@sidebar'}, async ({pw}) => {
    const {team, user} = await pw.initSetup();

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await page.route('**/api/v4/config/client?format=old*', async (route) => {
        const response = await route.fetch();
        const config = await response.json();
        config.FeatureFlagEnableAIRecaps = 'true';

        await route.fulfill({response, json: config});
    });

    await page.goto(`/${team.name}/channels/town-square`);
    await channelsPage.sidebarLeft.toBeVisible();

    const recapsLink = page.locator('#sidebarItem_recaps');
    await expect(recapsLink).toBeVisible();

    const {delta} = await recapsLink.evaluate((link) => {
        const icon = link.querySelector('.icon svg');
        const label = link.querySelector('.SidebarChannelLinkLabel');

        if (!(icon instanceof SVGElement) || !(label instanceof HTMLElement)) {
            throw new Error('Recaps sidebar link markup is missing expected icon or label elements.');
        }

        const iconRect = icon.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();

        return {
            delta: Math.abs(
                (iconRect.top + (iconRect.height / 2)) -
                (labelRect.top + (labelRect.height / 2)),
            ),
        };
    });

    expect(delta).toBeLessThan(2);
});
