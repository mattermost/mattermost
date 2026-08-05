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

import {expect, test, getAdminClient} from '@mattermost/playwright-lib';

import {
    CLASSIFICATION_MARKINGS_ADMIN_PATH,
    deleteClassificationMarkingsFieldIfExists,
    setClassificationMarkingsFeatureFlag,
} from '../site_configuration/classification_markings_helpers';

import {
    GLOBAL_ATTRIBUTES_ADMIN_PATH,
    createGlobalAttributeField,
    deleteGlobalAttributeFieldIfExists,
    requireGlobalAttributesEnabled,
    setGlobalAttributesFeatureFlag,
} from './global_attributes_helpers';

test.describe('System Console - Global Attributes', {tag: '@system_console'}, () => {
    // All tests here toggle the same server-wide GlobalAttributes config flag, so the whole
    // file (both nested describes below) must stay serial — parallelizing across them would
    // race one test's flag-on against another's flag-off on the shared server.
    test.describe.configure({mode: 'serial'});

    let originalFlagValue: boolean | undefined;
    let originalClassificationFlagValue: boolean | undefined;

    test.beforeAll(async () => {
        const {adminClient} = await getAdminClient();
        const {FeatureFlags} = await adminClient.getConfig();
        originalFlagValue = FeatureFlags.GlobalAttributes === true;
        originalClassificationFlagValue = FeatureFlags.ClassificationMarkings === true;
    });

    test.afterAll(async () => {
        const {adminClient} = await getAdminClient();
        if (adminClient && originalFlagValue !== undefined) {
            await setGlobalAttributesFeatureFlag(adminClient, originalFlagValue);
        }
        if (adminClient && originalClassificationFlagValue !== undefined) {
            await setClassificationMarkingsFeatureFlag(adminClient, originalClassificationFlagValue);
        }
    });

    test.describe('access gate', () => {
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
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            // # Log in and open the Manage Attributes URL
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            // * URL stays on the Manage Attributes section
            await expect(systemConsolePage.page).toHaveURL(/manage_attributes/);
            // * Sidebar menu entry and page heading are both visible ("Manage Attributes"
            // renders in both places, so each is asserted within its own scope)
            await expect(
                systemConsolePage.page.getByTestId('admin-sidebar').getByText('Manage Attributes'),
            ).toBeVisible();
            await expect(
                systemConsolePage.page.getByTestId('admin-console-header').getByText('Manage Attributes'),
            ).toBeVisible();
            // * Page frame's static subtitle is present (renders regardless of fetch state)
            await expect(
                systemConsolePage.page.getByText('Define an attribute once, then choose which resources can use it.'),
            ).toBeVisible();
        });
    });

    test.describe('listing', () => {
        /**
         * @objective Ensure a real access_control/template attribute renders in the table with
         * its display name, type icon+label, source, and options count — across every field
         * type the ticket's Type column has a mapping for (Text/Select/Multiselect/Ranked),
         * plus one unmapped type (date) to prove the fallback also holds end-to-end.
         */
        test('renders one seeded field per type with correct Attribute/Type/Source/Options values', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

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

            try {
                // # Seed every field inside the try block — if creation fails partway
                // through (e.g. field 3 of 5), the finally below still cleans up whatever
                // was already created instead of leaving it orphaned on the shared server.
                for (const seed of seeds) {
                    await createGlobalAttributeField(adminClient, seed.name, {
                        type: seed.type,
                        attrs: {display_name: seed.displayName, ...seed.attrs},
                    });
                }

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
                    await expect(row.getByTestId('global-attribute-name')).toHaveText(seed.displayName);
                    await expect(row.getByTestId('global-attribute-type')).toContainText(seed.expectedType);
                    // * A leading icon renders alongside the label, including for the
                    // unmapped "date" type (fallback icon, not a blank cell)
                    await expect(row.getByTestId('global-attribute-type').locator('svg')).toBeVisible();
                    await expect(row.getByTestId('global-attribute-source')).toContainText('Managed here');
                    // * "Managed here" is the one source kind reachable through the admin
                    // API (plugin/ldap/saml require server-side attrs the API blocks from
                    // non-plugin callers — those icon mappings are unit-test-only) and it
                    // renders with no leading icon, unlike plugin/ldap/saml sources
                    await expect(row.getByTestId('global-attribute-source').locator('svg')).toHaveCount(0);
                    await expect(row.getByTestId('global-attribute-options')).toContainText(seed.expectedOptions);
                }
            } finally {
                // # Clean up regardless of assertion outcome, so reruns start from a clean slate
                for (const seed of seeds) {
                    await deleteGlobalAttributeFieldIfExists(adminClient, seed.name);
                }
            }
        });

        /**
         * @objective Ensure the table sorts by the same value shown in the Attribute column
         * (display_name, falling back to name) rather than by the hidden internal name.
         */
        test('sorts rows by the displayed Attribute value, not the internal field name', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

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

            try {
                // # Seed all three fields inside the try block — if creation fails
                // partway through, the finally below still cleans up whatever was
                // already created instead of leaving it orphaned on the shared server.
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

        /**
         * @objective Ensure a real Classification Markings field (name/object_type/group_id
         * matching production's saveCreateField) renders the read-only subtitle and an
         * open-in-new link to its own admin page instead of the ordinary dot-menu, and that an
         * unrelated field — including one that shares the same 'rank' type — is entirely unaffected.
         */
        test(
            'renders the Classification Markings row as a read-only open-in-new link, leaving an unrelated rank field unaffected',
            {tag: ['@system_console', '@classification_markings']},
            async ({pw}) => {
                const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

                // # The link's destination page is gated by its own independent feature flag
                // (ClassificationMarkings), separate from the GlobalAttributes flag gating this
                // listing page — both must be on for the link to render.
                // Tagged @classification_markings like every other spec that touches this same
                // shared server-wide field/flag (classification_markings.spec.ts,
                // global_classification_banner.spec.ts) — those specs are NOT otherwise
                // concurrency-guarded against each other; the tag is this suite's existing
                // (if informal) convention for grouping tests that share this exact resource.
                await setClassificationMarkingsFeatureFlag(adminClient, true);
                await pw.skipIfFeatureFlagNotSet('ClassificationMarkings', true);

                const timestamp = Date.now();
                const classificationDisplayName = `E2E Classification Attribute ${timestamp}`;
                const unrelatedRankName = `e2e_unrelated_rank_${timestamp}`;
                const unrelatedRankDisplayName = `E2E Unrelated Ranked Attribute ${timestamp}`;

                try {
                    // # Clean slate first via the classification-aware helper (not the generic
                    // deleteGlobalAttributeFieldIfExists): it also removes any linked system/channel
                    // field first, avoiding server-side deletion-protection errors that leave a
                    // stale template field behind if another classification spec ran previously.
                    await deleteClassificationMarkingsFieldIfExists(adminClient);

                    // # Seed the real classification field: name 'classification', type 'rank',
                    // matching classification_markings/utils/index.ts's saveCreateField exactly —
                    // not the select-based shape some older, test-only e2e helpers use.
                    await createGlobalAttributeField(adminClient, 'classification', {
                        type: 'rank',
                        attrs: {
                            display_name: classificationDisplayName,
                            options: [
                                {id: '', name: 'Unclassified', rank: 1},
                                {id: '', name: 'Secret', rank: 2},
                            ],
                        },
                    });

                    // # Seed an unrelated field that shares the same 'rank' type, to prove the
                    // predicate keys on name/object_type/group_id, not on type.
                    await createGlobalAttributeField(adminClient, unrelatedRankName, {
                        type: 'rank',
                        attrs: {
                            display_name: unrelatedRankDisplayName,
                            options: [
                                {id: '', name: 'Low', rank: 1},
                                {id: '', name: 'High', rank: 2},
                            ],
                        },
                    });

                    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                    await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                    const classificationRow = systemConsolePage.page.locator('tr', {
                        has: systemConsolePage.page
                            .getByTestId('global-attribute-name')
                            .filter({hasText: classificationDisplayName}),
                    });
                    await classificationRow.waitFor();

                    // * The read-only subtitle renders under the attribute name
                    await expect(classificationRow.getByText('Read-only')).toBeVisible();

                    // * The Source column identifies this row's true source, not the generic
                    // "Managed here" every other native field gets
                    await expect(classificationRow.getByTestId('global-attribute-source')).toContainText(
                        'Classification Markings',
                    );

                    // * The rightmost cell is an open-in-new link to the Classification Markings
                    // admin page, not the dot-menu action trigger
                    const openInNewLink = classificationRow.getByRole('link', {name: 'Open Classification Markings'});
                    await expect(openInNewLink).toBeVisible();
                    await expect(openInNewLink).toHaveAttribute('href', CLASSIFICATION_MARKINGS_ADMIN_PATH);
                    await expect(classificationRow.getByRole('button', {name: 'More actions'})).toHaveCount(0);

                    // # Clicking the link actually navigates to the Classification Markings page
                    await openInNewLink.click();
                    // * Navigation lands on the Classification Markings admin page
                    await expect(systemConsolePage.page).toHaveURL(new RegExp(CLASSIFICATION_MARKINGS_ADMIN_PATH));

                    await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                    // * An unrelated 'rank'-type field is unaffected: ordinary dot-menu, no subtitle
                    const unrelatedRow = systemConsolePage.page.locator('tr', {
                        has: systemConsolePage.page
                            .getByTestId('global-attribute-name')
                            .filter({hasText: unrelatedRankDisplayName}),
                    });
                    await unrelatedRow.waitFor();
                    await expect(unrelatedRow.getByRole('button', {name: 'More actions'})).toBeVisible();
                    await expect(unrelatedRow.getByText('Read-only')).toHaveCount(0);
                    await expect(unrelatedRow.getByRole('link', {name: 'Open Classification Markings'})).toHaveCount(0);
                    await expect(unrelatedRow.getByTestId('global-attribute-source')).toContainText('Managed here');
                } finally {
                    await deleteClassificationMarkingsFieldIfExists(adminClient);
                    await deleteGlobalAttributeFieldIfExists(adminClient, unrelatedRankName);
                }
            },
        );
    });

    test.describe('create attribute', () => {
        /**
         * @objective Ensure the full create flow works end-to-end: the "New attribute" button
         * navigates to the create page, the Unique name live-updates from Display name, the
         * Edit/Done toggle round-trips correctly, and Save creates a real bare Text template
         * that shows up back in the Manage Attributes list.
         */
        test('creates a bare Text attribute via the New attribute page and shows it in the list', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            // Avoids an "E2E" prefix: slugifyForCEL's camelCase/digit-boundary regex
            // (webapp/channels/src/utils/properties.ts) inserts an underscore between
            // any lowercase-or-digit character immediately followed by an uppercase
            // one, so "E2E ..." would actually slugify to "e2_e_..." (verified against
            // slugifyForCEL directly), not the naively-expected "e2e_...". "Playwright"
            // has no internal case/digit boundary, so its derived slug is unambiguous.
            const timestamp = Date.now();
            const displayName = `Playwright Created Attribute ${timestamp}`;
            const expectedName = `playwright_created_attribute_${timestamp}`;

            try {
                // # Log in and open the Manage Attributes page
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                // # Click "New attribute" to open the create page
                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

                // # Fill in the Display name; the Unique name caption auto-derives live
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(expectedName);

                // # Exercise the Edit/Done round-trip once, confirming the input is focused
                // and seeded, then revert back to static display without changing the value
                await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
                const nameInput = systemConsolePage.page.getByTestId('attributeNameInput');
                await expect(nameInput).toBeFocused();
                await expect(nameInput).toHaveValue(expectedName);
                await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(expectedName);

                // # Save
                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * Redirected back to the Manage Attributes list
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));

                // * The new attribute renders with the expected Display name, Type, and Source
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-name')).toHaveText(displayName);
                await expect(row.getByTestId('global-attribute-type')).toContainText('Text');
                await expect(row.getByTestId('global-attribute-source')).toContainText('Managed here');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure a Display name that auto-slugs straight to a reserved CEL word shows
         * a specific inline error, disables Save, and does not navigate away — without the admin
         * ever clicking "Edit" to reach the manual Name input.
         */
        test('shows an inline error and does not navigate away when the auto-derived Name is a reserved word', async ({
            pw,
        }) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            // # Log in and open the Manage Attributes page
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            // # Open the create page
            await systemConsolePage.page.getByTestId('newAttributeButton').click();
            await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

            // # Type a Display name that auto-slugs straight to a reserved CEL keyword
            await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill('For');

            // * Inline validation error is shown without ever clicking "Edit"
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toContainText('reserved word');
            // * Save is disabled
            await expect(systemConsolePage.page.getByTestId('saveSetting')).toBeDisabled();

            // * No navigation occurred
            await expect(systemConsolePage.page).toHaveURL(/attribute_details/);
        });

        /**
         * @objective Ensure a Select attribute can be created end-to-end with a real options
         * editor: type switch, add two options via Enter, Save is blocked until an option exists,
         * and the saved attribute shows the correct type/option count back in the list.
         */
        test('creates a Select attribute with two options via the options editor', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Select Attribute ${timestamp}`;
            const expectedName = `playwright_select_attribute_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(expectedName);

                // # Switch type to Select
                await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
                await systemConsolePage.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();

                // * Save is disabled with zero options, with an inline reason shown
                await expect(systemConsolePage.page.getByTestId('attributeOptionsRequiredError')).toContainText(
                    'At least one option is required',
                );
                await expect(systemConsolePage.page.getByTestId('saveSetting')).toBeDisabled();

                // # Add two options via Enter
                const optionsInput = systemConsolePage.page.getByTestId('attributeOptionsValues__addInput');
                await optionsInput.fill('Engineering');
                await optionsInput.press('Enter');
                await optionsInput.fill('Sales');
                await optionsInput.press('Enter');

                // * Save is now enabled
                await expect(systemConsolePage.page.getByTestId('saveSetting')).toBeEnabled();
                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * Redirected back to the list, showing the correct type and option count
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-type')).toContainText('Select');
                await expect(row.getByTestId('global-attribute-options')).toContainText('2 options');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure a Rank attribute can be created end-to-end, including reordering an
         * option via the keyboard-accessible "Rank" popover before Save, and that the saved
         * attribute shows the correct type/option count in the list.
         */
        test('creates a Rank attribute, reorders an option via the Rank popover, and saves', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Ranked Attribute ${timestamp}`;
            const expectedName = `playwright_ranked_attribute_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(expectedName);

                await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
                await systemConsolePage.page.getByRole('menuitemradio', {name: /Ranked/}).click();

                const optionsInput = systemConsolePage.page.getByTestId('attributeOptionsRankValues__addInput');
                await optionsInput.fill('Low');
                await optionsInput.press('Enter');
                await optionsInput.fill('High');
                await optionsInput.press('Enter');

                // * Chips render in ascending rank order
                const chipLabels = systemConsolePage.page.getByTestId('attributeOptionsRankValues__chipLabel');
                await expect(chipLabels).toHaveText(['Low', 'High']);

                // # Reorder "High" to position 1 via its popover's Rank submenu
                await chipLabels.filter({hasText: 'High'}).click();
                await systemConsolePage.page.getByText('Rank', {exact: true}).click();
                await systemConsolePage.page.getByRole('menuitemradio', {name: '1'}).click();

                // * Reordered — "High" now renders first
                await expect(chipLabels).toHaveText(['High', 'Low']);

                await systemConsolePage.page.getByTestId('saveSetting').click();

                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-type')).toContainText('Ranked');
                await expect(row.getByTestId('global-attribute-options')).toContainText('2 options');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure switching type mid-form preserves already-entered options rather than
         * discarding them, per the ticket's "freely switch types" requirement.
         */
        test('preserves already-entered options when switching type away and back', async ({pw}) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            await systemConsolePage.page.getByTestId('newAttributeButton').click();

            await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
            await systemConsolePage.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();
            const optionsInput = systemConsolePage.page.getByTestId('attributeOptionsValues__addInput');
            await optionsInput.fill('Engineering');
            await optionsInput.press('Enter');

            // # Switch to Text (options editor unmounts) and back to Select
            await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
            await systemConsolePage.page.getByRole('menuitemradio', {name: 'Text'}).click();
            await expect(systemConsolePage.page.getByTestId('attributeOptionsValues')).toHaveCount(0);

            await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
            await systemConsolePage.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();

            // * The previously-entered option is still there, not discarded
            await expect(systemConsolePage.page.getByTestId('attributeOptionsValues__chipLabel')).toHaveText(
                'Engineering',
            );
        });
    });
});
