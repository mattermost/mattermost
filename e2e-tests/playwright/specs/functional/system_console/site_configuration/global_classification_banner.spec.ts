// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Global Classification Banner — end-to-end tests.
 * Validates that the banner component renders (or does not render) correctly
 * based on property field attrs: feature flag, enabled state, level selection, placement.
 *
 * These tests sit next to the classification_markings admin-page tests because
 * they share the same helpers and feature-flag gating.
 */

import type {Page} from '@playwright/test';

import {expect, test, getAdminClient, licenseTier} from '@mattermost/playwright-lib';

import {
    CLASSIFICATION_MARKINGS_ADMIN_PATH,
    deleteClassificationMarkingsFieldIfExists,
    setClassificationMarkingsFeatureFlag,
    setupClassificationFieldWithGlobalBanner,
} from './classification_markings_helpers';

const TOP_BANNER_SELECTOR = '[data-testid="global-classification-banner-top"]';
const BOTTOM_BANNER_SELECTOR = '[data-testid="global-classification-banner-bottom"]';

async function selectClassificationPreset(page: Page, optionLabel: string) {
    await page.getByTestId('classificationPreset').click();
    const menu = page.locator('.DropDown__menu');
    await expect(menu).toBeVisible();
    await menu.getByText(optionLabel, {exact: true}).click();
}

test.describe('Global Classification Banner', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await getAdminClient();
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
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, false);
            const {FeatureFlags} = await adminClient.getConfig();
            test.skip(
                FeatureFlags.ClassificationMarkings === true,
                'Feature flag cannot be disabled in this environment.',
            );

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            await expect(channelsPage.page.locator(TOP_BANNER_SELECTOR)).not.toBeVisible();
            await expect(channelsPage.page.locator(BOTTOM_BANNER_SELECTOR)).not.toBeVisible();

            // Restore the flag for subsequent tests
            await setClassificationMarkingsFeatureFlag(adminClient, true);
        },
    );

    /**
     * @objective Banner does not render when classifications are enabled and configured,
     * but the global banner toggle is still disabled.
     */
    test(
        'MM-T6221 global banner: not rendered when global banner toggle is disabled',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            // Set up classification levels but keep the global banner disabled
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvlsecret00000000000000000', name: 'SECRET', color: '#C8102E', rank: 2},
                ],
                {levelId: '', enabled: false, placement: 'top'},
            );

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            await expect(channelsPage.page.locator(TOP_BANNER_SELECTOR)).not.toBeVisible();
            await expect(channelsPage.page.locator(BOTTOM_BANNER_SELECTOR)).not.toBeVisible();

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );

    /**
     * @objective Enabling the global banner without selecting a level prevents saving.
     */
    test(
        'MM-T6222 global banner: save fails when enabled without selecting a level',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            // Enable classification markings and select a preset to have levels
            await page.locator('input[name="classificationEnabled"][value="true"]').click();
            await selectClassificationPreset(page, 'United States');

            // Enable global banner without selecting a level
            await page.locator('input[name="globalBannerEnabled"][value="true"]').click();

            // Try to save
            await page.getByRole('button', {name: 'Save', exact: true}).click();

            // Validation error is shown
            await expect(page.getByText(/A global classification level must be selected/i)).toBeVisible();
        },
    );

    /**
     * @objective After full setup, the top banner renders with the correct level name,
     * background color, and contrasting text color.
     */
    test(
        'MM-T6223 global banner: renders at top with correct text and color after full setup',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvlsecret00000000000000000', name: 'SECRET', color: '#C8102E', rank: 2},
                ],
                {levelId: 'lvlsecret00000000000000000', enabled: true, placement: 'top'},
            );

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            const topBanner = channelsPage.page.locator(TOP_BANNER_SELECTOR);
            await expect(topBanner).toBeVisible();
            await expect(topBanner).toContainText('SECRET');
            await expect(topBanner).toHaveCSS('background-color', 'rgb(200, 16, 46)'); // #C8102E

            // Bottom banner should NOT be visible (placement is top only)
            await expect(channelsPage.page.locator(BOTTOM_BANNER_SELECTOR)).not.toBeVisible();

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );

    /**
     * @objective Selecting "Top and bottom" placement renders both banners.
     */
    test(
        'MM-T6224 global banner: top and bottom banners render when placement is top_and_bottom',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvltopsecret00000000000000', name: 'TOP SECRET', color: '#FCE83A', rank: 1}],
                {levelId: 'lvltopsecret00000000000000', enabled: true, placement: 'top_and_bottom'},
            );

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            const topBanner = channelsPage.page.locator(TOP_BANNER_SELECTOR);
            const bottomBanner = channelsPage.page.locator(BOTTOM_BANNER_SELECTOR);

            await expect(topBanner).toBeVisible();
            await expect(topBanner).toContainText('TOP SECRET');

            await expect(bottomBanner).toBeVisible();
            await expect(bottomBanner).toContainText('TOP SECRET');

            // Both should have the same background color
            await expect(topBanner).toHaveCSS('background-color', 'rgb(252, 232, 58)'); // #FCE83A
            await expect(bottomBanner).toHaveCSS('background-color', 'rgb(252, 232, 58)');

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );

    /**
     * @objective Banner also renders on the admin console page.
     */
    test(
        'MM-T6225 global banner: renders on the admin console',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvlconfidential00000000000', name: 'CONFIDENTIAL', color: '#FFD700', rank: 1}],
                {levelId: 'lvlconfidential00000000000', enabled: true, placement: 'top'},
            );

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.goto();
            await systemConsolePage.page.waitForLoadState('networkidle');

            const topBanner = systemConsolePage.page.locator(TOP_BANNER_SELECTOR);
            await expect(topBanner).toBeVisible();
            await expect(topBanner).toContainText('CONFIDENTIAL');

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );

    /**
     * @objective Banner disappears after the admin disables it and saves.
     */
    test(
        'MM-T6226 global banner: disappears after being disabled via admin console',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvlrestricted0000000000000', name: 'RESTRICTED', color: '#FF8C00', rank: 1}],
                {levelId: 'lvlrestricted0000000000000', enabled: true, placement: 'top'},
            );

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            // Banner should be visible initially
            await expect(page.locator(TOP_BANNER_SELECTOR)).toBeVisible();

            // Disable the global banner
            await page.locator('input[name="globalBannerEnabled"][value="false"]').click();
            const saveBtn = page.getByRole('button', {name: 'Save', exact: true});
            await saveBtn.click();
            await expect(saveBtn).toBeDisabled({timeout: 30000});

            // Banner should no longer be visible
            await expect(page.locator(TOP_BANNER_SELECTOR)).not.toBeVisible();

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );

    /**
     * @objective Switching placement from top to top_and_bottom makes the bottom banner appear.
     */
    test(
        'MM-T6227 global banner: switching placement to top_and_bottom shows bottom banner',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvlsecret00000000000000000', name: 'SECRET', color: '#C8102E', rank: 1}],
                {
                    levelId: 'lvlsecret00000000000000000',
                    enabled: true,
                    placement: 'top',
                },
            );

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            // Initially only top banner
            await expect(page.locator(TOP_BANNER_SELECTOR)).toBeVisible();
            await expect(page.locator(BOTTOM_BANNER_SELECTOR)).not.toBeVisible();

            // Switch placement to top_and_bottom and save
            await page.locator('input[name="globalBannerPlacement"][value="false"]').click();
            const saveBtn2 = page.getByRole('button', {name: 'Save', exact: true});
            await saveBtn2.click();
            await expect(saveBtn2).toBeDisabled({timeout: 30000});

            // Both banners should now be visible
            await expect(page.locator(TOP_BANNER_SELECTOR)).toBeVisible();
            await expect(page.locator(BOTTOM_BANNER_SELECTOR)).toBeVisible();

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );

    /**
     * @objective Disabling classification markings entirely removes the banner even
     * if the global banner was previously configured.
     */
    test(
        'MM-T6228 global banner: cleared when classification markings are disabled',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvltopsecret00000000000000', name: 'TOP SECRET', color: '#FF0000', rank: 1}],
                {levelId: 'lvltopsecret00000000000000', enabled: true, placement: 'top_and_bottom'},
            );

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
            await page.waitForLoadState('networkidle');

            // Both banners should be visible
            await expect(page.locator(TOP_BANNER_SELECTOR)).toBeVisible();
            await expect(page.locator(BOTTOM_BANNER_SELECTOR)).toBeVisible();

            // Disable classification markings entirely
            await page.locator('input[name="classificationEnabled"][value="false"]').click();
            const saveBtn3 = page.getByRole('button', {name: 'Save', exact: true});
            await saveBtn3.click();
            await expect(saveBtn3).toBeDisabled({timeout: 30000});

            // Banners should be gone
            await expect(page.locator(TOP_BANNER_SELECTOR)).not.toBeVisible();
            await expect(page.locator(BOTTOM_BANNER_SELECTOR)).not.toBeVisible();

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );

    /**
     * @objective Changes made by an admin propagate to a non-admin user's banner
     * in real-time without requiring a page reload.
     */
    test(
        'MM-T6230 global banner: propagates to non-admin users via websocket',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminClient, user} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvlsecret00000000000000000', name: 'SECRET', color: '#C8102E', rank: 2},
                ],
                {levelId: 'lvlunclassified00000000000', enabled: true, placement: 'top'},
            );

            // Login the non-admin user
            const {channelsPage: userChannelsPage} = await pw.testBrowser.login(user);
            await userChannelsPage.goto();
            await userChannelsPage.toBeVisible();

            const userTopBanner = userChannelsPage.page.locator(TOP_BANNER_SELECTOR);
            await expect(userTopBanner).toBeVisible();
            await expect(userTopBanner).toContainText('UNCLASSIFIED');

            // Admin changes the banner level
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvlsecret00000000000000000', name: 'SECRET', color: '#C8102E', rank: 2},
                ],
                {levelId: 'lvlsecret00000000000000000', enabled: true, placement: 'top'},
            );

            // The non-admin user should see the updated banner via websocket
            await expect(userTopBanner).toContainText('SECRET');
            await expect(userTopBanner).toHaveCSS('background-color', 'rgb(200, 16, 46)');

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );

    /**
     * @objective Text color adapts for readability: dark text on light background,
     * white text on dark background.
     * Color is now derived from the level's color in attrs.options (not stored separately).
     */
    test(
        'MM-T6229 global banner: text color contrasts with background for readability',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            await setClassificationMarkingsFeatureFlag(adminClient, true);

            // Light background (#FFFFFF) — text should be dark (#000000)
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#FFFFFF', rank: 1}],
                {levelId: 'lvlunclassified00000000000', enabled: true, placement: 'top'},
            );

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();

            const topBanner = channelsPage.page.locator(TOP_BANNER_SELECTOR);
            await expect(topBanner).toBeVisible();
            await expect(topBanner).toHaveCSS('color', 'rgb(0, 0, 0)');

            // Dark background (#000000) — text should be white (#FFFFFF)
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvltopsecret00000000000000', name: 'TOP SECRET', color: '#000000', rank: 1}],
                {levelId: 'lvltopsecret00000000000000', enabled: true, placement: 'top'},
            );

            await channelsPage.page.reload();
            await channelsPage.toBeVisible();

            await expect(topBanner).toBeVisible();
            await expect(topBanner).toHaveCSS('color', 'rgb(255, 255, 255)');

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );
});
