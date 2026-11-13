// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Classification markings with the ClassificationMarkings feature flag off.
 * Kept apart from classification_markings.spec.ts: a spec file must request one feature flag combination.
 */

import {expect, test, licenseTier} from '@mattermost/playwright-lib';

import {CLASSIFICATION_MARKINGS_ADMIN_PATH} from './classification_markings_helpers';

test.describe('System Console - Classification markings (feature flag off)', () => {
    test.beforeEach(async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const license = await adminClient.getClientLicenseOld();
        test.skip(licenseTier(license.SkuShortName) < 20, 'Classification markings requires Enterprise-tier license.');
    });

    /**
     * @objective Ensure the classification markings admin route is unavailable when the feature flag is off.
     */
    test(
        'MM-T6201 classification markings: feature flag off redirects away from admin URL',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            // # Turn off ClassificationMarkings
            await pw.ensureFeatureFlag('ClassificationMarkings', false);
            const {adminUser} = await pw.getAdminClient();

            if (!adminUser) {
                throw new Error('Failed to get admin user');
            }

            // # Open system console and navigate directly to the classification markings path
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);

            // * User is redirected away from the hidden route (no Route registered)
            await expect(systemConsolePage.page).not.toHaveURL(/classification_markings/);
            // * Classification markings page title is not shown
            await expect(systemConsolePage.page.getByText('Classification Markings').first()).not.toBeVisible();
        },
    );
});
