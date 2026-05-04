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
    setClassificationMarkingsFeatureFlag,
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
    // Skipped: master regression. The CM frontend creates a property field on the
    // `custom_profile_attributes` group, registered as PSAv1 in server.go, but
    // the API rejects v1 groups since #36171 ("PSAv2 generic APIs blacklist").
    // Re-enable once the CPA group is migrated to v2 (or v1 template/system
    // creates are allowed, mirroring the patch-route FIXME at properties.go:299).
    test.skip(
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
    // Skipped: see MM-T6204 — saving a preset hits the v2_group_not_found check.
    test.skip(
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
    // Skipped: see MM-T6204 — saving a preset hits the v2_group_not_found check.
    test.skip(
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
});
