// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Classification markings (Enterprise-tier license + ClassificationMarkings feature flag).
 * Covers admin UI for presets, save validation, preset-change confirmation, and custom preset detection.
 *
 * Local runs: upload or use a license with SkuShortName `enterprise`, `entry`, or `advanced`.
 * Professional-only licenses hide this admin route (React Router redirects to /admin_console/about/license).
 */

import {
    Api,
    expect,
    test,
    getAdminClient,
    licenseTier,
    duration,
    Msg,
    settle,
    type App,
} from '@mattermost/playwright-lib';

import {
    CLASSIFICATION_MARKINGS_ADMIN_PATH,
    deleteClassificationMarkingsFieldIfExists,
    setupClassificationFieldWithGlobalBanner,
} from './classification_markings_helpers';

async function openClassificationPage(app: App) {
    await app.page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
    await expect(app.admin.setting('classificationEnabled').container).toBeVisible();
}

/** The first level row, once the table shows one. */
async function firstLevel(app: App) {
    const {levels} = app.admin.classification;
    await expect.poll(async () => (await levels.rowList.keys()).length).toBeGreaterThan(0);
    const [key] = await levels.rowList.keys();
    return levels.row(key);
}

function exactOptionLabel(label: string): RegExp {
    return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

async function selectClassificationPreset(app: App, optionLabel: string) {
    const {preset} = app.admin.classification;
    await preset.controlButton.click();
    await expect(preset.menu.container).toBeVisible();
    const option = await preset.menu.optionList.itemWith({text: exactOptionLabel(optionLabel)});
    await option.select();
    await expect(preset.menu.container).not.toBeVisible();
}

async function deleteFirstLevel(app: App) {
    const {levels} = app.admin.classification;
    const before = await levels.rowList.keys();
    const first = await firstLevel(app);
    await first.deleteButton.click();
    await expect(levels.rowList).toHaveKeyCount(before.length - 1);
}

async function saveClassification(
    app: App,
    operation: typeof Api.CreatePropertyField | typeof Api.UpdatePropertyField,
) {
    const {savePanel} = app.admin.classification;
    await settle(savePanel.saveButton, {wait: operation}).click();
    await expect(savePanel.saveButton).toBeDisabled({timeout: duration.half_min});
}

test.describe('System Console - Classification markings', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('ClassificationMarkings', true);
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
            await adminClient.getPropertyFields('custom_profile_attributes', 'template', {targetType: 'system'});
        } catch {
            test.skip(
                true,
                'custom_profile_attributes property group not found on this server; skipping classification markings save tests.',
            );
        }
    });

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

            // # Clear any existing classification field
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            // # Log in and open the classification markings URL
            const {app} = await pw.testBrowser.login(adminUser);
            await openClassificationPage(app);

            // * URL stays on the classification markings section
            await expect(app.page).toHavePath(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            // * Page title is visible
            await expect(app.admin.header).toBeVisible();
            await expect(app.admin.header).toHaveText('Classification Markings');
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
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {app} = await pw.testBrowser.login(adminUser);
            const classification = app.admin.classification;
            await openClassificationPage(app);

            // # Enable classification markings without choosing a preset or adding levels
            await app.admin.setting('classificationEnabled').trueRadio.check();
            await expect(app.admin.setting('classificationEnabled').trueRadio).toBeChecked();
            await classification.savePanel.saveButton.click();

            // * Validation error is shown
            await expect(classification.savePanel.errorText).toBeVisible();
            await expect(classification.savePanel.errorText).toContainText(
                /At least one classification level is required/i,
            );
        },
    );

    /**
     * @objective Verify selecting a built-in preset and saving creates the classification field successfully.
     */
    // Selecting a preset creates a property field on the
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
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {app} = await pw.testBrowser.login(adminUser);
            const classification = app.admin.classification;
            await openClassificationPage(app);

            // # Enable markings and choose NATO preset
            await app.admin.setting('classificationEnabled').trueRadio.check();
            await expect(app.admin.setting('classificationEnabled').trueRadio).toBeChecked();
            await selectClassificationPreset(app, 'NATO');

            let firstLevelNameInput = (await firstLevel(app)).nameTextbox;
            // * Preset levels appear in the table
            await expect(firstLevelNameInput).toBeVisible();
            await expect(firstLevelNameInput).toHaveValue('NATO UNCLASSIFIED');

            // # Save
            await saveClassification(app, Api.CreatePropertyField);

            // * No server error and first level name is unchanged after save
            await expect(classification.savePanel.errorText).toBeEmpty();
            firstLevelNameInput = (await firstLevel(app)).nameTextbox;
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
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {app} = await pw.testBrowser.login(adminUser);
            const classification = app.admin.classification;
            await openClassificationPage(app);

            await app.admin.setting('classificationEnabled').trueRadio.check();
            await expect(app.admin.setting('classificationEnabled').trueRadio).toBeChecked();
            await selectClassificationPreset(app, 'UK (GSCP)');
            await saveClassification(app, Api.CreatePropertyField);

            // * UK preset first level is present
            await expect((await firstLevel(app)).nameTextbox).toHaveValue('OFFICIAL');

            // # Select a different preset while a field exists on the server
            await selectClassificationPreset(app, 'United States');

            // * Warning modal appears with expected copy
            await expect(classification.switchPresetModal.headingText).toHaveText('Change classification preset?');
            await expect(classification.switchPresetModal.messageText).toContainText(
                /Changing the classification preset will affect all existing classifications/i,
            );

            // # Confirm preset change
            await classification.switchPresetModal.confirmButton.click();

            // * Modal closes and US preset first level is shown
            await expect(classification.switchPresetModal.container).not.toBeVisible();
            await expect((await firstLevel(app)).nameTextbox).toHaveValue('UNCLASSIFIED');
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
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {app} = await pw.testBrowser.login(adminUser);
            const classification = app.admin.classification;
            await openClassificationPage(app);

            await app.admin.setting('classificationEnabled').trueRadio.check();
            await expect(app.admin.setting('classificationEnabled').trueRadio).toBeChecked();
            await selectClassificationPreset(app, 'Canada');
            await saveClassification(app, Api.CreatePropertyField);

            await expect((await firstLevel(app)).nameTextbox).toHaveValue('PROTECTED A');

            // # Remove one level from the saved preset
            await deleteFirstLevel(app);

            const presetControl = classification.preset;
            // * Preset selection switches to custom
            await expect(presetControl.container).toContainMessage(Msg.admin.classification_markings.preset.custom);

            // # Save custom levels
            await saveClassification(app, Api.UpdatePropertyField);

            // * No error and preset remains custom
            await expect(classification.savePanel.errorText).toBeEmpty();
            await expect(presetControl.container).toContainMessage(Msg.admin.classification_markings.preset.custom);
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

            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {app} = await pw.testBrowser.login(adminUser);
            await openClassificationPage(app);

            // * Global Classification Indicators section should NOT be visible before enabling
            await expect(app.admin.classification.globalIndicators.titleText).not.toBeVisible();

            // # Enable classification markings
            await app.admin.setting('classificationEnabled').trueRadio.check();
            await expect(app.admin.setting('classificationEnabled').trueRadio).toBeChecked();

            // * The section now appears
            await expect(app.admin.classification.globalIndicators.titleText).toBeVisible();
            await expect(app.admin.classification.globalIndicators.titleText).toHaveText(
                'Global Classification Indicators',
            );
            await expect(app.admin.classification.globalIndicators.subtitleText).toBeVisible();
            await expect(app.admin.classification.globalIndicators.subtitleText).toHaveText(
                'Configure the global classification banner',
            );
            await expect(app.admin.setting('globalBannerEnabled').labelText).toHaveText('Global Classification Banner');
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

            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {app, page} = await pw.testBrowser.login(adminUser);
            const classification = app.admin.classification;
            await openClassificationPage(app);

            // # Enable classification markings and select NATO preset
            await app.admin.setting('classificationEnabled').trueRadio.check();
            await expect(app.admin.setting('classificationEnabled').trueRadio).toBeChecked();
            await selectClassificationPreset(app, 'NATO');
            await expect((await firstLevel(app)).nameTextbox).toHaveValue('NATO UNCLASSIFIED');

            // # Enable the global banner
            await app.admin.setting('globalBannerEnabled').trueRadio.check();
            await expect(app.admin.setting('globalBannerEnabled').trueRadio).toBeChecked();

            // * Placement and level controls appear
            await expect(app.admin.setting('globalBannerPlacement').labelText).toHaveText('Banner visibility');
            await expect(app.admin.setting('DropdownInput_globalBannerLevel').labelText).toHaveText(
                'Global classification level',
            );

            // # Select "Top and bottom" for placement
            await app.admin.setting('globalBannerPlacement').falseRadio.check();
            await expect(app.admin.setting('globalBannerPlacement').falseRadio).toBeChecked();

            // # Pick the first level (NATO UNCLASSIFIED) from the level dropdown
            await classification.globalBannerLevel.controlButton.click();
            const dropdownMenu = classification.globalBannerLevel.menu;
            await expect(dropdownMenu.container).toBeVisible();
            await (await dropdownMenu.optionList.itemWith({text: exactOptionLabel('NATO UNCLASSIFIED')})).select();
            await expect(dropdownMenu.container).not.toBeVisible();

            // # Save
            const saveButton = classification.savePanel.saveButton;
            await saveClassification(app, Api.CreatePropertyField);

            // Wait for the save to fully complete: the button becomes disabled once
            // the async persistLevels flow finishes and hasChanges resets to false.
            // networkidle alone is unreliable because there is a JS processing gap
            // between the re-fetch GETs and the subsequent POST/PATCH calls.
            await expect(saveButton).toBeDisabled({timeout: duration.half_min});

            // * No save error
            await expect(classification.savePanel.errorText).toBeEmpty();

            // # Reload the page
            await page.reload();

            // * Banner configuration persisted: enabled, top_and_bottom, NATO UNCLASSIFIED selected.
            // The linked field + property value fetch is async; wait for the level dropdown
            // (only rendered when the banner is enabled) as the hydration signal.
            await expect(classification.globalBannerLevel.container).toContainText('NATO UNCLASSIFIED', {
                timeout: duration.half_min,
            });
            await expect(app.admin.setting('globalBannerEnabled').trueRadio).toBeChecked();
            await expect(app.admin.setting('globalBannerPlacement').falseRadio).toBeChecked();
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

            // # Seed a field and banner config via API (skip the UI save step)
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'natounclassified0000000000', name: 'NATO UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'nato-restricted', name: 'NATO RESTRICTED', color: '#FFD700', rank: 2},
                ],
                {levelId: 'natounclassified0000000000', enabled: true, placement: 'top'},
            );

            const {app, page} = await pw.testBrowser.login(adminUser);
            const classification = app.admin.classification;
            await openClassificationPage(app);

            // * Placement inputs are editable
            await expect(app.admin.setting('globalBannerPlacement').trueRadio).not.toBeDisabled();

            // * Delete buttons for saved level rows are not disabled by a lock
            await expect((await firstLevel(app)).deleteButton).not.toBeDisabled();

            // # Switch placement to "top_and_bottom" and save
            await app.admin.setting('globalBannerPlacement').falseRadio.check();
            await expect(app.admin.setting('globalBannerPlacement').falseRadio).toBeChecked();
            const saveButton = classification.savePanel.saveButton;
            await saveClassification(app, Api.UpdatePropertyField);
            await expect(saveButton).toBeDisabled({timeout: duration.half_min});

            // * No server error
            await expect(classification.savePanel.errorText).toBeEmpty();

            // # Reload and verify the new placement persisted
            await page.reload();
            await expect(app.admin.setting('globalBannerPlacement').falseRadio).toBeChecked({
                timeout: duration.half_min,
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

            // # Seed two levels and a banner pointing at the first one
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvlconfidential00000000000', name: 'CONFIDENTIAL', color: '#FFD700', rank: 2},
                ],
                {levelId: 'lvlunclassified00000000000', enabled: true, placement: 'top'},
            );

            const {app} = await pw.testBrowser.login(adminUser);
            const classification = app.admin.classification;
            await openClassificationPage(app);

            // # Delete the level used by the banner (first row)
            await deleteFirstLevel(app);

            // # Try to save — banner still references the deleted level
            await classification.savePanel.saveButton.click();

            // * Validation error is shown
            await expect(classification.savePanel.errorText).toBeVisible();
            await expect(classification.savePanel.errorText).toContainText(
                /The global classification banner is configured with a level that no longer exists/i,
            );

            // # Pick a valid replacement level (click the react-select control directly)
            await classification.globalBannerLevel.controlButton.click();
            const dropdownMenu = classification.globalBannerLevel.menu;
            await expect(dropdownMenu.container).toBeVisible();
            await (await dropdownMenu.optionList.itemWith({text: exactOptionLabel('CONFIDENTIAL')})).select();
            await expect(dropdownMenu.container).not.toBeVisible();

            // # Save again
            const saveButton = classification.savePanel.saveButton;
            await saveClassification(app, Api.UpdatePropertyField);
            await expect(saveButton).toBeDisabled({timeout: duration.half_min});

            // * No save error and banner now references the replacement level
            await expect(classification.savePanel.errorText).toBeEmpty();
            await expect(classification.globalBannerLevel.container).toContainText('CONFIDENTIAL');

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

            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {app, page} = await pw.testBrowser.login(adminUser);
            const classification = app.admin.classification;
            await openClassificationPage(app);

            // # Enable classification markings and select NATO preset
            await app.admin.setting('classificationEnabled').trueRadio.check();
            await expect(app.admin.setting('classificationEnabled').trueRadio).toBeChecked();
            await selectClassificationPreset(app, 'NATO');

            const presetControl = classification.preset;
            await expect(presetControl.container).toContainText('NATO');

            // # Rename the first level — this should switch to Custom
            const firstLevelInput = (await firstLevel(app)).nameTextbox;
            await firstLevelInput.clear();
            await firstLevelInput.fill('MY CUSTOM LEVEL');

            // * Preset dropdown should now show "Custom classification levels"
            await expect(presetControl.container).toContainMessage(Msg.admin.classification_markings.preset.custom);

            // # Open the preset dropdown and verify "Custom classification levels" is listed
            await presetControl.controlButton.click();
            const menu = classification.preset.menu;
            await expect(menu.container).toBeVisible();
            await expect(
                await menu.optionList.itemWith({text: exactOptionLabel('Custom classification levels')}),
            ).toBeVisible();
            const optionCountWithCustom = (await menu.optionList.keys()).length;

            // # Select a real preset (Canada) — should show the confirmation modal
            await (await menu.optionList.itemWith({text: exactOptionLabel('Canada')})).select();
            await expect(menu.container).not.toBeVisible();
            await expect(classification.switchPresetModal.headingText).toHaveText('Change classification preset?');

            // # Confirm the preset change
            await classification.switchPresetModal.confirmButton.click();

            // * Dropdown now shows Canada, no longer Custom
            await expect(presetControl.container).toContainText('Canada');

            // # Open the dropdown again and verify Custom is no longer listed
            await presetControl.controlButton.click();
            const menuAfterSwitch = classification.preset.menu;
            await expect(menuAfterSwitch.container).toBeVisible();
            // The options are keyed by position, so an absent Custom option shows as one option fewer.
            await expect(menuAfterSwitch.optionList).toHaveKeyCount(optionCountWithCustom - 1);

            // # Close menu by pressing Escape
            await page.keyboard.press('Escape');
            await expect(menuAfterSwitch.container).not.toBeVisible();

            // # Delete a level from the Canada preset
            await deleteFirstLevel(app);

            // * Should switch back to Custom
            await expect(presetControl.container).toContainMessage(Msg.admin.classification_markings.preset.custom);
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

            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {app} = await pw.testBrowser.login(adminUser);
            const classification = app.admin.classification;
            await openClassificationPage(app);

            // # Enable classification markings, select NATO preset (provides levels)
            await app.admin.setting('classificationEnabled').trueRadio.check();
            await expect(app.admin.setting('classificationEnabled').trueRadio).toBeChecked();
            await selectClassificationPreset(app, 'NATO');

            // # Enable the global banner without picking a level
            await app.admin.setting('globalBannerEnabled').trueRadio.check();
            await expect(app.admin.setting('globalBannerEnabled').trueRadio).toBeChecked();

            // # Try to save — no level selected in the dropdown
            await classification.savePanel.saveButton.click();

            // * Validation error is shown
            await expect(classification.savePanel.errorText).toBeVisible();
            await expect(classification.savePanel.errorText).toContainText(
                /A global classification level must be selected/i,
            );
        },
    );
});
