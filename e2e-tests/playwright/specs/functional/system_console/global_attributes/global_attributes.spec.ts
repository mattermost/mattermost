// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Global Attributes access gate (MM-69845) and attribute listing (MM-69846).
 * Visibility is gated by the GlobalAttributes feature flag AND an Enterprise-tier license.
 * Once past the gate, the page lists every access_control/template property field on the server.
 *
 * Local runs: upload or use a license with SkuShortName `enterprise`, `entry`, or `advanced`.
 * Professional-only licenses hide this admin route (React Router redirects away).
 */

import {expect, test, getAdminClient, licenseTier} from '@mattermost/playwright-lib';

import {
    GLOBAL_ATTRIBUTES_ADMIN_PATH,
    createGlobalAttributeField,
    deleteGlobalAttributeFieldIfExists,
    setGlobalAttributesFeatureFlag,
} from './global_attributes_helpers';

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
     * @objective Ensure the Manage Attributes page is reachable and shows its page frame
     * once the feature flag is on and the license meets the Enterprise tier.
     */
    test('feature flag on with Enterprise+ license shows the page frame', async ({pw}) => {
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
        // * Page frame's static subtitle is present (renders regardless of fetch state)
        await expect(
            systemConsolePage.page.getByText('Define an attribute once, then choose which resources can use it.'),
        ).toBeVisible();
    });

    /**
     * @objective Ensure a real access_control/template attribute renders in the table with
     * its display name, type icon+label, source, and options count.
     */
    test('renders a seeded attribute with its Attribute/Type/Source/Options values', async ({pw}) => {
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

        await setGlobalAttributesFeatureFlag(adminClient, true);
        const {FeatureFlags} = await adminClient.getConfig();
        test.skip(
            FeatureFlags.GlobalAttributes !== true,
            'GlobalAttributes stays disabled (e.g. MM_FEATUREFLAGS or split-key overrides); cannot assert flag-on in this environment.',
        );

        const fieldName = `e2e_global_attribute_${Date.now()}`;

        // # Seed a real select-type field via the admin API (covers the "Managed here"
        // Source branch and a non-zero Options count — the plugin+protected branch is
        // unit-test-only since the admin API blocks source_plugin_id/protected from
        // non-plugin callers).
        await createGlobalAttributeField(adminClient, fieldName, {
            type: 'select',
            attrs: {
                display_name: 'E2E Global Attribute',
                options: [
                    {id: '', name: 'Option A'},
                    {id: '', name: 'Option B'},
                ],
            },
        });

        try {
            // # Log in and open the Manage Attributes page
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            // Re-rooted `has` probe on the name cell's testid+text, mirroring the
            // established row-lookup pattern (see board_attributes.ts's rowByName).
            const row = systemConsolePage.page.locator('tr', {
                has: systemConsolePage.page
                    .getByTestId('global-attribute-name')
                    .filter({hasText: 'E2E Global Attribute'}),
            });

            // * The seeded field's display name, type, source, and options render correctly
            await expect(row.getByTestId('global-attribute-name')).toHaveText('E2E Global Attribute');
            await expect(row.getByTestId('global-attribute-type')).toContainText('Select');
            await expect(row.getByTestId('global-attribute-source')).toContainText('Managed here');
            await expect(row.getByTestId('global-attribute-options')).toContainText('2 options');
        } finally {
            // # Clean up regardless of assertion outcome, so reruns start from a clean slate
            await deleteGlobalAttributeFieldIfExists(adminClient, fieldName);
        }
    });
});
