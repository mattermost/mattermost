// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Global Classification Banner with the ClassificationMarkings feature flag off.
 * Kept apart from global_classification_banner.spec.ts: a spec file must request one feature flag combination.
 */

import {expect, test, licenseTier} from '@mattermost/playwright-lib';

const TOP_BANNER_SELECTOR = '[data-testid="global-classification-banner-top"]';
const BOTTOM_BANNER_SELECTOR = '[data-testid="global-classification-banner-bottom"]';

test.describe('Global Classification Banner (feature flag off)', () => {
    test.beforeEach(async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const license = await adminClient.getClientLicenseOld();
        test.skip(licenseTier(license.SkuShortName) < 20, 'Classification markings requires Enterprise-tier license.');
    });

    /**
     * @objective Banner does not render when the ClassificationMarkings feature flag is off.
     */
    test(
        'MM-T6220 global banner: not rendered when feature flag is disabled',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            await pw.ensureFeatureFlag('ClassificationMarkings', false);
            const {adminUser} = await pw.initSetup();

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            await expect(channelsPage.page.locator(TOP_BANNER_SELECTOR)).not.toBeVisible();
            await expect(channelsPage.page.locator(BOTTOM_BANNER_SELECTOR)).not.toBeVisible();
        },
    );
});
