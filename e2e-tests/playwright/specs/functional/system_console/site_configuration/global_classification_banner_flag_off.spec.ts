// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Global Classification Banner with the ClassificationMarkings feature flag off.
 * Kept apart from global_classification_banner.spec.ts: a spec file must request one feature flag combination.
 */

import {expect, test, licenseTier} from '@mattermost/playwright-lib';

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
            const {adminUser, team, townSquare} = await pw.initSetup();

            const {app} = await pw.testBrowser.login(adminUser);
            await app.channelsPage.goto({team, channel: townSquare});

            // * The app is up, with neither banner
            await expect(app.center.postCreate.message.container).toBeVisible();
            await expect(app.classificationBanner.top).toHaveCount(0);
            await expect(app.classificationBanner.bottom).toHaveCount(0);
        },
    );
});
