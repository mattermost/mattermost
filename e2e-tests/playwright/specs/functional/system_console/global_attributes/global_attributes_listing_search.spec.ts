// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Global Attributes listing search (MM-70661).
 * The listing endpoint searches display name and internal name, case-insensitive substring,
 * with `%` and `_` matched literally. Type words ("select") no longer match.
 *
 * Every term embeds a per-test suffix so a search can only ever match the rows the test seeded.
 */

import {expect, test} from '@mattermost/playwright-lib';

import {requireGlobalAttributesEnabled} from './global_attributes_helpers';
import {ListingSeeder} from './listing_helpers';

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

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            await globalAttributes.gotoListing();

            // # Search for the display name
            await globalAttributes.search(`Clearance Tier ${suffix}`);

            // * Only the matching row remains
            await expect(globalAttributes.rowByLabel(displayName)).toBeVisible();
            await expect(globalAttributes.rows).toHaveCount(1);
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

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            await globalAttributes.gotoListing();

            // # Search for the internal name
            await globalAttributes.search(template.name);

            // * The row is found under its display name
            await expect(globalAttributes.rowByLabel(displayName)).toBeVisible();
            await expect(globalAttributes.rows).toHaveCount(1);
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

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            await globalAttributes.gotoListing();

            // # Search an upper-case fragment from the middle of the display name
            await globalAttributes.search(`COST CENTER ${suffix.toUpperCase()}`);

            // * The row matches despite the case and the missing prefix
            await expect(globalAttributes.rowByLabel(displayName)).toBeVisible();
            await expect(globalAttributes.rows).toHaveCount(1);

            // # Search a lower-case fragment from the middle of the display name
            await globalAttributes.search(`partment cost center ${suffix}`);

            // * The row still matches
            await expect(globalAttributes.rowByLabel(displayName)).toBeVisible();
            await expect(globalAttributes.rows).toHaveCount(1);
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

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            await globalAttributes.gotoListing();

            // # Search with a percent sign
            await globalAttributes.search(`100% ${suffix}`);

            // * Only the literal percent label matches
            await expect(globalAttributes.rowByLabel(percentLabel)).toBeVisible();
            await expect(globalAttributes.rowByLabel(percentDecoy)).toHaveCount(0);

            // # Search with an underscore
            await globalAttributes.search(`Cost_Code ${suffix}`);

            // * Only the literal underscore label matches
            await expect(globalAttributes.rowByLabel(underscoreLabel)).toBeVisible();
            await expect(globalAttributes.rowByLabel(underscoreDecoy)).toHaveCount(0);
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

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            await globalAttributes.gotoListing();
            await expect(globalAttributes.rowByLabel(displayName)).toBeVisible();

            // # Search for something that exists nowhere
            await globalAttributes.search(`nothing-matches-${suffix}`);

            // * The no-results state replaces the rows, and it is not the "no attributes" state
            await expect(globalAttributes.emptySearchState).toBeVisible();
            await expect(globalAttributes.emptyState).toHaveCount(0);
            await expect(globalAttributes.rows).toHaveCount(0);

            // # Clear the search
            await globalAttributes.clearSearch();

            // * The rows return
            await expect(globalAttributes.emptySearchState).toHaveCount(0);
            await expect(globalAttributes.rowByLabel(displayName)).toBeVisible();
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

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            await globalAttributes.gotoListing();
            await expect(globalAttributes.rowByLabel(displayName)).toBeVisible();

            // # Search for the type word
            await globalAttributes.search('select');

            // * The row is not matched through its type, though it renders the "Select" type label
            await expect(globalAttributes.rowByLabel(displayName)).toHaveCount(0);
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

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            await globalAttributes.gotoListing();

            // # Search the shared term
            await globalAttributes.search('Region');

            // * Both matching rows show and the other does not
            await expect(globalAttributes.rowByLabel(templateLabel)).toBeVisible();
            await expect(globalAttributes.rowByLabel(userFieldLabel)).toBeVisible();
            await expect(globalAttributes.rowByLabel(otherLabel)).toHaveCount(0);
        } finally {
            await seeder.cleanup();
        }
    });
});
