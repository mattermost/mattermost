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
    setupClassificationFieldWithGlobalBanner,
} from './classification_markings_helpers';

async function selectClassificationPreset(page: Page, optionLabel: string) {
    await page.getByTestId('classificationPreset').click();
    const menu = page.locator('.DropDown__menu');
    await expect(menu).toBeVisible();
    await menu.getByText(optionLabel, {exact: true}).click();
}

test.describe('System Console - Classification markings', () => {
    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient({skipLog: true});
        await setClassificationMarkingsFeatureFlag(adminClient, true);
        const config = await adminClient.getConfig();
        test.skip(
            config.FeatureFlags?.ClassificationMarkings !== true &&
                config.FeatureFlags?.ClassificationMarkings !== 'true',
            'ClassificationMarkings feature flag is off (probably overridden by env); skipping.',
        );
    });

    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await getAdminClient();
        const license = await adminClient.getClientLicenseOld();
        test.skip(
            licenseTier(license.SkuShortName) < 20,
            'Classification markings requires Enterprise-tier license (SkuShortName enterprise, entry, or advanced). Professional/trial Professional is not sufficient—the admin route is hidden and redirects to /admin_console/about/license.',
        );

        // Skip if the custom_profile_attributes property group is absent on this server.
        // The group must exist (seeded by the server) before classification markings can be saved;
        // the API returns "The specified property group was not found." otherwise.
        try {
            await adminClient.getPropertyFields('custom_profile_attributes', 'template', 'system');
        } catch {
            test.skip(
                true,
                'custom_profile_attributes property group not found on this server; skipping classification markings save tests.',
            );
        }
    });

    /**
     * @objective Ensure the classification markings admin route is unavailable when the feature flag is off (when the server allows disabling it).
     */
    test(
        'MM-T6201 classification markings: feature flag off redirects away from admin URL',
        {tag: ['@system_console', '@classification_markings']},
        async ({pw}) => {
            const {adminUser, adminClient} = await getAdminClient();

            if (!adminUser || !adminClient) {
                throw new Error('Failed to get admin user');
            }

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
            const {adminUser, adminClient} = await getAdminClient();

            if (!adminUser || !adminClient) {
                throw new Error('Failed to get admin user');
            }

            // # Enable flag and clear any existing classification field
            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            // # Log in and open the classification markings URL
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);

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
            const {adminUser, adminClient} = await getAdminClient();

            if (!adminUser || !adminClient) {
                throw new Error('Failed to get admin user');
            }

            // # Enable feature flag and ensure no classification field exists
            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);

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
            const {adminUser, adminClient} = await getAdminClient();

            if (!adminUser || !adminClient) {
                throw new Error('Failed to get admin user');
            }

            // # Enable flag and start from no classification field
            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);

            // # Enable markings and choose NATO preset
            await page.locator('input[name="classificationEnabled"][value="true"]').click();
            await selectClassificationPreset(page, 'NATO');

            const firstLevelNameInput = page.getByLabel('Classification level name').first();
            // * Preset levels appear in the table
            await expect(firstLevelNameInput).toBeVisible();
            await expect(firstLevelNameInput).toHaveValue('NATO UNCLASSIFIED');

            // # Save
            await page.getByRole('button', {name: 'Save', exact: true}).click();

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
            const {adminUser, adminClient} = await getAdminClient();

            if (!adminUser || !adminClient) {
                throw new Error('Failed to get admin user');
            }

            // # Enable flag and clear field, then prepare saved UK levels
            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);

            await page.locator('input[name="classificationEnabled"][value="true"]').click();
            await selectClassificationPreset(page, 'UK (GSCP)');
            await page.getByRole('button', {name: 'Save', exact: true}).click();

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
            const {adminUser, adminClient} = await getAdminClient();

            if (!adminUser || !adminClient) {
                throw new Error('Failed to get admin user');
            }

            // # Enable flag and save Canada preset as baseline
            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);

            await page.locator('input[name="classificationEnabled"][value="true"]').click();
            await selectClassificationPreset(page, 'Canada');
            await page.getByRole('button', {name: 'Save', exact: true}).click();

            await expect(page.getByLabel('Classification level name').first()).toHaveValue('PROTECTED A');

            // # Remove one level from the saved preset
            await page.getByRole('button', {name: 'Delete level'}).first().click();

            const presetControl = page.getByTestId('classificationPreset');
            // * Preset selection switches to custom
            await expect(presetControl).toContainText('Custom classification levels');

            // # Save custom levels
            await page.getByRole('button', {name: 'Save', exact: true}).click();

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
            await expect(page.getByText('Global Classification Banner', {exact: true})).toBeVisible();
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
            const saveButton = page.getByRole('button', {name: 'Save', exact: true});
            await saveButton.click();

            // Wait for the save to fully complete: the button becomes disabled once
            // the async persistLevels flow finishes and hasChanges resets to false.
            // networkidle alone is unreliable because there is a JS processing gap
            // between the re-fetch GETs and the subsequent POST/PATCH calls.
            await expect(saveButton).toBeDisabled({timeout: 30000});

            // * No save error
            await expect(page.locator('.admin-console-save .error-message')).toBeEmpty();

            // # Reload the page
            await page.reload();
            await page.waitForLoadState('networkidle');

            // * Banner configuration persisted: enabled, top_and_bottom, NATO UNCLASSIFIED selected.
            // The linked field + property value fetch is async; wait for the level dropdown
            // (only rendered when the banner is enabled) as the hydration signal.
            await expect(page.getByTestId('globalBannerLevel')).toContainText('NATO UNCLASSIFIED', {timeout: 30000});
            await expect(page.locator('input[name="globalBannerEnabled"][value="true"]')).toBeChecked();
            await expect(page.locator('input[name="globalBannerPlacement"][value="false"]')).toBeChecked();
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
                    {id: 'natounclassified0000000000', name: 'NATO UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'nato-restricted', name: 'NATO RESTRICTED', color: '#FFD700', rank: 2},
                ],
                {levelId: 'natounclassified0000000000', enabled: true, placement: 'top'},
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
            const saveButton = page.getByRole('button', {name: 'Save', exact: true});
            await saveButton.click();
            await expect(saveButton).toBeDisabled({timeout: 30000});

            // * No server error
            await expect(page.locator('.admin-console-save .error-message')).toBeEmpty();

            // # Reload and verify the new placement persisted
            await page.reload();
            await page.waitForLoadState('networkidle');
            await expect(page.locator('input[name="globalBannerPlacement"][value="false"]')).toBeChecked({
                timeout: 30000,
            });

            await deleteClassificationMarkingsFieldIfExists(adminClient);
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
                    {id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvlconfidential00000000000', name: 'CONFIDENTIAL', color: '#FFD700', rank: 2},
                ],
                {levelId: 'lvlunclassified00000000000', enabled: true, placement: 'top'},
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

            // # Pick a valid replacement level (click the react-select control directly)
            await page.getByTestId('globalBannerLevel').locator('.DropDown__control').click();
            const dropdownMenu = page.locator('.DropDown__menu').last();
            await expect(dropdownMenu).toBeVisible();
            await dropdownMenu.getByText('CONFIDENTIAL', {exact: true}).click();

            // # Save again
            const saveButton = page.getByRole('button', {name: 'Save', exact: true});
            await saveButton.click();
            await expect(saveButton).toBeDisabled({timeout: 30000});

            // * No save error and banner now references the replacement level
            await expect(page.locator('.admin-console-save .error-message')).toBeEmpty();
            await expect(page.getByTestId('globalBannerLevel')).toContainText('CONFIDENTIAL');

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );

    /**
     * @objective Verify that modifying a preset's levels (rename, delete, add) automatically
     * switches the dropdown to "Custom classification levels", and selecting a real preset
     * again removes the Custom option from the dropdown.
     */
    test(
        'MM-T6212 classification markings: modifying a preset switches dropdown to Custom',
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

            const presetControl = page.getByTestId('classificationPreset');
            await expect(presetControl).toContainText('NATO');

            // # Rename the first level — this should switch to Custom
            const firstLevelInput = page.getByLabel('Classification level name').first();
            await firstLevelInput.clear();
            await firstLevelInput.fill('MY CUSTOM LEVEL');

            // * Preset dropdown should now show "Custom classification levels"
            await expect(presetControl).toContainText('Custom classification levels');

            // # Open the preset dropdown and verify "Custom classification levels" is listed
            await presetControl.click();
            const menu = page.locator('.DropDown__menu');
            await expect(menu).toBeVisible();
            await expect(menu.getByText('Custom classification levels', {exact: true})).toBeVisible();

            // # Select a real preset (Canada) — should show the confirmation modal
            await menu.getByText('Canada', {exact: true}).click();
            await expect(page.getByText('Change classification preset?')).toBeVisible();

            // # Confirm the preset change
            await page.getByRole('button', {name: 'Change preset'}).click();

            // * Dropdown now shows Canada, no longer Custom
            await expect(presetControl).toContainText('Canada');

            // # Open the dropdown again and verify Custom is no longer listed
            await presetControl.click();
            const menuAfterSwitch = page.locator('.DropDown__menu');
            await expect(menuAfterSwitch).toBeVisible();
            await expect(menuAfterSwitch.getByText('Custom classification levels', {exact: true})).not.toBeVisible();

            // # Close menu by pressing Escape
            await page.keyboard.press('Escape');

            // # Delete a level from the Canada preset
            await page.getByRole('button', {name: 'Delete level'}).first().click();

            // * Should switch back to Custom
            await expect(presetControl).toContainText('Custom classification levels');
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
            await expect(page.getByText(/A global classification level must be selected/i)).toBeVisible();
        },
    );
});
