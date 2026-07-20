// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Global Attributes access gate (MM-69845).
 * Covers the hidden "Manage Attributes" shell page: visibility is gated by the
 * GlobalAttributes feature flag AND an Enterprise-tier license. The page has no
 * functional content yet — these tests only cover the access gate itself.
 *
 * Local runs: upload or use a license with SkuShortName `enterprise`, `entry`, or `advanced`.
 * Professional-only licenses hide this admin route (React Router redirects away).
 */

import {expect, test, getAdminClient, licenseTier} from '@mattermost/playwright-lib';

import {GLOBAL_ATTRIBUTES_ADMIN_PATH, setGlobalAttributesFeatureFlag} from './global_attributes_helpers';

test.describe('System Console - Global Attributes access gate', {tag: '@system_console'}, () => {
    test.describe.configure({mode: 'serial'});

    let originalFlagValue: boolean | undefined;

    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient();
        const {FeatureFlags} = await adminClient.getConfig();
        originalFlagValue = FeatureFlags.GlobalAttributes === true;
    });

    test.afterAll(async () => {
        const {adminClient} = await getAdminClient();
        if (adminClient && originalFlagValue !== undefined) {
            await setGlobalAttributesFeatureFlag(adminClient, originalFlagValue);
        }
    });

    /**
     * @objective Ensure the Manage Attributes admin route is unavailable when the feature flag is off.
     */
    test('feature flag off hides Manage Attributes regardless of license', async ({pw}) => {
        const {adminUser, adminClient} = await getAdminClient();

        if (!adminUser || !adminClient) {
            throw new Error('Failed to get admin user');
        }

        // # Turn off GlobalAttributes in server config
        await setGlobalAttributesFeatureFlag(adminClient, false);
        const {FeatureFlags} = await adminClient.getConfig();
        test.skip(
            FeatureFlags.GlobalAttributes === true,
            'GlobalAttributes stays enabled (e.g. MM_FEATUREFLAGS or split-key overrides); cannot assert flag-off in this environment.',
        );

        // # Navigate directly to the Manage Attributes path
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

        // * User is redirected away from the hidden route (no Route registered)
        await expect(systemConsolePage.page).not.toHaveURL(/manage_attributes/);
        // * Manage Attributes menu entry is not shown in the sidebar
        await expect(
            systemConsolePage.page.getByTestId('admin-sidebar').getByText('Manage Attributes'),
        ).not.toBeVisible();
    });

    /**
     * @objective Ensure the Manage Attributes page is reachable and shows its placeholder
     * content once the feature flag is on and the license meets the Enterprise tier.
     */
    test('feature flag on with Enterprise+ license shows the empty shell', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await getAdminClient();

        if (!adminUser || !adminClient) {
            throw new Error('Failed to get admin user');
        }

        const license = await adminClient.getClientLicenseOld();
        test.skip(
            licenseTier(license.SkuShortName) < 20,
            'Manage Attributes requires Enterprise-tier license (SkuShortName enterprise, entry, or advanced). ' +
                'Professional is not sufficient—the admin route is hidden and redirects away.',
        );

        // # Enable the feature flag
        await setGlobalAttributesFeatureFlag(adminClient, true);
        const {FeatureFlags} = await adminClient.getConfig();
        test.skip(
            FeatureFlags.GlobalAttributes !== true,
            'GlobalAttributes stays disabled (e.g. MM_FEATUREFLAGS or split-key overrides); cannot assert flag-on in this environment.',
        );

        // # Log in and open the Manage Attributes URL
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

        // * URL stays on the Manage Attributes section
        await expect(systemConsolePage.page).toHaveURL(/manage_attributes/);
        // * Sidebar menu entry and page heading are both visible ("Manage Attributes"
        // renders in both places, so each is asserted within its own scope)
        await expect(systemConsolePage.page.getByTestId('admin-sidebar').getByText('Manage Attributes')).toBeVisible();
        await expect(
            systemConsolePage.page.getByTestId('admin-console-header').getByText('Manage Attributes'),
        ).toBeVisible();
        await expect(systemConsolePage.page.getByText('Global attributes will be here.')).toBeVisible();
    });
});
