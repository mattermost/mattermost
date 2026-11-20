// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Global Attributes listing search.
 * The listing endpoint searches display name and internal name, case-insensitive substring,
 * with `%` and `_` matched literally. Type words ("select") no longer match.
 *
 * Every term embeds a per-test suffix so a search can only ever match the rows the test seeded.
 */

import {expect, test} from '@mattermost/playwright-lib';

import {openAttributeManagement, requireGlobalAttributesEnabled} from './global_attributes_helpers';
import {ListingSeeder, searchListing} from './listing_helpers';

test.describe('System Console - Global Attributes listing search', {tag: '@system_console'}, () => {
    /**
     * @objective Ensure the search matches an attribute by its display name when that differs
     * from the internal name.
     */
    test('finds an attribute by its display name', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed a template whose display name shares nothing with its internal name
            const displayName = `Clearance Tier ${suffix}`;
            await seeder.template({key: 'internal_alpha', displayName});
            await seeder.template({key: 'internal_beta', displayName: `Other Thing ${suffix}`});

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);

            // # Search for the display name
            await searchListing(app, `Clearance Tier ${suffix}`);

            // * Only the matching row remains
            await expect(attributes.row(seeder.idForLabel(displayName))).toBeVisible();
            await expect(attributes.rowList).toHaveKeyCount(1);
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure the search matches an attribute by its internal name even when the
     * row displays a different display name.
     */
    test('finds an attribute by its internal name', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed a template with an internal name unrelated to its display name
            const displayName = `Shown Label ${suffix}`;
            const template = await seeder.template({key: 'hidden_handle', displayName});

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);

            // # Search for the internal name
            await searchListing(app, template.name);

            // * The row is found under its display name
            await expect(attributes.row(seeder.idForLabel(displayName))).toBeVisible();
            await expect(attributes.rowList).toHaveKeyCount(1);
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure the search ignores case and matches substrings anywhere in the label.
     */
    test('matches case-insensitively and by substring', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed one attribute whose display name has mixed case
            const displayName = `Department Cost Center ${suffix}`;
            await seeder.template({key: 'case_probe', displayName});

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);

            // # Search an upper-case fragment from the middle of the display name
            await searchListing(app, `COST CENTER ${suffix.toUpperCase()}`);

            // * The row matches despite the case and the missing prefix
            await expect(attributes.row(seeder.idForLabel(displayName))).toBeVisible();
            await expect(attributes.rowList).toHaveKeyCount(1);

            // # Search a lower-case fragment from the middle of the display name
            await searchListing(app, `partment cost center ${suffix}`);

            // * The row still matches
            await expect(attributes.row(seeder.idForLabel(displayName))).toBeVisible();
            await expect(attributes.rowList).toHaveKeyCount(1);
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure `%` and `_` in the search term are matched literally rather than
     * acting as SQL wildcards.
     */
    test('treats percent and underscore in the term literally', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed labels that differ only where a wildcard would match
            const percentLabel = `Rate 100% ${suffix}`;
            const percentDecoy = `Rate 100x ${suffix}`;
            const underscoreLabel = `Cost_Code ${suffix}`;
            const underscoreDecoy = `CostXCode ${suffix}`;
            await seeder.template({key: 'percent_literal', displayName: percentLabel});
            await seeder.template({key: 'percent_decoy', displayName: percentDecoy});
            await seeder.template({key: 'underscore_literal', displayName: underscoreLabel});
            await seeder.template({key: 'underscore_decoy', displayName: underscoreDecoy});

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);

            // # Search with a percent sign
            await searchListing(app, `100% ${suffix}`);

            // * Only the literal percent label matches
            await expect(attributes.row(seeder.idForLabel(percentLabel))).toBeVisible();
            await expect(attributes.row(seeder.idForLabel(percentDecoy))).toHaveCount(0);

            // # Search with an underscore
            await searchListing(app, `Cost_Code ${suffix}`);

            // * Only the literal underscore label matches
            await expect(attributes.row(seeder.idForLabel(underscoreLabel))).toBeVisible();
            await expect(attributes.row(seeder.idForLabel(underscoreDecoy))).toHaveCount(0);
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure a search with no match shows the no-results state, and clearing the
     * search brings the rows back.
     */
    test('shows the empty-search state for no match and restores rows when cleared', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed an attribute so the listing is not empty
            const displayName = `Restorable ${suffix}`;
            await seeder.template({key: 'restorable', displayName});

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);
            await expect(attributes.row(seeder.idForLabel(displayName))).toBeVisible();

            // # Search for something that exists nowhere
            await searchListing(app, `nothing-matches-${suffix}`);

            // * The no-results state replaces the rows, and it is not the "no attributes" state
            await expect(attributes.emptySearchText).toBeVisible();
            await expect(attributes.emptyText).toHaveCount(0);
            await expect(attributes.rowList).toHaveKeyCount(0);

            // # Clear the search
            await searchListing(app, '');

            // * The rows return
            await expect(attributes.emptySearchText).toHaveCount(0);
            await expect(attributes.row(seeder.idForLabel(displayName))).toBeVisible();
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure the search no longer matches the localized type label, so typing a type
     * word does not surface attributes that merely have that type.
     */
    test('does not match attributes by their type label', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed a select attribute whose label and name contain no type word
            const displayName = `Badge Colour ${suffix}`;
            await seeder.template({
                key: 'badge_colour',
                displayName,
                type: 'select',
                attrs: {options: [{id: '', name: 'Red'}]},
            });

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);
            await expect(attributes.row(seeder.idForLabel(displayName))).toBeVisible();

            // # Search for the type word
            await searchListing(app, 'select');

            // * The row is not matched through its type, though it renders the "Select" type label
            await expect(attributes.row(seeder.idForLabel(displayName))).toHaveCount(0);
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure the search covers unlinked system fields as well as templates, so the
     * two kinds of row are searched together.
     */
    test('searches templates and unlinked system fields together', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed a template and an unlinked user field sharing a term, plus a non-matching template
            const templateLabel = `Region Template ${suffix}`;
            const userFieldLabel = `Region User Field ${suffix}`;
            const otherLabel = `Unrelated ${suffix}`;
            await seeder.template({key: 'region_template', displayName: templateLabel});
            await seeder.unlinkedField('user', {key: 'region_user', displayName: userFieldLabel});
            await seeder.template({key: 'unrelated', displayName: otherLabel});

            const {app} = await pw.testBrowser.login(adminUser);
            const attributes = await openAttributeManagement(app);

            // # Search the shared term
            await searchListing(app, 'Region');

            // * Both matching rows show and the other does not
            await expect(attributes.row(seeder.idForLabel(templateLabel))).toBeVisible();
            await expect(attributes.row(seeder.idForLabel(userFieldLabel))).toBeVisible();
            await expect(attributes.row(seeder.idForLabel(otherLabel))).toHaveCount(0);
        } finally {
            await seeder.cleanup();
        }
    });
});
