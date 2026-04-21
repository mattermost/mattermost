// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Classification markings (Enterprise-tier license + ClassificationMarkings feature flag).
 * Covers admin UI for presets, save validation, preset-change confirmation, and custom preset detection.
 *
 * Local runs: upload or use a license with SkuShortName `enterprise`, `entry`, or `advanced`.
 * Professional-only licenses hide this admin route (React Router redirects to /admin_console/about/license).
 */

import type {Page} from '@playwright/test';

import {expect, test, getAdminClient, licenseTier} from '@mattermost/playwright-lib';

import {
    CLASSIFICATION_MARKINGS_ADMIN_PATH,
    deleteClassificationMarkingsFieldIfExists,
    resetGlobalBannerConfig,
    setClassificationMarkingsFeatureFlag,
    setupClassificationFieldWithGlobalBanner,
} from './classification_markings_helpers';

async function selectClassificationPreset(page: Page, optionLabel: string) {
    await page.getByTestId('classificationPreset').click();
    const menu = page.locator('.DropDown__menu');
    await expect(menu).toBeVisible();
    await menu.getByText(optionLabel, {exact: true}).click();
}

test.describe('System Console - Classification markings', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await getAdminClient();
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            licenseTier(license.SkuShortName) < 20,
            'Classification markings requires Enterprise-tier license (SkuShortName enterprise, entry, or advanced). Professional/trial Professional is not sufficient—the admin route is hidden and redirects to /admin_console/about/license.',
        );
    });

    /**
     * @objective Ensure the classification markings admin route is unavailable when the feature flag is off (when the server allows disabling it).
     */
    test(
        'MM-T6201 classification markings: feature flag off redirects away from admin URL',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            // # Turn off ClassificationMarkings in server config
            await setClassificationMarkingsFeatureFlag(adminClient, false);
            const {FeatureFlags} = await adminClient.getConfig();
            test.skip(
                FeatureFlags.ClassificationMarkings === true,
                'ClassificationMarkings stays enabled (e.g. MM_FEATUREFLAGS or split-key overrides); cannot assert flag-off in this environment.',
            );

            // # Open system console and navigate directly to the classification markings path
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await systemConsolePage.page.waitForLoadState('networkidle');

            // * User is redirected away from the hidden route (no Route registered)
            await expect(systemConsolePage.page).not.toHaveURL(/classification_markings/);
            // * Classification markings page title is not shown
            await expect(systemConsolePage.page.getByText('Classification Markings').first()).not.toBeVisible();
        },
    );

    /**
     * @objective Ensure the classification markings page is reachable when the feature flag is on.
     */
    test(
        'MM-T6202 classification markings: feature flag on loads configuration page',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            // # Enable flag and clear any existing classification field
            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            // # Log in and open the classification markings URL
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await systemConsolePage.page.waitForLoadState('networkidle');

            // * URL stays on the classification markings section
            await expect(systemConsolePage.page).toHaveURL(/classification_markings/);
            // * Page title is visible
            await expect(systemConsolePage.page.getByText('Classification Markings').first()).toBeVisible();
        },
    );

    /**
     * @objective Validate that enabling classification without any levels shows a save error.
     */
    test(
        'MM-T6203 classification markings: save fails when enabled with zero levels',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            // # Enable feature flag and ensure no classification field exists
            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await systemConsolePage.page.waitForLoadState('networkidle');

            // # Enable classification markings without choosing a preset or adding levels
            await systemConsolePage.page.locator('input[name="classificationEnabled"][value="true"]').click();
            await systemConsolePage.page.getByRole('button', {name: 'Save', exact: true}).click();

            // * Validation error is shown
            await expect(
                systemConsolePage.page.getByText(/At least one classification level is required/i),
            ).toBeVisible();
        },
    );

    /**
     * @objective Verify selecting a built-in preset and saving creates the classification field successfully.
     */
    test(
        'MM-T6204 classification markings: select NATO preset and save',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            // # Enable flag and start from no classification field
            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            // # Enable markings and choose NATO preset
            await page.locator('input[name="classificationEnabled"][value="true"]').click();
            await selectClassificationPreset(page, 'NATO');

            const firstLevelNameInput = page.getByLabel('Classification level name').first();
            // * Preset levels appear in the table
            await expect(firstLevelNameInput).toHaveValue('NATO UNCLASSIFIED');

            // # Save
            await page.getByRole('button', {name: 'Save', exact: true}).click();
            await page.waitForLoadState('networkidle');

            // * No server error and first level name is unchanged after save
            await expect(page.locator('.admin-console-save .error-message')).toBeEmpty();
            await expect(firstLevelNameInput).toHaveValue('NATO UNCLASSIFIED');
        },
    );

    /**
     * @objective When a classification field already exists, changing preset shows a warning modal; confirming applies the new preset.
     */
    test(
        'MM-T6205 classification markings: preset change shows confirm modal then applies',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            // # Enable flag and clear field, then prepare saved UK levels
            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            await page.locator('input[name="classificationEnabled"][value="true"]').click();
            await selectClassificationPreset(page, 'UK (GSCP)');
            await page.getByRole('button', {name: 'Save', exact: true}).click();
            await page.waitForLoadState('networkidle');

            // * UK preset first level is present
            await expect(page.getByLabel('Classification level name').first()).toHaveValue('OFFICIAL');

            // # Select a different preset while a field exists on the server
            await selectClassificationPreset(page, 'United States');

            // * Warning modal appears with expected copy
            await expect(page.getByText('Change classification preset?')).toBeVisible();
            await expect(
                page.getByText(/Changing the classification preset will affect all existing classifications/i),
            ).toBeVisible();

            // # Confirm preset change
            await page.getByRole('button', {name: 'Change preset'}).click();

            // * Modal closes and US preset first level is shown
            await expect(page.getByText('Change classification preset?')).not.toBeVisible();
            await expect(page.getByLabel('Classification level name').first()).toHaveValue('UNCLASSIFIED');
        },
    );

    /**
     * @objective After saving a preset, deleting a level switches the preset dropdown to Custom and save still succeeds.
     */
    test(
        'MM-T6206 classification markings: delete level switches to custom and saves',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            // # Enable flag and save Canada preset as baseline
            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            await page.locator('input[name="classificationEnabled"][value="true"]').click();
            await selectClassificationPreset(page, 'Canada');
            await page.getByRole('button', {name: 'Save', exact: true}).click();
            await page.waitForLoadState('networkidle');

            await expect(page.getByLabel('Classification level name').first()).toHaveValue('PROTECTED A');

            // # Remove one level from the saved preset
            await page.getByRole('button', {name: 'Delete level'}).first().click();

            const presetControl = page.getByTestId('classificationPreset');
            // * Preset selection switches to custom
            await expect(presetControl).toContainText('Custom classification levels');

            // # Save custom levels
            await page.getByRole('button', {name: 'Save', exact: true}).click();
            await page.waitForLoadState('networkidle');

            // * No error and preset remains custom
            await expect(page.locator('.admin-console-save .error-message')).toBeEmpty();
            await expect(presetControl).toContainText('Custom classification levels');
        },
    );

    /**
     * @objective Global Classification Indicators section appears when classification is enabled.
     */
    test(
        'MM-T6207 classification markings: global banner section visible when enabled',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            // * Global Classification Indicators section should NOT be visible before enabling
            await expect(page.getByText('Global Classification Indicators')).not.toBeVisible();

            // # Enable classification markings
            await page.locator('input[name="classificationEnabled"][value="true"]').click();

            // * The section now appears
            await expect(page.getByText('Global Classification Indicators')).toBeVisible();
            await expect(page.getByText('Configure the global classification banner')).toBeVisible();
            await expect(page.getByText('Global Classification Banner')).toBeVisible();
        },
    );

    /**
     * @objective Enabling the global banner shows placement and level controls; saving a level
     * persists the configuration and loads it back correctly on page reload.
     */
    test(
        'MM-T6208 classification markings: enable global banner, select level, save, and reload',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            // # Enable classification markings and select NATO preset
            await page.locator('input[name="classificationEnabled"][value="true"]').click();
            await selectClassificationPreset(page, 'NATO');
            await expect(page.getByLabel('Classification level name').first()).toHaveValue('NATO UNCLASSIFIED');

            // # Enable the global banner
            await page.locator('input[name="globalBannerEnabled"][value="true"]').click();

            // * Placement and level controls appear
            await expect(page.getByText('Banner visibility')).toBeVisible();
            await expect(page.getByText('Global classification level')).toBeVisible();

            // # Select "Top and bottom" for placement
            await page.locator('input[name="globalBannerPlacement"][value="false"]').click();

            // # Pick the first level (NATO UNCLASSIFIED) from the level dropdown
            await page.getByTestId('globalBannerLevel').click();
            const dropdownMenu = page.locator('.DropDown__menu').last();
            await expect(dropdownMenu).toBeVisible();
            await dropdownMenu.getByText('NATO UNCLASSIFIED', {exact: true}).click();

            // # Save
            await page.getByRole('button', {name: 'Save', exact: true}).click();
            await page.waitForLoadState('networkidle');

            // * No save error
            await expect(page.locator('.admin-console-save .error-message')).toBeEmpty();

            // # Reload the page
            await page.reload();
            await page.waitForLoadState('networkidle');

            // * Banner configuration persisted: enabled, top_and_bottom, NATO UNCLASSIFIED selected
            await expect(page.locator('input[name="globalBannerEnabled"][value="true"]')).toBeChecked();
            await expect(page.locator('input[name="globalBannerPlacement"][value="false"]')).toBeChecked();
            await expect(page.getByTestId('globalBannerLevel')).toContainText('NATO UNCLASSIFIED');
        },
    );

    /**
     * @objective Placement and level controls remain editable after a banner level has been
     * persisted — the write-once lock behavior no longer exists.
     */
    test(
        'MM-T6209 classification markings: global banner placement and level remain editable after save',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            // # Seed a field and banner config via API (skip the UI save step)
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'nato-unclassified', name: 'NATO UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'nato-restricted', name: 'NATO RESTRICTED', color: '#FFD700', rank: 2},
                ],
                {levelId: 'nato-unclassified', enabled: true, placement: 'top'},
            );

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            // * No locked notice should be present
            await expect(page.getByText(/Global classification placement and level are locked/)).not.toBeVisible();

            // * Placement inputs are editable
            await expect(page.locator('input[name="globalBannerPlacement"]').first()).not.toBeDisabled();

            // * Delete buttons for saved level rows are not disabled by a lock
            await expect(page.getByRole('button', {name: 'Delete level'}).first()).not.toBeDisabled();

            // # Switch placement to "top_and_bottom" and save
            await page.locator('input[name="globalBannerPlacement"][value="false"]').click();
            await page.getByRole('button', {name: 'Save', exact: true}).click();
            await page.waitForLoadState('networkidle');

            // * No server error
            await expect(page.locator('.admin-console-save .error-message')).toBeEmpty();

            // # Reload and verify the new placement persisted
            await page.reload();
            await page.waitForLoadState('networkidle');
            await expect(page.locator('input[name="globalBannerPlacement"][value="false"]')).toBeChecked();

            await resetGlobalBannerConfig(adminClient);
        },
    );

    /**
     * @objective When the level currently referenced by the global banner is removed, saving
     * surfaces a validation error forcing the admin to pick a valid level.
     */
    test(
        'MM-T6210 classification markings: deleting referenced banner level blocks save until resolved',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            // # Seed two levels and a banner pointing at the first one
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'lvl-unclassified', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvl-confidential', name: 'CONFIDENTIAL', color: '#FFD700', rank: 2},
                ],
                {levelId: 'lvl-unclassified', enabled: true, placement: 'top'},
            );

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            // # Delete the level used by the banner (first row)
            await page.getByRole('button', {name: 'Delete level'}).first().click();

            // # Try to save — banner still references the deleted level
            await page.getByRole('button', {name: 'Save', exact: true}).click();

            // * Validation error is shown
            await expect(
                page.getByText(/The global classification banner is configured with a level that no longer exists/i),
            ).toBeVisible();

            // # Pick a valid replacement level
            await page.getByTestId('globalBannerLevel').click();
            const dropdownMenu = page.locator('.DropDown__menu').last();
            await expect(dropdownMenu).toBeVisible();
            await dropdownMenu.getByText('CONFIDENTIAL', {exact: true}).click();

            // # Save again
            await page.getByRole('button', {name: 'Save', exact: true}).click();
            await page.waitForLoadState('networkidle');

            // * No save error and banner now references the replacement level
            await expect(page.locator('.admin-console-save .error-message')).toBeEmpty();
            await expect(page.getByTestId('globalBannerLevel')).toContainText('CONFIDENTIAL');

            await resetGlobalBannerConfig(adminClient);
        },
    );

    /**
     * @objective Validate that saving with global banner enabled but no level selected shows an error.
     */
    test(
        'MM-T6211 classification markings: save fails when global banner enabled without a level',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            // # Enable classification markings, select NATO preset (provides levels)
            await page.locator('input[name="classificationEnabled"][value="true"]').click();
            await selectClassificationPreset(page, 'NATO');

            // # Enable the global banner without picking a level
            await page.locator('input[name="globalBannerEnabled"][value="true"]').click();

            // # Try to save — no level selected in the dropdown
            await page.getByRole('button', {name: 'Save', exact: true}).click();

            // * Validation error is shown
            await expect(
                page.getByText(/A global classification level must be selected/i),
            ).toBeVisible();
        },
    );
});
