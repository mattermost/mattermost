// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Global Attributes access gate and attribute listing.
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
     * its display name, type icon+label, source, and options count — across every field
     * type the ticket's Type column has a mapping for (Text/Select/Multiselect/Ranked),
     * plus one unmapped type (date) to prove the fallback also holds end-to-end.
     */
    test('renders one seeded field per type with correct Attribute/Type/Source/Options values', async ({pw}) => {
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

        const timestamp = Date.now();

        // Covers the "Managed here" Source branch (all of these) alongside every Type/Options
        // combination reachable through the admin API — the plugin+protected Source branch is
        // unit-test-only since the admin API blocks source_plugin_id/protected from non-plugin
        // callers, and rank uses type: 'rank' directly (the same type Classification Markings'
        // own saveCreateField creates), not the select-based seeding some older e2e helpers use.
        // displayName embeds the same per-run timestamp as name — required so the row locator
        // below can't collide with another concurrently-running browser project's seeded row
        // (this suite's projects share one server/worker pool; see playwright.config.ts).
        const seeds = [
            {
                name: `e2e_global_attribute_text_${timestamp}`,
                displayName: `E2E Text Attribute ${timestamp}`,
                type: 'text',
                attrs: {},
                expectedType: 'Text',
                expectedOptions: 'Free Text',
            },
            {
                name: `e2e_global_attribute_select_${timestamp}`,
                displayName: `E2E Select Attribute ${timestamp}`,
                type: 'select',
                attrs: {
                    options: [
                        {id: '', name: 'Option A'},
                        {id: '', name: 'Option B'},
                    ],
                },
                expectedType: 'Select',
                expectedOptions: '2 options',
            },
            {
                name: `e2e_global_attribute_multiselect_${timestamp}`,
                displayName: `E2E Multiselect Attribute ${timestamp}`,
                type: 'multiselect',
                attrs: {
                    options: [
                        {id: '', name: 'Option A'},
                        {id: '', name: 'Option B'},
                        {id: '', name: 'Option C'},
                    ],
                },
                expectedType: 'Multiselect',
                expectedOptions: '3 options',
            },
            {
                name: `e2e_global_attribute_rank_${timestamp}`,
                displayName: `E2E Ranked Attribute ${timestamp}`,
                type: 'rank',
                attrs: {
                    options: [
                        {id: '', name: 'Low', rank: 1},
                        {id: '', name: 'High', rank: 2},
                    ],
                },
                expectedType: 'Ranked',
                expectedOptions: '2 options',
            },
            {
                name: `e2e_global_attribute_date_${timestamp}`,
                displayName: `E2E Date Attribute ${timestamp}`,
                type: 'date',
                attrs: {},
                expectedType: 'Other',
                expectedOptions: 'Free Text',
            },
        ] as const;

        for (const seed of seeds) {
            // eslint-disable-next-line no-await-in-loop
            await createGlobalAttributeField(adminClient, seed.name, {
                type: seed.type,
                attrs: {display_name: seed.displayName, ...seed.attrs},
            });
        }

        try {
            // # Log in and open the Manage Attributes page once every field is seeded
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            for (const seed of seeds) {
                // Re-rooted `has` probe on the name cell's testid+text, mirroring the
                // established row-lookup pattern (see board_attributes.ts's rowByName).
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page
                        .getByTestId('global-attribute-name')
                        .filter({hasText: seed.displayName}),
                });

                // * Each seeded field's display name, type, source, and options render correctly
                // eslint-disable-next-line no-await-in-loop
                await expect(row.getByTestId('global-attribute-name')).toHaveText(seed.displayName);
                // eslint-disable-next-line no-await-in-loop
                await expect(row.getByTestId('global-attribute-type')).toContainText(seed.expectedType);
                // eslint-disable-next-line no-await-in-loop
                await expect(row.getByTestId('global-attribute-source')).toContainText('Managed here');
                // eslint-disable-next-line no-await-in-loop
                await expect(row.getByTestId('global-attribute-options')).toContainText(seed.expectedOptions);
            }
        } finally {
            // # Clean up regardless of assertion outcome, so reruns start from a clean slate
            for (const seed of seeds) {
                // eslint-disable-next-line no-await-in-loop
                await deleteGlobalAttributeFieldIfExists(adminClient, seed.name);
            }
        }
    });

    /**
     * @objective Ensure the table sorts by the same value shown in the Attribute column
     * (display_name, falling back to name) rather than by the hidden internal name.
     */
    test('sorts rows by the displayed Attribute value, not the internal field name', async ({pw}) => {
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

        const timestamp = Date.now();

        // Internal names sort z-then-a; display names (what the table actually shows and
        // must sort by) sort a-then-z. If the table sorted by the internal name instead,
        // these rows would render in the opposite order.
        const firstName = `zzz_e2e_sort_${timestamp}`;
        const secondName = `aaa_e2e_sort_${timestamp}`;
        const firstDisplayName = `Aardvark E2E Sort Attribute ${timestamp}`;
        const secondDisplayName = `Zebra E2E Sort Attribute ${timestamp}`;

        // No display_name set — the rendered (and sorted-by) value falls back to this
        // internal name directly. Chosen to alphabetically land between the two display
        // names above, so its position in the rendered order proves the fallback value
        // participates in sorting correctly alongside explicit display names, not just
        // in isolation (the unit tests already cover the fallback alone).
        const thirdName = `mmm_e2e_sort_fallback_${timestamp}`;

        await createGlobalAttributeField(adminClient, firstName, {
            type: 'text',
            attrs: {display_name: firstDisplayName},
        });
        await createGlobalAttributeField(adminClient, secondName, {
            type: 'text',
            attrs: {display_name: secondDisplayName},
        });
        await createGlobalAttributeField(adminClient, thirdName, {
            type: 'text',
            attrs: {},
        });

        try {
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            await systemConsolePage.page.getByTestId('global-attribute-name').getByText(firstDisplayName).waitFor();

            // * The fallback field renders under its internal name, since no display_name was set
            await expect(
                systemConsolePage.page.getByTestId('global-attribute-name').getByText(thirdName),
            ).toBeVisible();

            // * Rendered order follows the displayed Attribute value (Aardvark, then the
            // fallback name, then Zebra) — not the internal name (which would put "aaa_..."
            // first if sorted that way)
            const names = await systemConsolePage.page.getByTestId('global-attribute-name').allTextContents();
            const firstIndex = names.indexOf(firstDisplayName);
            const thirdIndex = names.indexOf(thirdName);
            const secondIndex = names.indexOf(secondDisplayName);
            expect(firstIndex).toBeGreaterThanOrEqual(0);
            expect(thirdIndex).toBeGreaterThanOrEqual(0);
            expect(secondIndex).toBeGreaterThanOrEqual(0);
            expect(firstIndex).toBeLessThan(thirdIndex);
            expect(thirdIndex).toBeLessThan(secondIndex);
        } finally {
            await deleteGlobalAttributeFieldIfExists(adminClient, firstName);
            await deleteGlobalAttributeFieldIfExists(adminClient, secondName);
            await deleteGlobalAttributeFieldIfExists(adminClient, thirdName);
        }
    });
});
