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

import type {UserProfile} from '@mattermost/types/users';

import {
    expect,
    getAdminClient,
    licenseTier,
    openChannel,
    test,
    type App,
    type PlaywrightExtended,
    duration,
    DefaultChannel,
} from '@mattermost/playwright-lib';

import {
    CLASSIFICATION_MARKINGS_ADMIN_PATH,
    deleteClassificationMarkingsFieldIfExists,
    setupClassificationFieldWithGlobalBanner,
} from './classification_markings_helpers';

/** Logs the admin in on System Console > Classification Markings, waiting for its form. */
async function openClassificationMarkings(pw: PlaywrightExtended, admin: UserProfile) {
    const {app} = await pw.testBrowser.login(admin);
    await app.page.goto(CLASSIFICATION_MARKINGS_ADMIN_PATH);
    await expect(app.admin.setting('classificationEnabled').trueRadio).toBeVisible();
    return app;
}

/** Saves the Classification Markings page, waiting for Save to settle. */
async function save(app: App) {
    const {saveButton} = app.admin.classification.savePanel;
    await saveButton.click();
    await expect(saveButton).toBeSaved({timeout: duration.half_min});
    await expect(saveButton).toBeDisabled();
}

test.describe('Global Classification Banner', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('ClassificationMarkings', true);
        await pw.skipIfNoLicense();
        const {adminClient} = await getAdminClient();
        const license = await adminClient.getClientLicenseOld();
        test.skip(licenseTier(license.SkuShortName) < 20, 'Classification markings requires Enterprise-tier license.');
    });

    /**
     * @objective Banner does not render when classifications are enabled and configured,
     * but the global banner toggle is still disabled.
     */
    test(
        'MM-T6221 global banner: not rendered when global banner toggle is disabled',
        {tag: ['@classification_markings', '@global_banner']},
        async ({pw}) => {
            const {adminUser, adminClient, team} = await pw.initSetup();

            // Set up classification levels but keep the global banner disabled
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvlsecret00000000000000000', name: 'SECRET', color: '#C8102E', rank: 2},
                ],
                {levelId: '', enabled: false, placement: 'top'},
            );

            const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});

            await expect(app.classificationBanner.top).not.toBeVisible();
            await expect(app.classificationBanner.bottom).not.toBeVisible();

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
            await deleteClassificationMarkingsFieldIfExists(adminClient);

            const app = await openClassificationMarkings(pw, adminUser);
            const {classification} = app.admin;

            // Enable classification markings and select a preset to have levels
            await app.admin.setting('classificationEnabled').trueRadio.check();
            await expect(app.admin.setting('classificationEnabled').trueRadio).toBeChecked();
            await classification.preset.controlButton.clickTo(classification.preset.menu.container);
            await (await classification.preset.menu.optionList.itemWith({text: 'United States'})).select();
            await expect(classification.preset.menu.container).not.toBeVisible();

            // Enable global banner without selecting a level
            await app.admin.setting('globalBannerEnabled').trueRadio.check();
            await expect(app.admin.setting('globalBannerEnabled').trueRadio).toBeChecked();

            // Try to save
            await classification.savePanel.saveButton.click();

            // Validation error is shown
            await expect(classification.savePanel.errorText).toContainText(
                /A global classification level must be selected/i,
            );
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
            const {adminUser, adminClient, team} = await pw.initSetup();

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvlsecret00000000000000000', name: 'SECRET', color: '#C8102E', rank: 2},
                ],
                {levelId: 'lvlsecret00000000000000000', enabled: true, placement: 'top'},
            );

            const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});

            const topBanner = app.classificationBanner.top.locator;
            await expect(topBanner).toBeVisible();
            await expect(topBanner).toContainText('SECRET');
            await expect(topBanner).toHaveCSS('background-color', 'rgb(200, 16, 46)'); // #C8102E

            // Bottom banner should NOT be visible (placement is top only)
            await expect(app.classificationBanner.bottom).not.toBeVisible();

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
            const {adminUser, adminClient, team} = await pw.initSetup();

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvltopsecret00000000000000', name: 'TOP SECRET', color: '#FCE83A', rank: 1}],
                {levelId: 'lvltopsecret00000000000000', enabled: true, placement: 'top_and_bottom'},
            );

            const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});

            const topBanner = app.classificationBanner.top.locator;
            const bottomBanner = app.classificationBanner.bottom.locator;

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

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvlconfidential00000000000', name: 'CONFIDENTIAL', color: '#FFD700', rank: 1}],
                {levelId: 'lvlconfidential00000000000', enabled: true, placement: 'top'},
            );

            const app = await openClassificationMarkings(pw, adminUser);

            const topBanner = app.classificationBanner.top.locator;
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

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvlrestricted0000000000000', name: 'RESTRICTED', color: '#FF8C00', rank: 1}],
                {levelId: 'lvlrestricted0000000000000', enabled: true, placement: 'top'},
            );

            const app = await openClassificationMarkings(pw, adminUser);

            // Banner should be visible initially
            await expect(app.classificationBanner.top).toBeVisible();

            // Disable the global banner
            await app.admin.setting('globalBannerEnabled').falseRadio.check();
            await expect(app.admin.setting('globalBannerEnabled').falseRadio).toBeChecked();
            await save(app);

            // Banner should no longer be visible
            await expect(app.classificationBanner.top).not.toBeVisible();

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

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvlsecret00000000000000000', name: 'SECRET', color: '#C8102E', rank: 1}],
                {
                    levelId: 'lvlsecret00000000000000000',
                    enabled: true,
                    placement: 'top',
                },
            );

            const app = await openClassificationMarkings(pw, adminUser);

            // Initially only top banner
            await expect(app.classificationBanner.top).toBeVisible();
            await expect(app.classificationBanner.bottom).not.toBeVisible();

            // Switch placement to top_and_bottom (the setting's false side) and save
            await app.admin.setting('globalBannerPlacement').falseRadio.check();
            await expect(app.admin.setting('globalBannerPlacement').falseRadio).toBeChecked();
            await save(app);

            // Both banners should now be visible
            await expect(app.classificationBanner.top).toBeVisible();
            await expect(app.classificationBanner.bottom).toBeVisible();

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

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvltopsecret00000000000000', name: 'TOP SECRET', color: '#FF0000', rank: 1}],
                {levelId: 'lvltopsecret00000000000000', enabled: true, placement: 'top_and_bottom'},
            );

            const app = await openClassificationMarkings(pw, adminUser);

            // Both banners should be visible
            await expect(app.classificationBanner.top).toBeVisible();
            await expect(app.classificationBanner.bottom).toBeVisible();

            // Disable classification markings entirely
            await app.admin.setting('classificationEnabled').falseRadio.check();
            await expect(app.admin.setting('classificationEnabled').falseRadio).toBeChecked();
            await save(app);

            // Banners should be gone
            await expect(app.classificationBanner.top).not.toBeVisible();
            await expect(app.classificationBanner.bottom).not.toBeVisible();

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
            const {adminClient, team, user} = await pw.initSetup();

            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [
                    {id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvlsecret00000000000000000', name: 'SECRET', color: '#C8102E', rank: 2},
                ],
                {levelId: 'lvlunclassified00000000000', enabled: true, placement: 'top'},
            );

            // Login the non-admin user
            const app = await openChannel(pw, user, {team, channel: {name: DefaultChannel.TownSquare}});

            const userTopBanner = app.classificationBanner.top.locator;
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
            const {adminUser, adminClient, team} = await pw.initSetup();

            // Light background (#FFFFFF) — text should be dark (#000000)
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvlunclassified00000000000', name: 'UNCLASSIFIED', color: '#FFFFFF', rank: 1}],
                {levelId: 'lvlunclassified00000000000', enabled: true, placement: 'top'},
            );

            const app = await openChannel(pw, adminUser, {team, channel: {name: DefaultChannel.TownSquare}});

            const topBanner = app.classificationBanner.top.locator;
            await expect(topBanner).toBeVisible();
            await expect(topBanner).toHaveCSS('color', 'rgb(0, 0, 0)');

            // Dark background (#000000) — text should be white (#FFFFFF)
            await setupClassificationFieldWithGlobalBanner(
                adminClient,
                [{id: 'lvltopsecret00000000000000', name: 'TOP SECRET', color: '#000000', rank: 1}],
                {levelId: 'lvltopsecret00000000000000', enabled: true, placement: 'top'},
            );

            await app.page.reload();
            await expect(app.center.postCreate.message.container).toBeVisible();

            await expect(topBanner).toBeVisible();
            await expect(topBanner).toHaveCSS('color', 'rgb(255, 255, 255)');

            await deleteClassificationMarkingsFieldIfExists(adminClient);
        },
    );
});
