// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * System Console — Global Attributes listing resource type filter.
 * Options: All, then Users, Channels and Posts as far as the server offers them. A template matches a
 * resource type when it has a live linked field of that type; an unlinked field matches its own type.
 *
 * Every test searches for a per-test suffix first, so a filter can only ever show the rows the
 * test seeded. Channels need an Enterprise Advanced tier licence and the ChannelAttributes flag, posts
 * the PostAttributes flag.
 */

import {expect, test} from '@mattermost/playwright-lib';

import {requireGlobalAttributesEnabled} from './global_attributes_helpers';
import {ListingSeeder} from './listing_helpers';

test.describe('System Console - Global Attributes listing resource type filter', {tag: '@system_console'}, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, PostAttributes: true});
    });

    /**
     * @objective Ensure each resource type option narrows the listing to the templates linked to that
     * type plus the unlinked fields of that type, and All shows every row again.
     */
    test('filters rows by users, channels and posts', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed templates linked to users, to users and channels, and to posts; one template linked
            // to nothing; and one unlinked field of each type
            const userTemplate = `User Template ${suffix}`;
            const userChannelTemplate = `User Channel Template ${suffix}`;
            const postTemplate = `Post Template ${suffix}`;
            const bareTemplate = `Bare Template ${suffix}`;
            const looseUser = `Loose User ${suffix}`;
            const looseChannel = `Loose Channel ${suffix}`;
            const loosePost = `Loose Post ${suffix}`;

            const forUsers = await seeder.template({key: 'res_user', displayName: userTemplate});
            await seeder.linkedChild(forUsers, 'user');
            const forUsersAndChannels = await seeder.template({
                key: 'res_user_channel',
                displayName: userChannelTemplate,
            });
            await seeder.linkedChild(forUsersAndChannels, 'user');
            await seeder.linkedChild(forUsersAndChannels, 'channel');
            const forPosts = await seeder.template({key: 'res_post', displayName: postTemplate});
            await seeder.linkedChild(forPosts, 'post');
            await seeder.template({key: 'res_bare', displayName: bareTemplate});
            await seeder.unlinkedField('user', {key: 'res_loose_user', displayName: looseUser});
            await seeder.unlinkedField('channel', {key: 'res_loose_channel', displayName: looseChannel});
            await seeder.unlinkedField('post', {key: 'res_loose_post', displayName: loosePost});

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            await globalAttributes.gotoListing();
            await globalAttributes.search(suffix);

            const all = [
                userTemplate,
                userChannelTemplate,
                postTemplate,
                bareTemplate,
                looseUser,
                looseChannel,
                loosePost,
            ];
            const cases: Array<{resourceType: 'Users' | 'Channels' | 'Posts'; shown: string[]}> = [
                {resourceType: 'Users', shown: [userTemplate, userChannelTemplate, looseUser]},
                {resourceType: 'Channels', shown: [userChannelTemplate, looseChannel]},
                {resourceType: 'Posts', shown: [postTemplate, loosePost]},
            ];

            // * The filter defaults to All, and every seeded row shows
            await expect(globalAttributes.resourceTypeFilter.getByRole('textbox')).toHaveValue('All');
            await expect(globalAttributes.rows).toHaveCount(all.length);

            for (const {resourceType, shown} of cases) {
                // # Pick the resource type
                await globalAttributes.selectResourceTypeFilter(resourceType);

                // * Only that type's rows show, the template linked to nothing never does, and the
                // filter shows the pick
                await expect(globalAttributes.rows).toHaveCount(shown.length);
                for (const label of shown) {
                    await expect(globalAttributes.rowByLabel(label)).toBeVisible();
                }
                await expect(globalAttributes.rowByLabel(bareTemplate)).toHaveCount(0);
                await expect(globalAttributes.resourceTypeFilter.getByRole('textbox')).toHaveValue(resourceType);
            }

            // # Return to All
            await globalAttributes.selectResourceTypeFilter('All');

            // * Every seeded row shows again
            await expect(globalAttributes.rows).toHaveCount(all.length);
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure the resource type filter combines with the source filter and the search, so
     * only rows that satisfy all three stay.
     */
    test('combines the resource type filter with the source filter and search', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed rows sharing a search stem that differ by source and by resource type, plus one
            // LDAP channel row outside the stem
            const ldapChannel = `Alpha ${suffix} Ldap Channel`;
            const ldapUser = `Alpha ${suffix} Ldap User`;
            const managedChannel = `Alpha ${suffix} Managed Channel`;
            const otherLdapChannel = `Beta ${suffix} Ldap Channel`;

            const ldapChannelTemplate = await seeder.syncedTemplate(
                {key: 'combo_ldap_channel', displayName: ldapChannel},
                ['ldap'],
            );
            await seeder.linkedChild(ldapChannelTemplate, 'channel');
            const ldapUserTemplate = await seeder.syncedTemplate({key: 'combo_ldap_user', displayName: ldapUser}, [
                'ldap',
            ]);
            await seeder.linkedChild(ldapUserTemplate, 'user');
            await seeder.unlinkedField('channel', {key: 'combo_managed_channel', displayName: managedChannel});
            const otherTemplate = await seeder.syncedTemplate(
                {key: 'combo_other_ldap_channel', displayName: otherLdapChannel},
                ['ldap'],
            );
            await seeder.linkedChild(otherTemplate, 'channel');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            await globalAttributes.gotoListing();

            // # Filter to Channels and AD/LDAP, then search for the shared stem
            await globalAttributes.selectResourceTypeFilter('Channels');
            await globalAttributes.selectSourceFilter('AD/LDAP');
            await globalAttributes.search(`Alpha ${suffix}`);

            // * Only the LDAP channel row that also matches the term shows
            await expect(globalAttributes.rows).toHaveCount(1);
            await expect(globalAttributes.rowByLabel(ldapChannel)).toBeVisible();

            // # Switch the resource type with the source and term kept
            await globalAttributes.selectResourceTypeFilter('Users');

            // * Now only the LDAP user row matching the term shows
            await expect(globalAttributes.rows).toHaveCount(1);
            await expect(globalAttributes.rowByLabel(ldapUser)).toBeVisible();

            // # Switch the source back to All with Channels picked again
            await globalAttributes.selectResourceTypeFilter('Channels');
            await globalAttributes.selectSourceFilter('All');

            // * Both channel rows matching the term show, whatever their source
            await expect(globalAttributes.rows).toHaveCount(2);
            await expect(globalAttributes.rowByLabel(ldapChannel)).toBeVisible();
            await expect(globalAttributes.rowByLabel(managedChannel)).toBeVisible();
        } finally {
            await seeder.cleanup();
        }
    });

    /**
     * @objective Ensure a resource type that matches nothing shows the no-match state, and Clear
     * filters resets the search, the source and the resource type.
     */
    test('clears the search, source and resource type from the no-match state', async ({pw}) => {
        const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
        const suffix = pw.random.id();
        const seeder = new ListingSeeder(adminClient, suffix);

        try {
            // # Seed one template linked to users only
            const label = `Clear Me ${suffix}`;
            const template = await seeder.template({key: 'clear_user', displayName: label});
            await seeder.linkedChild(template, 'user');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            await globalAttributes.gotoListing();
            await globalAttributes.search(suffix);

            // # Filter to a resource type and a source the row does not match
            await globalAttributes.selectResourceTypeFilter('Posts');
            await globalAttributes.selectSourceFilter('Managed here');

            // * The no-match state shows with Clear filters, not the empty-listing state
            await expect(globalAttributes.emptySearchState).toContainText(
                'No attributes match your search or filters.',
            );
            await expect(globalAttributes.emptyState).toHaveCount(0);
            await expect(globalAttributes.clearFiltersButton).toBeVisible();

            // # Clear filters
            await globalAttributes.clearFilters();

            // * The search is empty, both filters are back to All, and the row shows again
            await expect(globalAttributes.searchInput).toHaveValue('');
            await expect(globalAttributes.sourceFilter.getByRole('textbox')).toHaveValue('All');
            await expect(globalAttributes.resourceTypeFilter.getByRole('textbox')).toHaveValue('All');
            await expect(globalAttributes.rowByLabel(label)).toBeVisible();
            await expect(globalAttributes.emptySearchState).toHaveCount(0);
        } finally {
            await seeder.cleanup();
        }
    });
});
