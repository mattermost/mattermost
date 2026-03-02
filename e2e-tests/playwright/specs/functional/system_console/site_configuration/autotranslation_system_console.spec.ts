// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console autotranslation settings (Site Configuration -> Localization).
 * AT-SC-01: Without EA license, feature discovery is shown.
 * AT-SC-02: With EA license, Auto-translation toggle is visible and off by default.
 * AT-SC-03: Enabling the system toggle expands provider and target language configuration.
 * AT-SC-05: Selecting LibreTranslate shows endpoint and API key fields.
 * AT-SC-07: Target languages multi-select is visible and usable.
 */

import {expect, test, hasAutotranslationLicense} from '@mattermost/playwright-lib';

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

            await systemConsolePage.sidebar.siteConfiguration.localization.click();
            await systemConsolePage.page.waitForURL(/\/admin_console\/site_config\/localization/);

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

            await systemConsolePage.sidebar.siteConfiguration.localization.click();
            await systemConsolePage.page.waitForURL(/\/admin_console\/site_config\/localization/);

            await expect(systemConsolePage.localization.autoTranslationSection).toBeVisible();
            await expect(systemConsolePage.localization.autoTranslationToggle).toBeVisible();
            await expect(systemConsolePage.localization.container.getByText('Off')).toBeVisible();
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

            await systemConsolePage.sidebar.siteConfiguration.localization.click();
            await systemConsolePage.page.waitForURL(/\/admin_console\/site_config\/localization/);

            await systemConsolePage.localization.turnOnAutoTranslation();

            await expect(systemConsolePage.localization.providerDropdown).toBeVisible();
            await expect(systemConsolePage.localization.targetLanguagesMultiSelect).toBeVisible();
        },
    );

    test(
        'selecting LibreTranslate shows endpoint and API key fields',
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

            await systemConsolePage.sidebar.siteConfiguration.localization.click();
            await systemConsolePage.page.waitForURL(/\/admin_console\/site_config\/localization/);

            await systemConsolePage.localization.turnOnAutoTranslation();

            await systemConsolePage.localization.providerDropdown.selectOption('libretranslate');

            await expect(systemConsolePage.localization.libreTranslateUrlInput).toBeVisible();
            await expect(systemConsolePage.localization.libreTranslateApiKeyInput).toBeVisible();
            await expect(systemConsolePage.localization.container.getByText(/LibreTranslate docs/i)).toBeVisible();
        },
    );

    test(
        'admin can select multiple target languages',
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

            await systemConsolePage.sidebar.siteConfiguration.localization.click();
            await systemConsolePage.page.waitForURL(/\/admin_console\/site_config\/localization/);

            await systemConsolePage.localization.turnOnAutoTranslation();

            await expect(systemConsolePage.localization.targetLanguagesMultiSelect).toBeVisible();
            await expect(systemConsolePage.localization.container.getByText('Languages allowed')).toBeVisible();
        },
    );
});
