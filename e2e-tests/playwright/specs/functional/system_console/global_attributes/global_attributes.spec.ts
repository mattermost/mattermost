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
import type {Page} from '@playwright/test';

import {
    CLASSIFICATION_MARKINGS_ADMIN_PATH,
    deleteClassificationMarkingsFieldIfExists,
    setClassificationMarkingsFeatureFlag,
} from '../site_configuration/classification_markings_helpers';

import {
    GLOBAL_ATTRIBUTES_ADMIN_PATH,
    createGlobalAttributeField,
    createLinkedDependentField,
    deleteGlobalAttributeFieldIfExists,
    deleteLinkedDependentField,
    getGlobalAttributeFieldByName,
    getGlobalAttributeFieldOptions,
    requireGlobalAttributesEnabled,
    requireHierarchicalAttributesEnabled,
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

        /**
         * @objective Ensure a seeded graph field renders as Hierarchical with an options count,
         * not the Select/Text fallbacks.
         */
        test('renders a seeded graph field as Hierarchical with its option count', async ({pw}) => {
            const {adminUser, adminClient} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_graph_${timestamp}`;
            const displayName = `E2E Hierarchical Attribute ${timestamp}`;

            try {
                await createGlobalAttributeField(adminClient, name, {
                    type: 'graph',
                    attrs: {
                        display_name: displayName,
                        options: [
                            {id: '', name: 'Air', parents: []},
                            {id: '', name: 'Fighter', parents: ['Air']},
                        ],
                    },
                });

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });

                await expect(row.getByTestId('global-attribute-name')).toHaveText(displayName);
                await expect(row.getByTestId('global-attribute-type')).toContainText('Hierarchical');
                await expect(row.getByTestId('global-attribute-type').locator('svg')).toBeVisible();
                await expect(row.getByTestId('global-attribute-source')).toContainText('Managed here');
                await expect(row.getByTestId('global-attribute-options')).toContainText('2 options');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });
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
            // The prefix is kept short on purpose: the Unique name input is capped at
            // Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH (40), and a 13-digit Date.now()
            // leaves only 27 characters for everything before it. A longer prefix derives
            // a silently truncated slug that no longer matches the expectation below.
            const timestamp = Date.now();
            const displayName = `Playwright Attr ${timestamp}`;
            const expectedName = `playwright_attr_${timestamp}`;

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
         * @objective Ensure "Done" and Enter both refuse to commit an invalid manual Unique name,
         * so a reserved word can never be left sitting in the field, and that correcting the value
         * unblocks the commit and lets the attribute save for real.
         */
        test('blocks Done and Enter while the manual Unique name is a reserved word, then commits once corrected', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // The prefix is kept short deliberately: the Unique name input is capped at
            // Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH (40), and a 13-digit Date.now() leaves
            // only 27 characters ahead of it. A longer prefix derives a silently truncated slug
            // that no longer matches the expectations below.
            const displayName = `Playwright Resv ${timestamp}`;
            const autoDerivedName = `playwright_resv_${timestamp}`;
            // The corrected value -- typed by appending to the rejected "for", which is how an
            // admin would actually fix it. Still starts with a letter, so it stays a valid
            // CEL identifier, and the timestamp keeps it unique across runs.
            const correctedName = `for_${timestamp}`;

            try {
                // # Log in and open the create page
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(
                    autoDerivedName,
                );

                // # Open the manual Name editor and replace the auto-derived slug with a reserved word
                await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
                const nameInput = systemConsolePage.page.getByTestId('attributeNameInput');
                await nameInput.fill('for');

                // * The inline error appears and Done reports itself as unavailable, while staying
                // focusable (aria-disabled, not the disabled attribute) and pointing at the reason
                const doneLink = systemConsolePage.page.getByTestId('attributeNameEditLink');
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toContainText(
                    'reserved word',
                );
                await expect(doneLink).toHaveAttribute('aria-disabled', 'true');
                await expect(doneLink).toHaveAttribute('aria-describedby', 'attribute-unique-name-error');

                // * Still reachable by keyboard -- this is the whole reason the block is expressed
                // as aria-disabled rather than the disabled attribute, which would drop Done out
                // of the tab order and leave a keyboard user with no way to discover why
                await nameInput.press('Tab');
                await expect(doneLink).toBeFocused();

                // # Click Done anyway. `force` skips Playwright's own actionability checks, which
                // treat aria-disabled as disabled and would otherwise refuse to dispatch the click
                // -- the point of this step is that the click really does reach the handler and is
                // rejected there, not that Playwright declined to send it.
                await doneLink.click({force: true});

                // * Rejected -- the editor is still open with the reserved word still in it,
                // rather than the value being committed into the field behind a lingering error
                await expect(nameInput).toBeVisible();
                await expect(nameInput).toHaveValue('for');
                await expect(doneLink).toHaveText('Done');

                // # Press Enter, which routes through the same commit path
                await nameInput.press('Enter');

                // * Also rejected
                await expect(nameInput).toBeVisible();
                await expect(nameInput).toHaveValue('for');
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toContainText(
                    'reserved word',
                );

                // # Correct the value by typing the rest of the identifier
                await nameInput.press('End');
                await nameInput.pressSequentially(`_${timestamp}`);

                // * The error clears and Done is live again
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toHaveCount(0);
                await expect(doneLink).not.toHaveAttribute('aria-disabled', 'true');

                // # Commit with Enter this time
                await nameInput.press('Enter');

                // * Committed -- the editor closed and the corrected Name is shown
                await expect(systemConsolePage.page.getByTestId('attributeNameInput')).toHaveCount(0);
                await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(correctedName);

                // # Save
                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * The attribute was created with the corrected Name
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-name')).toHaveText(displayName);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, correctedName);
            }
        });

        /**
         * @objective Ensure the blocked Done is not a dead end: an admin who has typed an invalid
         * Unique name can still get out by clearing the field (which reverts) or by pressing
         * Escape (which discards), without ever having to fix the value first.
         */
        test('leaves both escape hatches open when the manual Unique name is invalid', async ({pw}) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the reserved-word test above
            const displayName = `Playwright Esc ${timestamp}`;
            const autoDerivedName = `playwright_esc_${timestamp}`;

            // # Log in and open the create page
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await systemConsolePage.page.getByTestId('newAttributeButton').click();
            await expect(systemConsolePage.page).toHaveURL(/attribute_details/);

            await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);

            // # Escape hatch 1: clear the field. An empty Name has no validation error, so Done
            // goes live again and applies its usual revert.
            await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
            const nameInput = systemConsolePage.page.getByTestId('attributeNameInput');
            await nameInput.fill('for');

            const doneLink = systemConsolePage.page.getByTestId('attributeNameEditLink');
            await expect(doneLink).toHaveAttribute('aria-disabled', 'true');

            await nameInput.fill('');
            await expect(doneLink).not.toHaveAttribute('aria-disabled', 'true');
            await doneLink.click();

            // * Exited edit mode, reverted to the auto-derived slug, no error left behind
            await expect(systemConsolePage.page.getByTestId('attributeNameInput')).toHaveCount(0);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(autoDerivedName);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toHaveCount(0);

            // # Escape hatch 2: press Escape while the field is invalid, discarding the edit
            await systemConsolePage.page.getByTestId('attributeNameEditLink').click();
            await systemConsolePage.page.getByTestId('attributeNameInput').fill('for');
            await expect(systemConsolePage.page.getByTestId('attributeNameEditLink')).toHaveAttribute(
                'aria-disabled',
                'true',
            );
            await systemConsolePage.page.getByTestId('attributeNameInput').press('Escape');

            // * Exited edit mode with the reserved word discarded
            await expect(systemConsolePage.page.getByTestId('attributeNameInput')).toHaveCount(0);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameValue')).toHaveText(autoDerivedName);
            await expect(systemConsolePage.page.getByTestId('attributeUniqueNameError')).toHaveCount(0);

            // * Save is available again, since the Name is back to a valid auto-derived slug
            await expect(systemConsolePage.page.getByTestId('saveSetting')).toBeEnabled();
        });

        /**
         * @objective Ensure a Select attribute can be created end-to-end with a real options
         * editor: type switch, add two options via Enter, Save is blocked until an option exists,
         * and the saved attribute shows the correct type/option count back in the list.
         */
        test('creates a Select attribute with two options via the options editor', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above
            const displayName = `Playwright Select ${timestamp}`;
            const expectedName = `playwright_select_${timestamp}`;

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
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above
            const displayName = `Playwright Ranked ${timestamp}`;
            const expectedName = `playwright_ranked_${timestamp}`;

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

        /**
         * @objective Ensure a Text attribute can be linked to AD/LDAP via the external source
         * picker end-to-end, and that the Manage Attributes list picks up the new attrs.ldap
         * value with no further changes needed on that page.
         */
        test('creates a Text attribute linked to AD/LDAP via the external source picker', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above.
            // This one only uses expectedName for cleanup, so an over-long prefix leaked the
            // created field onto the shared server instead of failing loudly.
            const displayName = `Playwright Ldap ${timestamp}`;
            const expectedName = `playwright_ldap_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);

                // # Open the external source picker and link AD/LDAP
                await systemConsolePage.page.getByTestId('attributeExternalSourceTrigger').click();
                await systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/}).click();
                await systemConsolePage.page.getByRole('textbox').fill('employeeID');
                await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();

                // * A chip for AD/LDAP now appears, and Type shows Text
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toBeVisible();
                await expect(systemConsolePage.page.getByTestId('attributeTypeMenuButton')).toContainText('Text');

                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * The new attribute shows "AD/LDAP" in the Source column
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-source')).toContainText('AD/LDAP');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure both AD/LDAP and SAML can be linked on the same attribute, that an
         * already-linked source is excluded from the "add" menu (and the trigger disappears
         * once both are linked), and that each chip shows the actual linked value, not just the
         * source name.
         */
        test('links both AD/LDAP and SAML, excludes an already-linked source from the menu, and shows the linked value in each chip', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            // Short prefix: see the 40-char Unique name cap noted in the bare-Text test above
            const displayName = `Playwright Dual ${timestamp}`;
            const expectedName = `playwright_dual_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await systemConsolePage.page.getByTestId('newAttributeButton').click();
                await systemConsolePage.page.getByTestId('attributeDisplayNameInput').fill(displayName);

                // # Before anything is linked, the menu offers both sources
                await systemConsolePage.page.getByTestId('attributeExternalSourceTrigger').click();
                await expect(systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/})).toBeVisible();
                await expect(systemConsolePage.page.getByRole('menuitem', {name: /^SAML/})).toBeVisible();

                // # Link AD/LDAP
                await systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/}).click();
                await systemConsolePage.page.getByPlaceholder('department').fill('employeeID');
                await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();

                // * The chip shows the source and the value that was actually typed
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toHaveText(
                    'AD/LDAP: employeeID',
                );

                // # Reopen the trigger -- AD/LDAP is no longer offered, only SAML
                await systemConsolePage.page.getByTestId('attributeExternalSourceTrigger').click();
                await expect(systemConsolePage.page.getByRole('menuitem', {name: /^SAML/})).toBeVisible();
                await expect(systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/})).not.toBeVisible();

                // # Link SAML too
                await systemConsolePage.page.getByRole('menuitem', {name: /^SAML/}).click();
                await systemConsolePage.page.getByPlaceholder('department').fill('position');
                await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();

                // * Both chips are shown with their own values, and the trigger disappears
                // entirely -- there is nothing left to add
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toHaveText(
                    'AD/LDAP: employeeID',
                );
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-saml')).toHaveText(
                    'SAML: position',
                );
                await expect(systemConsolePage.page.getByTestId('attributeExternalSourceTrigger')).not.toBeVisible();

                await systemConsolePage.page.getByTestId('saveSetting').click();

                // * With both linked, the list's Source column shows both sources together
                await expect(systemConsolePage.page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = systemConsolePage.page.locator('tr', {
                    has: systemConsolePage.page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-source')).toContainText('AD/LDAP, SAML');
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure a linked chip's edit action reopens the modal pre-filled and commits
         * a changed value, and that its remove action clears the link immediately with no modal.
         */
        test("edits a linked chip's value via its edit action, and removes a link via its remove action with no modal", async ({
            pw,
        }) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            await systemConsolePage.page.getByTestId('newAttributeButton').click();

            // # Link AD/LDAP
            await systemConsolePage.page.getByTestId('attributeExternalSourceTrigger').click();
            await systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/}).click();
            await systemConsolePage.page.getByPlaceholder('department').fill('employeeID');
            await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toHaveText(
                'AD/LDAP: employeeID',
            );

            // # Click the chip's edit action -- the modal reopens pre-filled with the current value
            await systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap-edit').click();
            await expect(systemConsolePage.page.getByPlaceholder('department')).toHaveValue('employeeID');

            // # Change the value and save
            await systemConsolePage.page.getByPlaceholder('department').fill('newEmployeeID');
            await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toHaveText(
                'AD/LDAP: newEmployeeID',
            );

            // # Click the chip's remove action -- the link clears immediately, no modal opens
            await systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap-remove').click();
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).not.toBeVisible();
            await expect(systemConsolePage.page.getByPlaceholder('department')).not.toBeVisible();

            // * The trigger is back, offering AD/LDAP again since nothing is linked anymore
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceTrigger')).toBeVisible();
        });

        /**
         * @objective Ensure the picker warns before converting a non-Text field to Text, and that
         * manually switching Type away from Text afterward clears the link and announces it via
         * the status region (not just a silently-removed chip).
         */
        test('warns before converting a non-Text field, and clears + announces the link when Type is switched away from Text', async ({
            pw,
        }) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            await systemConsolePage.page.getByTestId('newAttributeButton').click();

            // # Switch to Select, then try linking AD/LDAP
            await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
            await systemConsolePage.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();
            await systemConsolePage.page.getByTestId('attributeExternalSourceTrigger').click();
            await systemConsolePage.page.getByRole('menuitem', {name: /AD\/LDAP/}).click();

            // * The modal warns the field will convert to Text
            await expect(systemConsolePage.page.getByText(/converted to a TEXT attribute/i)).toBeVisible();

            // # Save the link anyway
            await systemConsolePage.page.getByPlaceholder('department').fill('employeeID');
            await systemConsolePage.page.getByRole('button', {name: 'Save'}).click();

            // * Type switched to Text, and a chip appeared
            await expect(systemConsolePage.page.getByTestId('attributeTypeMenuButton')).toContainText('Text');
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).toBeVisible();

            // # Switch Type away from Text again
            await systemConsolePage.page.getByTestId('attributeTypeMenuButton').click();
            await systemConsolePage.page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();

            // * The link is cleared, and the removal is announced via the status region
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceChip-ldap')).not.toBeVisible();
            await expect(systemConsolePage.page.getByTestId('attributeExternalSourceStatus')).toHaveText(
                'External source link removed',
            );
        });

        /**
         * @objective Ensure Hierarchical is a first-class type on New attribute: the empty
         * canvas disables Save without extra copy, External source is hidden, and a parent/child
         * graph saves with named parents and shows Hierarchical in the list.
         */
        test('creates a Hierarchical attribute with a parent and child and persists named parents', async ({pw}) => {
            const {adminUser, adminClient} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Graph ${timestamp}`;
            const expectedName = `playwright_graph_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                await page.getByTestId('newAttributeButton').click();
                await expect(page).toHaveURL(/attribute_details/);

                await page.getByTestId('attributeDisplayNameInput').fill(displayName);
                await expect(page.getByTestId('attributeUniqueNameValue')).toHaveText(expectedName);

                // # Switch type to Hierarchical
                await page.getByTestId('attributeTypeMenuButton').click();
                await page.getByRole('menuitemradio', {name: 'Hierarchical'}).click();

                // * Empty canvas, no extra required-options copy, External source hidden, Save disabled
                await expect(page.getByTestId('attributeTypeMenuButton')).toContainText('Hierarchical');
                await expect(page.getByTestId('attributeOptionsGraphEmpty')).toBeVisible();
                await expect(page.getByTestId('attributeExternalSource')).toHaveCount(0);
                await expect(page.getByTestId('attributeOptionsRequiredError')).toHaveCount(0);
                await expect(page.getByText('At least one option is required')).toHaveCount(0);
                await expect(page.getByTestId('saveSetting')).toBeDisabled();

                // # Add a root, then a child from its row menu
                await page.getByTestId('attributeOptionsGraphEmpty__nameInput').fill('Air');
                await page.getByTestId('attributeOptionsGraphEmpty__addButton').click();
                await expect(graphRow(page, 'Air')).toBeVisible();
                await expect(page.getByTestId('saveSetting')).toBeEnabled();

                await openGraphRowMenu(page, 'Air');
                await page.getByRole('menuitem', {name: 'Add child'}).click();
                await page.getByTestId('attributeOptionsGraphRow__childNameInput').fill('Fighter');
                await page.getByTestId('attributeOptionsGraphRow__childAddButton').click();

                await expect(graphRow(page, 'Fighter', 'Air')).toBeVisible();
                await expect(graphRow(page, 'Fighter', 'Air')).toHaveAttribute('data-depth', '1');

                await page.getByTestId('saveSetting').click();

                // * List shows Hierarchical with two options
                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
                const row = page.locator('tr', {
                    has: page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row.getByTestId('global-attribute-type')).toContainText('Hierarchical');
                await expect(row.getByTestId('global-attribute-options')).toContainText('2 options');

                // * Saved payload is a graph field; named parents live on the options route
                const field = await getGlobalAttributeFieldByName(adminClient, expectedName);
                expect(field?.type).toBe('graph');
                expect(field?.id).toBeTruthy();
                const options = await getGlobalAttributeFieldOptions(adminClient, field!.id);
                expect(options.find((option) => option.name === 'Air')?.parents ?? []).toEqual([]);
                expect(options.find((option) => option.name === 'Fighter')?.parents).toEqual(['Air']);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure a duplicate graph value is rejected in the canvas and does not
         * disable Save on the already-valid graph.
         */
        test('rejects a duplicate graph value name and leaves Save enabled for the existing graph', async ({pw}) => {
            const {adminUser} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Graph ${timestamp}`;
            const expectedName = `playwright_graph_${timestamp}`;

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await page.getByTestId('newAttributeButton').click();

            await page.getByTestId('attributeDisplayNameInput').fill(displayName);
            await expect(page.getByTestId('attributeUniqueNameValue')).toHaveText(expectedName);

            await page.getByTestId('attributeTypeMenuButton').click();
            await page.getByRole('menuitemradio', {name: 'Hierarchical'}).click();

            await page.getByTestId('attributeOptionsGraphEmpty__nameInput').fill('Engineering');
            await page.getByTestId('attributeOptionsGraphEmpty__addButton').click();
            await expect(graphRow(page, 'Engineering')).toBeVisible();
            await expect(page.getByTestId('saveSetting')).toBeEnabled();

            // # Try to add the same name again (case-insensitive)
            await page.getByTestId('attributeOptionsGraphAddTop__nameInput').fill('engineering');
            await page.getByTestId('attributeOptionsGraphAddTop__nameInput').press('Enter');

            // * Duplicate is refused; the unique-name alert is shown; Save stays enabled
            await expect(page.getByRole('alert')).toContainText('"engineering" already exists in this field.');
            await expect(page.getByTestId('attributeOptionsGraphAddTop__nameInput')).toHaveAttribute('aria-invalid', 'true');
            await expect(graphRow(page, 'Engineering')).toHaveCount(1);
            await expect(page.getByTestId('saveSetting')).toBeEnabled();
        });

        /**
         * @objective Ensure switching to Hierarchical drops Select options, and switching away
         * from Hierarchical drops graph values.
         */
        test('clears options when switching to Hierarchical and when switching away', async ({pw}) => {
            const {adminUser} = await requireHierarchicalAttributesEnabled(pw);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {page} = systemConsolePage;
            await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
            await page.getByTestId('newAttributeButton').click();

            await page.getByTestId('attributeTypeMenuButton').click();
            await page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();
            const selectInput = page.getByTestId('attributeOptionsValues__addInput');
            await selectInput.fill('Engineering');
            await selectInput.press('Enter');
            await expect(page.getByTestId('attributeOptionsValues__chipLabel')).toHaveText('Engineering');

            await page.getByTestId('attributeTypeMenuButton').click();
            await page.getByRole('menuitemradio', {name: 'Hierarchical'}).click();
            await expect(page.getByText('Engineering')).toHaveCount(0);
            await expect(page.getByTestId('attributeOptionsGraphEmpty')).toBeVisible();

            await page.getByTestId('attributeOptionsGraphEmpty__nameInput').fill('Root');
            await page.getByTestId('attributeOptionsGraphEmpty__addButton').click();
            await expect(graphRow(page, 'Root')).toBeVisible();

            await page.getByTestId('attributeTypeMenuButton').click();
            await page.getByRole('menuitemradio', {name: 'Select', exact: true}).click();
            await expect(graphRow(page, 'Root')).toHaveCount(0);
            await expect(page.getByTestId('attributeOptionsValues__chipLabel')).toHaveCount(0);
        });

        /**
         * @objective Ensure adding a second parent through the Parents pane asks Confirm this
         * grant and, once confirmed, records both parent names.
         */
        test('confirms a parent grant from the Parents pane and records both parents', async ({pw}) => {
            const {adminUser, adminClient} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Grant ${timestamp}`;
            const expectedName = `playwright_grant_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await page.getByTestId('newAttributeButton').click();
                await page.getByTestId('attributeDisplayNameInput').fill(displayName);

                await page.getByTestId('attributeTypeMenuButton').click();
                await page.getByRole('menuitemradio', {name: 'Hierarchical'}).click();

                // # Maritime (root), Air (root) with child Fighter
                await page.getByTestId('attributeOptionsGraphEmpty__nameInput').fill('Maritime');
                await page.getByTestId('attributeOptionsGraphEmpty__addButton').click();
                await page.getByTestId('attributeOptionsGraphAddTop__nameInput').fill('Air');
                await page.getByTestId('attributeOptionsGraphAddTop__addButton').click();
                await openGraphRowMenu(page, 'Air');
                await page.getByRole('menuitem', {name: 'Add child'}).click();
                await page.getByTestId('attributeOptionsGraphRow__childNameInput').fill('Fighter');
                await page.getByTestId('attributeOptionsGraphRow__childAddButton').click();

                // # Open Air's Parents pane and grant Maritime as a parent (newly reaches Fighter)
                await openGraphRowMenu(page, 'Air');
                await page.getByRole('menuitem', {name: 'Parents'}).click();
                await expect(page.getByTestId('attributeGraphParentsPane__name')).toHaveText('Air');
                await page.getByTestId('attributeGraphParentsPane__openParents').click();
                await page.getByTestId('attributeGraphParentsPane__candidate-Maritime').click();

                await expect(page.getByRole('heading', {name: 'Confirm this grant'})).toBeVisible();
                await expect(page.getByTestId('attributeGraphGrantConfirm__newlyReachable')).toContainText('Fighter');
                await page.getByRole('button', {name: /^add the parent$/i}).click();

                // * Air now sits under Maritime as well as at the root of Fighter
                await expect(graphRow(page, 'Air', 'Maritime')).toBeVisible();
                await expect(graphRow(page, 'Fighter', 'Air')).toBeVisible();

                await page.getByTestId('saveSetting').click();
                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));

                const field = await getGlobalAttributeFieldByName(adminClient, expectedName);
                expect(field?.id).toBeTruthy();
                const options = await getGlobalAttributeFieldOptions(adminClient, field!.id);
                expect(options.find((option) => option.name === 'Air')?.parents).toEqual(
                    expect.arrayContaining(['Maritime']),
                );
                expect(options.find((option) => option.name === 'Fighter')?.parents).toEqual(['Air']);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });

        /**
         * @objective Ensure Delete this value blocks when it would orphan a child, then
         * allows deleting the leaf and saving the remaining root.
         */
        test('blocks deleting a parent that would orphan a child, then deletes the leaf', async ({pw}) => {
            const {adminUser, adminClient} = await requireHierarchicalAttributesEnabled(pw);

            const timestamp = Date.now();
            const displayName = `Playwright Del ${timestamp}`;
            const expectedName = `playwright_del_${timestamp}`;

            try {
                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await page.getByTestId('newAttributeButton').click();
                await page.getByTestId('attributeDisplayNameInput').fill(displayName);

                await page.getByTestId('attributeTypeMenuButton').click();
                await page.getByRole('menuitemradio', {name: 'Hierarchical'}).click();

                await page.getByTestId('attributeOptionsGraphEmpty__nameInput').fill('Air');
                await page.getByTestId('attributeOptionsGraphEmpty__addButton').click();
                await openGraphRowMenu(page, 'Air');
                await page.getByRole('menuitem', {name: 'Add child'}).click();
                await page.getByTestId('attributeOptionsGraphRow__childNameInput').fill('Fighter');
                await page.getByTestId('attributeOptionsGraphRow__childAddButton').click();

                // # Delete Air — blocked because Fighter would be orphaned
                await openGraphRowMenu(page, 'Air');
                await page.getByRole('menuitem', {name: 'Delete this value'}).click();
                await expect(page.getByRole('heading', {name: 'Move one value first'})).toBeVisible();
                await expect(page.getByText(/would leave "Fighter" with no parent/)).toBeVisible();
                await page.getByRole('button', {name: 'Go to "Fighter"'}).click();

                // * Air and Fighter are both still on the canvas
                await expect(graphRow(page, 'Air')).toBeVisible();
                await expect(graphRow(page, 'Fighter', 'Air')).toBeVisible();

                // # Delete the leaf instead
                await openGraphRowMenu(page, 'Fighter', 'Air');
                await page.getByRole('menuitem', {name: 'Delete this value'}).click();
                await expect(page.getByRole('heading', {name: 'Delete "Fighter"?'})).toBeVisible();
                await page.getByRole('button', {name: 'Delete the value'}).click();

                await expect(graphRow(page, 'Fighter', 'Air')).toHaveCount(0);
                await expect(graphRow(page, 'Air')).toBeVisible();

                await page.getByTestId('saveSetting').click();
                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));

                const field = await getGlobalAttributeFieldByName(adminClient, expectedName);
                expect(field?.id).toBeTruthy();
                const options = await getGlobalAttributeFieldOptions(adminClient, field!.id);
                expect(options.map((option) => option.name)).toEqual(['Air']);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, expectedName);
            }
        });
    });

    test.describe('delete attribute', () => {
        /**
         * @objective Ensure the row kebab's Delete action removes the attribute end-to-end:
         * the confirmation names the attribute, and confirming drops the row from the table.
         */
        test('deletes an attribute from the row menu after confirming, and the row disappears', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_delete_${timestamp}`;
            const displayName = `E2E Delete Attribute ${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                const row = page.locator('tr', {
                    has: page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row).toBeVisible();

                // # Open the row kebab and click Delete
                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
                await page.locator(`#global-attribute-actions-${field.id}-delete`).click();

                // * The confirmation names the specific attribute rather than prompting generically
                await expect(page.getByRole('heading', {name: `Delete ${displayName} attribute`})).toBeVisible();

                // # Confirm
                await page.getByRole('button', {name: 'Delete', exact: true}).click();

                // * The row is gone and no error banner appeared
                await expect(row).toHaveCount(0);
                await expect(page.getByTestId('global-attributes-delete-error')).toHaveCount(0);

                // * The delete really hit the server, not just the client store — a fresh
                // page load still doesn't show it
                await page.reload();
                await expect(page.getByTestId('global-attribute-name').filter({hasText: displayName})).toHaveCount(0);
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure cancelling the confirmation is a true no-op — no delete call fires
         * and the attribute survives a reload.
         */
        test('leaves the attribute in place when the confirmation is cancelled', async ({pw}) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_cancel_${timestamp}`;
            const displayName = `E2E Cancel Attribute ${timestamp}`;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                const row = page.locator('tr', {
                    has: page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row).toBeVisible();

                // # Open the row kebab, click Delete, then back out
                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
                await page.locator(`#global-attribute-actions-${field.id}-delete`).click();
                await expect(page.getByRole('heading', {name: `Delete ${displayName} attribute`})).toBeVisible();
                await page.getByRole('button', {name: 'Cancel'}).click();

                // * The modal closed and the row survived
                await expect(page.getByRole('heading', {name: `Delete ${displayName} attribute`})).toHaveCount(0);
                await expect(row).toBeVisible();

                // * Nothing was deleted server-side either
                await page.reload();
                await expect(page.getByTestId('global-attribute-name').filter({hasText: displayName})).toBeVisible();
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });

        /**
         * @objective Ensure a server-side 409 (the attribute still has live linked dependents)
         * surfaces as the specific "still linked" banner above the table, not the generic error,
         * and leaves the row intact. Exercised against a real 409 from the server rather than a
         * stubbed rejection.
         */
        test('shows the linked-dependents banner and keeps the row when the server refuses the delete', async ({
            pw,
        }) => {
            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);

            const timestamp = Date.now();
            const name = `e2e_global_attribute_linked_${timestamp}`;
            const displayName = `E2E Linked Attribute ${timestamp}`;
            const dependentName = `e2e_global_attribute_dependent_${timestamp}`;

            let dependentFieldId: string | undefined;

            try {
                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });

                // # Point a dependent field at it, which is what makes the server refuse the delete
                const dependent = await createLinkedDependentField(adminClient, dependentName, field.id, 'text');
                dependentFieldId = dependent.id;

                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
                const {page} = systemConsolePage;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                const row = page.locator('tr', {
                    has: page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row).toBeVisible();

                // # Try to delete it
                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
                await page.locator(`#global-attribute-actions-${field.id}-delete`).click();
                await page.getByRole('button', {name: 'Delete', exact: true}).click();

                // * The banner explains the blocking dependency instead of the generic failure
                const banner = page.getByTestId('global-attributes-delete-error');
                await expect(banner).toBeVisible();
                await expect(banner).toContainText('other attributes are still linked to it');
                await expect(banner).not.toContainText('An error occurred while deleting this attribute');

                // * The row survived the rejected delete
                await expect(row).toBeVisible();

                // # The banner is dismissible
                await banner.getByRole('button', {name: 'Close'}).click();
                await expect(banner).toHaveCount(0);
            } finally {
                // Dependent first: the source delete stays blocked while it exists
                if (dependentFieldId) {
                    await deleteLinkedDependentField(adminClient, dependentFieldId);
                }
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });
    });
});

function graphRow(page: Page, optionName: string, parentName = '') {
    return page.locator(
        `[data-testid="attributeOptionsGraphRow"][data-option-name="${optionName}"][data-parent-name="${parentName}"]`,
    );
}

async function openGraphRowMenu(page: Page, optionName: string, parentName = '') {
    await graphRow(page, optionName, parentName).getByTestId('attributeOptionsGraphRow__menu').click();
}
