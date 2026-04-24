// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console autotranslation settings (Site Configuration -> Localization).
 * AT-SC-01: Without EA license, feature discovery is shown.
 * AT-SC-02: With EA license, Auto-translation toggle is visible and off by default.
 * AT-SC-03: Enabling the system toggle expands provider and target language configuration.
 */

import {expect, test, hasAutotranslationLicense} from '@mattermost/playwright-lib';

import {gotoLocalization} from './support';

test.describe('System Console - Autotranslation (Localization)', () => {
    test(
        'without EA license, auto-translation shows feature discovery block',
        {
            tag: ['@autotranslation', '@system_console'],
        },
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            const license = await adminClient.getClientLicenseOld();
            test.skip(
                hasAutotranslationLicense(license.SkuShortName),
                'Skipping test - this test requires non-Entry/Advanced license to see feature discovery',
            );

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.toBeVisible();

            await gotoLocalization(systemConsolePage);

            await expect(systemConsolePage.localization.featureDiscoveryBlock).toBeVisible();
            await expect(systemConsolePage.localization.autoTranslationSection).not.toBeVisible();
        },
    );

    test(
        'with EA license, Auto-translation toggle is visible and off by default',
        {
            tag: ['@autotranslation', '@system_console'],
        },
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            const license = await adminClient.getClientLicenseOld();
            test.skip(
                !hasAutotranslationLicense(license.SkuShortName),
                'Skipping test - server does not have Entry or Advanced license',
            );

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.toBeVisible();

            await gotoLocalization(systemConsolePage);

            await expect(systemConsolePage.localization.autoTranslationSection).toBeVisible();
            await expect(systemConsolePage.localization.autoTranslationToggle).toBeVisible();
            // Check toggle state directly (not via unscoped text search which is flaky)
            const isOn = await systemConsolePage.localization.isToggleOn();
            expect(isOn).toBe(false);
        },
    );

    test(
        'enabling system toggle expands provider and target language configuration',
        {
            tag: ['@autotranslation', '@system_console'],
        },
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            const license = await adminClient.getClientLicenseOld();
            test.skip(
                !hasAutotranslationLicense(license.SkuShortName),
                'Skipping test - server does not have Entry or Advanced license',
            );

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.toBeVisible();

            await gotoLocalization(systemConsolePage);

            await systemConsolePage.localization.turnOnAutoTranslation();

            await expect(systemConsolePage.localization.providerDropdown).toBeVisible();
            await expect(systemConsolePage.localization.targetLanguagesMultiSelect).toBeVisible();
        },
    );
});
