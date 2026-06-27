// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the Edition and License page links for Privacy Policy and Enterprise Edition
 * Terms of Use point to their correct public URLs.
 *
 * @precondition
 * A license is required (Enterprise edition page). Skipped if the server is unlicensed.
 */
test(
    'MM-T899 Edition and License: Privacy Policy and Terms of Use links point to correct URLs',
    {tag: ['@system_console', '@enterprise']},
    async ({pw}) => {
        await pw.skipIfNoLicense();

        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user during initSetup');
        }

        // # Log in as the system admin and open the Edition and License page
        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);
        await page.goto('/admin_console/about/license');

        const {editionAndLicense} = systemConsolePage;
        await editionAndLicense.toBeVisible();

        // * Verify the Privacy Policy link points to the correct public URL
        await expect(editionAndLicense.privacyPolicyLink).toHaveAttribute(
            'href',
            /https:\/\/mattermost\.com\/pl\/privacy-policy\//,
        );

        // * Verify the Enterprise Edition Terms of Use link points to the correct public URL
        await expect(editionAndLicense.termsOfServiceLink).toHaveAttribute(
            'href',
            /https:\/\/mattermost\.com\/pl\/terms-of-use\//,
        );
    },
);
