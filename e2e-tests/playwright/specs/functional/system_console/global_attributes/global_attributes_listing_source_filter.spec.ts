// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Global Attributes listing source filter.
 * Options: All, Managed here, AD/LDAP, SAML, OpenID Connect, Plugin. Managed here means no plugin, no sync
 * mapping and no owners; rows with only service/role/user owners ("Managed by X") match All only.
 * A row synced from several sources matches each of them.
 *
 * Every test searches for a per-test suffix first, so a filter can only ever show the rows the
 * test seeded.
 */

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {openAttributeManagement, requireGlobalAttributesEnabled} from './global_attributes_helpers';
import {ListingSeeder, searchListing, filterListing} from './listing_helpers';

test.describe('System Console - Global Attributes listing source filter', {tag: '@system_console'}, () => {
    /**
     * @objective Ensure each source option narrows the listing to the rows of that source, and
     * All shows every row again.
     */
    test('filters rows by managed, LDAP, SAML, OpenID and plugin source', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed one row per source (plugin via a plugin-type owner: source_plugin_id + protected
            // can only be written by an installed plugin)
            const managed = `Managed Row ${suffix}`;
            const ldap = `Ldap Row ${suffix}`;
            const saml = `Saml Row ${suffix}`;
            const openid = `Openid Row ${suffix}`;
            const plugin = `Plugin Row ${suffix}`;
            await seeder.template({key: 'src_managed', displayName: managed});
            await seeder.syncedTemplate({key: 'src_ldap', displayName: ldap}, ['ldap']);
            await seeder.syncedTemplate({key: 'src_saml', displayName: saml}, ['saml']);
            await seeder.syncedTemplate({key: 'src_openid', displayName: openid}, ['openid']);
            await seeder.ownedTemplate({key: 'src_plugin', displayName: plugin}, [
                {id: `e2e-plugin-${suffix}`, type: 'plugin'},
            ]);

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);
            await searchListing(app, suffix);

            const all = [managed, ldap, saml, openid, plugin];
            const cases: Array<{
                source: 'Managed here' | 'AD/LDAP' | 'SAML' | 'OpenID Connect' | 'Plugin';
                shown: string;
            }> = [
                {source: 'Managed here', shown: managed},
                {source: 'AD/LDAP', shown: ldap},
                {source: 'SAML', shown: saml},
                {source: 'OpenID Connect', shown: openid},
                {source: 'Plugin', shown: plugin},
            ];

            // * The filter defaults to All, and every seeded row shows
            await expect(attributes.sourceFilter.input.container).toHaveValue('All');
            await expect(attributes.rowList).toHaveKeyCount(all.length);

            for (const {source, shown} of cases) {
                // # Pick the source
                await filterListing(app, 'source', source);

                // * Only that source's row shows, and the filter shows the pick
                await expect(attributes.rowList).toHaveKeyCount(1);
                await expect(attributes.row(seeder.idForLabel(shown))).toBeVisible();
                await expect(attributes.sourceFilter.input.container).toHaveValue(source);
            }

            // # Return to All
            await filterListing(app, 'source', 'All');

            // * Every seeded row shows again
            await expect(attributes.rowList).toHaveKeyCount(all.length);
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure a row with only non-plugin owners ("Managed by X") appears under All
     * and under none of the specific source options.
     */
    test('shows owner-only rows under All and no specific source', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed a template owned by a service
            const label = `Service Owned ${suffix}`;
            await seeder.ownedTemplate({key: 'svc_owned', displayName: label}, [
                {id: `e2e-service-${suffix}`, type: 'service'},
            ]);

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);
            await searchListing(app, suffix);

            // * Visible under the default All, rendered as managed by its owner
            await expect(attributes.row(seeder.idForLabel(label))).toBeVisible();
            await expect(attributes.row(seeder.idForLabel(label)).sourceText).toContainText('Managed by');

            // * Absent under every specific source
            for (const source of ['Managed here', 'AD/LDAP', 'SAML', 'OpenID Connect', 'Plugin'] as const) {
                await filterListing(app, 'source', source);
                await expect(attributes.row(seeder.idForLabel(label))).toHaveCount(0);
            }
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure a row synced from two sources appears under both source options.
     */
    test('lists a row synced from LDAP and SAML under both', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed a template mapped to both LDAP and SAML
            const label = `Dual Source ${suffix}`;
            await seeder.syncedTemplate({key: 'dual_source', displayName: label}, ['ldap', 'saml']);

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);
            await searchListing(app, suffix);

            // # Filter by LDAP
            await filterListing(app, 'source', 'AD/LDAP');

            // * The row shows
            await expect(attributes.row(seeder.idForLabel(label))).toBeVisible();

            // # Filter by SAML
            await filterListing(app, 'source', 'SAML');

            // * The same row shows
            await expect(attributes.row(seeder.idForLabel(label))).toBeVisible();

            // # Filter by OpenID
            await filterListing(app, 'source', 'OpenID Connect');

            // * It does not match a source it is not mapped to
            await expect(attributes.row(seeder.idForLabel(label))).toHaveCount(0);
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure the source filter and the search combine, so only rows that satisfy
     * both stay.
     */
    test('combines the source filter with search', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed two LDAP rows and one managed row sharing the first's search stem
            const ldapAlpha = `Alpha ${suffix} Ldap`;
            const ldapBeta = `Beta ${suffix} Ldap`;
            const managedAlpha = `Alpha ${suffix} Managed`;
            await seeder.syncedTemplate({key: 'combo_ldap_alpha', displayName: ldapAlpha}, ['ldap']);
            await seeder.syncedTemplate({key: 'combo_ldap_beta', displayName: ldapBeta}, ['ldap']);
            await seeder.template({key: 'combo_managed_alpha', displayName: managedAlpha});

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);

            // # Filter to LDAP, then search for the shared stem
            await filterListing(app, 'source', 'AD/LDAP');
            await searchListing(app, `Alpha ${suffix}`);

            // * Only the LDAP row that also matches the term shows
            await expect(attributes.rowList).toHaveKeyCount(1);
            await expect(attributes.row(seeder.idForLabel(ldapAlpha))).toBeVisible();

            // # Switch the source with the term kept
            await filterListing(app, 'source', 'Managed here');

            // * Now only the managed row matching the term shows
            await expect(attributes.rowList).toHaveKeyCount(1);
            await expect(attributes.row(seeder.idForLabel(managedAlpha))).toBeVisible();
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure filters that match nothing show a no-match state distinct from the
     * empty listing, and Clear filters resets both the search and the source.
     */
    test('clears the search and source from the no-match state', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed one managed row and nothing synced from OpenID
            const label = `Clear Me ${suffix}`;
            await seeder.template({key: 'clear_managed', displayName: label});

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);
            await searchListing(app, suffix);

            // # Filter to a source the row is not from
            await filterListing(app, 'source', 'OpenID Connect');

            // * The no-match state shows with Clear filters, not the empty-listing state
            await expect(attributes.emptySearchText).toContainText('No attributes match your search or filters.');
            await expect(attributes.emptyText).toHaveCount(0);
            await expect(attributes.clearFiltersButton).toBeVisible();

            // # Clear filters
            await settle(attributes.clearFiltersButton, {wait: Api.SearchGlobalAttributes}).click();
            await expect(attributes.clearFiltersButton).not.toBeVisible();

            // * The search is empty, the source is back to All, and the row shows again
            await expect(attributes.search.container).toHaveValue('');
            await expect(attributes.sourceFilter.input.container).toHaveValue('All');
            await expect(attributes.row(seeder.idForLabel(label))).toBeVisible();
            await expect(attributes.emptySearchText).toHaveCount(0);
        } finally {
            await seeder.cleanup();
        }
    });
});
