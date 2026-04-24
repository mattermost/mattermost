// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console autotranslation settings (Site Configuration -> Localization).
 * AT-SC-05: Selecting LibreTranslate shows endpoint and API key fields.
 * AT-SC-07: Target languages multi-select is visible and usable.
 */

import {expect, test, hasAutotranslationLicense} from '@mattermost/playwright-lib';

import {gotoLocalization} from './support';

test.describe('System Console - Autotranslation (Localization)', () => {
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

            await gotoLocalization(systemConsolePage);

            await systemConsolePage.localization.turnOnAutoTranslation();

            await systemConsolePage.localization.selectTranslationProvider('LibreTranslate');

            await expect(systemConsolePage.localization.libreTranslateUrlInput).toBeVisible();
            await expect(systemConsolePage.localization.libreTranslateApiKeyInput).toBeVisible();
            await expect(systemConsolePage.localization.container.getByText(/LibreTranslate docs/i)).toBeVisible();
        },
    );

    test(
        'selecting Mattermost Agents hides LibreTranslate fields and shows plugin guidance',
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

            // # Open Localization settings in the System Console
            await gotoLocalization(systemConsolePage);

            // # Enable auto-translation and switch the provider to Mattermost Agents
            await systemConsolePage.localization.turnOnAutoTranslation();
            await systemConsolePage.localization.selectTranslationProvider('Mattermost Agents');

            // * Verify Mattermost Agents guidance is shown for the inactive plugin
            await expect(systemConsolePage.localization.mattermostAgentsInactiveNotice).toBeVisible();
            await expect(systemConsolePage.localization.mattermostAgentsConfigLink).toBeVisible();
            await expect(systemConsolePage.localization.mattermostAgentsConfigLink).toHaveAttribute(
                'href',
                '/admin_console/plugins/plugin_mattermost-ai',
            );

            // * Verify LibreTranslate-specific inputs are hidden for the Mattermost Agents provider
            await expect(systemConsolePage.localization.libreTranslateUrlInput).not.toBeVisible();
            await expect(systemConsolePage.localization.libreTranslateApiKeyInput).not.toBeVisible();
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

            await gotoLocalization(systemConsolePage);

            // Enable autotranslation first
            await systemConsolePage.localization.turnOnAutoTranslation();

            // Verify multiselect is visible
            await expect(systemConsolePage.localization.targetLanguagesMultiSelect).toBeVisible();
            await expect(systemConsolePage.localization.container.getByText('Languages allowed')).toBeVisible();

            // Select multiple languages (Spanish and French)
            const multiSelect = systemConsolePage.localization.targetLanguagesMultiSelect;
            const multiSelectInput = multiSelect.locator('input');
            const languageOptions = multiSelect.getByRole('option');

            // Open dropdown and select Spanish
            await multiSelectInput.click();
            await languageOptions.filter({hasText: /Español/}).click();

            // Dropdown closes after each selection — reopen it, then select French
            await multiSelectInput.click();
            await languageOptions.filter({hasText: /Français/}).click();

            // Close multiselect
            await multiSelect.press('Escape');

            // Verify both languages are selected by checking for their remove buttons in the multiselect
            const spanishChip = multiSelect.getByRole('button', {name: /Remove Español/});
            const frenchChip = multiSelect.getByRole('button', {name: /Remove Français/});

            await expect(spanishChip).toBeVisible();
            await expect(frenchChip).toBeVisible();
        },
    );
});
