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

import {expect, test, getAdminClient, licenseTier, GlobalClassificationBanner} from '@mattermost/playwright-lib';

import {
    CLASSIFICATION_MARKINGS_ADMIN_PATH,
    deleteClassificationMarkingsFieldIfExists,
    setClassificationMarkingsFeatureFlag,
    setupClassificationFieldWithGlobalBanner,
} from './classification_markings_helpers';

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

            const banner = new GlobalClassificationBanner(channelsPage.page);
            await expect(banner.bannerTop).not.toBeVisible();
            await expect(banner.bannerBottom).not.toBeVisible();

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

            const banner = new GlobalClassificationBanner(channelsPage.page);
            await expect(banner.bannerTop).not.toBeVisible();
            await expect(banner.bannerBottom).not.toBeVisible();

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
            await systemConsolePage.classificationMarkings.classificationEnabledTrue.click();
            await systemConsolePage.classificationMarkings.selectPreset('United States');

            // Enable global banner without selecting a level
            await systemConsolePage.classificationMarkings.globalBannerEnabledTrue.click();

            // Try to save
            await systemConsolePage.classificationMarkings.saveButton.click();

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

            const banner = new GlobalClassificationBanner(channelsPage.page);
            await expect(banner.bannerTop).toBeVisible();
            await expect(banner.bannerTop).toContainText('SECRET');
            await expect(banner.bannerTop).toHaveCSS('background-color', 'rgb(200, 16, 46)'); // #C8102E

            // Bottom banner should NOT be visible (placement is top only)
            await expect(banner.bannerBottom).not.toBeVisible();

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

            const banner = new GlobalClassificationBanner(channelsPage.page);

            await expect(banner.bannerTop).toBeVisible();
            await expect(banner.bannerTop).toContainText('TOP SECRET');

            await expect(banner.bannerBottom).toBeVisible();
            await expect(banner.bannerBottom).toContainText('TOP SECRET');

            // Both should have the same background color
            await expect(banner.bannerTop).toHaveCSS('background-color', 'rgb(252, 232, 58)'); // #FCE83A
            await expect(banner.bannerBottom).toHaveCSS('background-color', 'rgb(252, 232, 58)');

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

            const banner = new GlobalClassificationBanner(systemConsolePage.page);
            await expect(banner.bannerTop).toBeVisible();
            await expect(banner.bannerTop).toContainText('CONFIDENTIAL');

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

            const banner = new GlobalClassificationBanner(page);

            // Banner should be visible initially
            await expect(banner.bannerTop).toBeVisible();

            // Disable the global banner
            await systemConsolePage.classificationMarkings.globalBannerEnabledFalse.click();
            const saveBtn = systemConsolePage.classificationMarkings.saveButton;
            await saveBtn.click();
            await expect(saveBtn).toBeDisabled({timeout: 30000});

            // Banner should no longer be visible
            await expect(banner.bannerTop).not.toBeVisible();

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

            const banner = new GlobalClassificationBanner(page);

            // Initially only top banner
            await expect(banner.bannerTop).toBeVisible();
            await expect(banner.bannerBottom).not.toBeVisible();

            // Switch placement to top_and_bottom and save
            await systemConsolePage.classificationMarkings.globalBannerPlacementTopAndBottom.click();
            const saveBtn2 = systemConsolePage.classificationMarkings.saveButton;
            await saveBtn2.click();
            await expect(saveBtn2).toBeDisabled({timeout: 30000});

            // Both banners should now be visible
            await expect(banner.bannerTop).toBeVisible();
            await expect(banner.bannerBottom).toBeVisible();

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

            const banner = new GlobalClassificationBanner(page);

            // Both banners should be visible
            await expect(banner.bannerTop).toBeVisible();
            await expect(banner.bannerBottom).toBeVisible();

            // Disable classification markings entirely
            await systemConsolePage.classificationMarkings.classificationEnabledFalse.click();
            const saveBtn3 = systemConsolePage.classificationMarkings.saveButton;
            await saveBtn3.click();
            await expect(saveBtn3).toBeDisabled({timeout: 30000});

            // Banners should be gone
            await expect(banner.bannerTop).not.toBeVisible();
            await expect(banner.bannerBottom).not.toBeVisible();

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

            const userBanner = new GlobalClassificationBanner(userChannelsPage.page);
            await expect(userBanner.bannerTop).toBeVisible();
            await expect(userBanner.bannerTop).toContainText('UNCLASSIFIED');

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
            await expect(userBanner.bannerTop).toContainText('SECRET');
            await expect(userBanner.bannerTop).toHaveCSS('background-color', 'rgb(200, 16, 46)');

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

            const banner = new GlobalClassificationBanner(channelsPage.page);
            await expect(banner.bannerTop).toBeVisible();
            await expect(banner.bannerTop).toHaveCSS('color', 'rgb(0, 0, 0)');

            // Dark background (#000000) — text should be white (#FFFFFF)
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvltopsecret00000000000000', name: 'TOP SECRET', color: '#000000', rank: 1}],
                {levelId: 'lvltopsecret00000000000000', enabled: true, placement: 'top'},
            );

            await channelsPage.page.reload();
            await channelsPage.toBeVisible();

            await expect(banner.bannerTop).toBeVisible();
            await expect(banner.bannerTop).toHaveCSS('color', 'rgb(255, 255, 255)');

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );
});
