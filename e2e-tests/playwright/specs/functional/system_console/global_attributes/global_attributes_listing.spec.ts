// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Global Attributes access gate and attribute listing.
 * Visibility is gated by an Enterprise-tier license.
 * Once past the gate, the page lists every access_control/template property field on the server.
 *
 * Local runs: upload or use a license with SkuShortName `enterprise`, `entry`, or `advanced`.
 * Professional-only licenses hide this admin route (React Router redirects away).
 */

import {expect, test, Msg, Api, settle, postWith} from '@mattermost/playwright-lib';
import type {App} from '@mattermost/playwright-lib';

import {
    GLOBAL_ATTRIBUTES_ADMIN_PATH,
    createGlobalAttributeField,
    createLinkedDependentField,
    deleteGlobalAttributeFieldIfExists,
    deleteLinkedDependentField,
    requireGlobalAttributesEnabled,
} from './global_attributes_helpers';

/** Bounds the native listing controls to their Attribute Management panel. */
function attributeListing(app: App) {
    // This panel has no generated scope; its existing root id bounds its rows and search controls.
    return app.page.getByTestId('globalAttributes');
}

/** The delete confirmation has no declared scope; its title identifies the attribute. */
function deleteAttributeDialog(app: App, displayName: string) {
    // The confirmation is portalled outside the undeclared listing panel.
    return app.page.getByRole('dialog').filter({hasText: `Delete ${displayName} attribute`});
}

test.describe('System Console - Global Attributes listing', {tag: '@system_console'}, () => {
    test.describe.configure({mode: 'serial'});

    test.describe('access gate', () => {
        /**
         * @objective Ensure the Attribute Management page is reachable and shows its page frame
         * on an Enterprise+ license.
         */
        test('Enterprise+ license shows Attribute Management', async ({pw}) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            // # Log in and open the Attribute Management URL
            const {app} = await pw.testBrowser.login(adminUser);
            await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

            // * URL stays on the Attribute Management section
            await expect(app.page).toHaveURL(/manage_attributes/);
            // * Sidebar menu entry and page heading are both visible ("Attribute Management"
            // renders in both places, so each is asserted within its own scope)
            // The sidebar entry has no generated text part; check its label inside the declared sidebar.
            await expect(app.admin.sidebar.locator.getByText('Attribute Management')).toBeVisible();
            // The page title has no generated text part; check its label inside the declared admin header.
            await expect(app.admin.header.locator.getByText('Attribute Management')).toBeVisible();
            // * The old User Attributes sidebar entry is replaced by Attribute Management
            // The removed sidebar label has no generated part; its absence is checked within the declared sidebar.
            await expect(app.admin.sidebar.locator.getByText('User Attributes', {exact: true})).not.toBeVisible();
            // * Page frame's static subtitle is present (renders regardless of fetch state)
            // The page subtitle is plain text without a declared part.
            await expect(
                attributeListing(app).getByText('Define an attribute once, then choose which resources can use it.'),
            ).toBeVisible();
        });
    });

    test.describe('listing', () => {
        /**
         * @objective Ensure a real access_control/template attribute renders in the table with
         * its display name, type icon+label, source, and options count — across every field
         * type the Type column has a mapping for (Text/Phone/URL/Email/Select/Multiselect/Ranked),
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
            // Phone/URL/email are text-field subtypes (attrs.value_type); the create menu offers
            // Phone and URL, while email is API-only (hidden in the Type menu, still listed).
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
                    name: `e2e_global_attribute_phone_${timestamp}`,
                    displayName: `E2E Phone Attribute ${timestamp}`,
                    type: 'text',
                    attrs: {value_type: 'phone'},
                    expectedType: 'Phone',
                    expectedOptions: 'Free Text',
                },
                {
                    name: `e2e_global_attribute_url_${timestamp}`,
                    displayName: `E2E URL Attribute ${timestamp}`,
                    type: 'text',
                    attrs: {value_type: 'url'},
                    expectedType: 'URL',
                    expectedOptions: 'Free Text',
                },
                {
                    name: `e2e_global_attribute_email_${timestamp}`,
                    displayName: `E2E Email Attribute ${timestamp}`,
                    type: 'text',
                    attrs: {value_type: 'email'},
                    expectedType: 'Email',
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
                // through (e.g. field 3 of 8), the finally below still cleans up whatever
                // was already created instead of leaving it orphaned on the shared server.
                for (const seed of seeds) {
                    await createGlobalAttributeField(adminClient, seed.name, {
                        type: seed.type,
                        attrs: {display_name: seed.displayName, ...seed.attrs},
                    });
                }

                // # Log in and open the Attribute Management page once every field is seeded
                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                for (const seed of seeds) {
                    // Re-rooted `has` probe on the name cell's testid+text, mirroring the
                    // established row-lookup pattern (see board_attributes.ts's rowByName).
                    // The attributes table declares no parts for its rows and actions: rows are addressed by the legacy global-attribute-name / -type testids and the action ids.
                    const row = attributeListing(app).locator('tr', {
                        has: app.page.getByTestId('global-attribute-name').filter({hasText: seed.displayName}),
                    });

                    // * Each seeded field's display name, type, source, and options render correctly
                    await expect(row.getByTestId('global-attribute-name')).toHaveText(seed.displayName);
                    await expect(row.getByTestId('global-attribute-type')).toContainText(seed.expectedType);
                    // * A leading icon renders alongside the label, including for the
                    // unmapped "date" type (fallback icon, not a blank cell)
                    await expect(row.getByTestId('global-attribute-type').locator('svg')).toBeVisible();
                    await expect(row.getByTestId('global-attribute-source')).toContainMessage(
                        Msg.admin.global_attributes.table.source.managed,
                    );
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

                const {app} = await pw.testBrowser.login(adminUser);
                await app.page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                // # Narrow the listing to this test's rows, which a shared server's other rows
                // would otherwise crowd
                // The attributes table declares no parts for its rows and actions: rows are addressed by the legacy global-attribute-name / -type testids and the action ids.
                await app.page.getByPlaceholder('Search').fill(String(timestamp));
                await expect(app.page.getByPlaceholder('Search')).toHaveValue(String(timestamp));

                await attributeListing(app).getByTestId('global-attribute-name').getByText(firstDisplayName).waitFor();

                // * The fallback field renders under its internal name, since no display_name was set
                await expect(
                    attributeListing(app).getByTestId('global-attribute-name').getByText(thirdName),
                ).toBeVisible();

                // * Rendered order follows the displayed Attribute value (Aardvark, then the
                // fallback name, then Zebra) — not the internal name (which would put "aaa_..."
                // first if sorted that way)
                const names = await attributeListing(app).getByTestId('global-attribute-name').allTextContents();
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
         * @objective Verify each attribute's persisted sort_order propagates to profile settings
         * and popover ordering. The Manage Attributes table has no manual reorder control today,
         * so this sets sort_order directly via the API rather than through a UI action.
         */
        test("propagates each attribute's persisted sort_order to profile settings and popover ordering", async ({
            pw,
        }) => {
            await requireGlobalAttributesEnabled(pw);
            const {adminClient, team, user} = await pw.initSetup();

            const timestamp = Date.now();
            const labels = [`PW Sort First ${timestamp}`, `PW Sort Second ${timestamp}`, `PW Sort Third ${timestamp}`];
            const names = labels.map((_, index) => `e2e_global_attribute_sort_${index}_${timestamp}`);
            const linkedIds: string[] = [];

            try {
                // # Create three attributes with sort_order descending relative to creation
                // order, so the rendered order proves it follows sort_order, not insertion order.
                for (const [index, label] of labels.entries()) {
                    const template = await createGlobalAttributeField(adminClient, names[index], {
                        type: 'text',
                        attrs: {display_name: label, sort_order: (labels.length - index) * 10},
                    });
                    const linked = await createLinkedDependentField(
                        adminClient,
                        names[index],
                        template.id,
                        'text',
                        'user',
                        {display_name: label, sort_order: (labels.length - index) * 10, visibility: 'always'},
                    );
                    linkedIds.push(linked.id);

                    await adminClient.updateUserCustomProfileAttributesValues(user.id, {
                        [linked.id]: `Value ${index + 1}`,
                    });
                }

                // sort_order is 30/20/10 for First/Second/Third, so ascending order is
                // Third, Second, First.
                const expectedOrder = [labels[2], labels[1], labels[0]];

                // * The expected order renders in profile settings (Settings > Profile)
                const {app} = await pw.testBrowser.login(user);
                await app.channelsPage.goto({team, channel: 'town-square'});
                await app.globalHeader.openAccountMenuButton.clickTo(app.globalHeader.accountMenu.nameMenuItem);
                await app.globalHeader.accountMenu.profileMenuItem.clickTo(app.userSettingsModal);
                await expect
                    .poll(async () => {
                        const keys = await app.settings.customAttributeList.keys();
                        const headings = await Promise.all(
                            keys.map((key) => app.settings.customAttribute(key).titleText.text()),
                        );
                        return headings.filter((heading) => labels.includes(heading));
                    })
                    .toEqual(expectedOrder);
                await app.userSettingsModal.closeButton.click();
                await expect(app.userSettingsModal).not.toBeVisible();

                // * The same order renders in the profile popover
                const message = `sort-order-${timestamp}`;
                await app.center.postCreate.message.container.fill(message);
                await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
                const post = await postWith(app.center.postList, {text: message});
                await post.container.hover();
                await post.avatar.container.click();
                await expect(app.profilePopover).toBeVisible();
                // Attribute headings have no generated text part in the popover.
                await expect
                    .poll(async () => {
                        const headings = await app.profilePopover.locator
                            .getByRole('heading', {level: 3})
                            .allTextContents();
                        return headings.filter((heading) => labels.includes(heading));
                    })
                    .toEqual(expectedOrder);
            } finally {
                for (const linkedId of linkedIds) {
                    await deleteLinkedDependentField(adminClient, linkedId);
                }
                for (const name of names) {
                    await deleteGlobalAttributeFieldIfExists(adminClient, name);
                }
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

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                // The listing has no generated row family; its native table bounds the attribute row.
                const row = attributeListing(app).locator('tr', {
                    // The has-filter resolves this native name cell relative to each row in the bounded listing.
                    has: page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row).toBeVisible();

                // # Open the row kebab and click Delete
                await attributeListing(app).getByTestId(`global-attribute-actions-${field.id}`).click();
                // The attributes table declares no parts for its rows and actions: rows are addressed by the legacy global-attribute-name / -type testids and the action ids.
                await expect(page.locator(`#global-attribute-actions-${field.id}-delete`)).toBeVisible();
                await page.locator(`#global-attribute-actions-${field.id}-delete`).click();
                await expect(
                    deleteAttributeDialog(app, displayName).getByRole('button', {name: 'Delete', exact: true}),
                ).toBeVisible();

                // * The confirmation names the specific attribute rather than prompting generically
                await expect(
                    deleteAttributeDialog(app, displayName).getByRole('heading', {
                        name: `Delete ${displayName} attribute`,
                    }),
                ).toBeVisible();

                // # Confirm
                await deleteAttributeDialog(app, displayName)
                    .getByRole('button', {name: 'Delete', exact: true})
                    .click();

                // * The row is gone and no error banner appeared
                await expect(row).toHaveCount(0);
                await expect(attributeListing(app).getByTestId('global-attributes-delete-error')).toHaveCount(0);

                // * The delete really hit the server, not just the client store — a fresh
                // page load still doesn't show it
                await page.reload();
                await expect(
                    attributeListing(app).getByTestId('global-attribute-name').filter({hasText: displayName}),
                ).toHaveCount(0);
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

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                // The listing has no generated row family; its native table bounds the attribute row.
                const row = attributeListing(app).locator('tr', {
                    // The has-filter resolves this native name cell relative to each row in the bounded listing.
                    has: page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row).toBeVisible();

                // # Open the row kebab, click Delete, then back out
                await attributeListing(app).getByTestId(`global-attribute-actions-${field.id}`).click();
                // The attributes table declares no parts for its rows and actions: rows are addressed by the legacy global-attribute-name / -type testids and the action ids.
                await expect(page.locator(`#global-attribute-actions-${field.id}-delete`)).toBeVisible();
                await page.locator(`#global-attribute-actions-${field.id}-delete`).click();
                await expect(
                    deleteAttributeDialog(app, displayName).getByRole('button', {name: 'Delete', exact: true}),
                ).toBeVisible();
                await expect(
                    deleteAttributeDialog(app, displayName).getByRole('heading', {
                        name: `Delete ${displayName} attribute`,
                    }),
                ).toBeVisible();
                await deleteAttributeDialog(app, displayName).getByRole('button', {name: 'Cancel'}).click();

                // * The modal closed and the row survived
                await expect(
                    deleteAttributeDialog(app, displayName).getByRole('heading', {
                        name: `Delete ${displayName} attribute`,
                    }),
                ).toHaveCount(0);
                await expect(row).toBeVisible();

                // * Nothing was deleted server-side either
                await page.reload();
                await expect(
                    attributeListing(app).getByTestId('global-attribute-name').filter({hasText: displayName}),
                ).toBeVisible();
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

                const {app} = await pw.testBrowser.login(adminUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);

                // The listing has no generated row family; its native table bounds the attribute row.
                const row = attributeListing(app).locator('tr', {
                    // The has-filter resolves this native name cell relative to each row in the bounded listing.
                    has: page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row).toBeVisible();

                // # Try to delete it
                await attributeListing(app).getByTestId(`global-attribute-actions-${field.id}`).click();
                // The attributes table declares no parts for its rows and actions: rows are addressed by the legacy global-attribute-name / -type testids and the action ids.
                await expect(page.locator(`#global-attribute-actions-${field.id}-delete`)).toBeVisible();
                await page.locator(`#global-attribute-actions-${field.id}-delete`).click();
                await expect(
                    deleteAttributeDialog(app, displayName).getByRole('button', {name: 'Delete', exact: true}),
                ).toBeVisible();
                await deleteAttributeDialog(app, displayName)
                    .getByRole('button', {name: 'Delete', exact: true})
                    .click();

                // * The banner explains the blocking dependency instead of the generic failure
                const banner = attributeListing(app).getByTestId('global-attributes-delete-error');
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

    test.describe('read-only for non-sysadmin', () => {
        /**
         * @objective Ensure a system_manager (non-sysadmin with System Console access) sees
         * Attribute Management as read-only: New attribute disabled, row menu offers View
         * instead of Edit, and Delete is disabled. The create/edit page they can still open
         * is already schema-gated as read-only; this covers the listing that previously
         * ignored isDisabled.
         */
        test('disables New attribute and Delete, and offers View, for a system_manager', async ({pw}) => {
            const {adminClient} = await requireGlobalAttributesEnabled(pw);
            const {user: systemManagerUser} = await pw.initSetup();

            const timestamp = Date.now();
            const name = `e2e_global_attribute_readonly_${timestamp}`;
            const displayName = `E2E Readonly Attribute ${timestamp}`;

            try {
                await adminClient.updateUserRoles(systemManagerUser.id, 'system_user system_manager');

                const field = await createGlobalAttributeField(adminClient, name, {
                    type: 'text',
                    attrs: {display_name: displayName},
                });

                const {app} = await pw.testBrowser.login(systemManagerUser);
                const {page} = app;
                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
                await expect(page).toHaveURL(/manage_attributes/);

                // * New attribute is disabled — schema isDisabled wires through the listing
                await expect(attributeListing(app).getByTestId('newAttributeButton')).toBeDisabled();

                // The listing has no generated row family; its native table bounds the attribute row.
                const row = attributeListing(app).locator('tr', {
                    // The has-filter resolves this native name cell relative to each row in the bounded listing.
                    has: page.getByTestId('global-attribute-name').filter({hasText: displayName}),
                });
                await expect(row).toBeVisible();

                // # Open the row actions menu
                await attributeListing(app).getByTestId(`global-attribute-actions-${field.id}`).click();
                // The attributes table declares no parts for its rows and actions: rows are addressed by the legacy global-attribute-name / -type testids and the action ids.
                await expect(page.locator(`#global-attribute-actions-${field.id}-delete`)).toBeVisible();

                // * View (not Edit) is offered and navigable; Delete stays disabled
                // The attribute row menu is portalled outside the listing and has no generated menu parts.
                const viewItem = page.locator(`#global-attribute-actions-${field.id}-edit`);
                await expect(viewItem).toContainMessage(Msg.admin.global_attributes.table.actions.view);
                await expect(viewItem).not.toHaveAttribute('aria-disabled', 'true');

                // The attribute row menu is portalled outside the listing and has no generated menu parts.
                const deleteItem = page.locator(`#global-attribute-actions-${field.id}-delete`);
                await expect(deleteItem).toContainText('Delete attribute');
                await expect(deleteItem).toHaveAttribute('aria-disabled', 'true');

                // # View opens the details page (read-only via the same schema isDisabled)
                await viewItem.click();
                await expect(page).toHaveURL(new RegExp(`/attribute_details/${field.id}$`));
                // The attribute detail form has no generated input part; its DOM id identifies the read-only field.
                await expect(page.getByTestId('attributeDisplayNameInput')).toBeDisabled();
            } finally {
                await deleteGlobalAttributeFieldIfExists(adminClient, name);
            }
        });
    });
});
