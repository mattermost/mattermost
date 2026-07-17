// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SystemConsolePage, getRandomId, test} from '@mattermost/playwright-lib';

const PAGE_SIZE = 10;

test.describe('System Console channel search', () => {
    async function setup(pw: any) {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        await adminClient.configureOpenLdap();
        const team = await adminClient.createTeam(await pw.random.team());
        await adminClient.addToTeam(team.id, adminUser.id);
        const {page} = await pw.testBrowser.login(adminUser);
        const consolePage = new SystemConsolePage(page);
        await consolePage.managementLists.gotoChannels();
        return {adminClient, consolePage, team};
    }

    /**
     * @objective Verify channel management opens with an empty search field
     */
    test('loads channel management with no search text', {tag: '@ldap'}, async ({pw}) => {
        const {consolePage} = await setup(pw);

        // # Open channel management without entering a search term

        // * Verify the search input starts empty
        await consolePage.managementLists.expectSearchToBeEmpty();
    });

    /**
     * @objective Verify channel management returns a channel matching the search term
     */
    test('returns a matching channel search result', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, consolePage, team} = await setup(pw);
        const displayName = `Search ${getRandomId()}`;
        const channel = await adminClient.createPublicChannel(team.id, displayName);

        // # Search for the created channel
        await consolePage.managementLists.search(displayName);

        // * Verify the matching channel is returned
        await consolePage.managementLists.expectChannelResult(channel.display_name);
    });

    /**
     * @objective Verify channel search results paginate after ten entries
     */
    test('paginates channel search results after ten entries', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, consolePage, team} = await setup(pw);
        const prefix = `Paged ${getRandomId()}`;
        for (let i = 0; i < PAGE_SIZE + 2; i++) {
            await adminClient.createPublicChannel(team.id, `${prefix} ${i}`);
        }

        // # Search for the shared channel prefix
        await consolePage.managementLists.search(prefix);

        // * Verify the first page is full and reports twelve total results
        await consolePage.managementLists.expectRowCount(PAGE_SIZE);
        await consolePage.managementLists.expectPagination('1 - 10 of 12');

        // # Advance to the second page
        await consolePage.managementLists.goToNextPage();

        // * Verify the second page contains the remaining two results
        await consolePage.managementLists.expectRowCount(2);
    });

    /**
     * @objective Verify the clear-search control restores the default channel list
     */
    test('clears channel search results with the clear control', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, consolePage, team} = await setup(pw);
        const displayName = `Clear ${getRandomId()}`;
        await adminClient.createPublicChannel(team.id, displayName);
        await consolePage.managementLists.search(displayName);
        await consolePage.managementLists.expectRowCount(1);

        // # Clear the search with its visible clear control
        await consolePage.managementLists.clearSearch();

        // * Verify the field and default ten-row list are restored
        await consolePage.managementLists.expectSearchToBeEmpty();
        await consolePage.managementLists.expectRowCount(PAGE_SIZE);
    });

    /**
     * @objective Verify deleting the search term restores the default channel list
     */
    test('clears channel search results when the term is deleted', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, consolePage, team} = await setup(pw);
        const displayName = `Delete ${getRandomId()}`;
        await adminClient.createPublicChannel(team.id, displayName);
        await consolePage.managementLists.search(displayName);
        await consolePage.managementLists.expectRowCount(1);

        // # Delete all text from the search field
        await consolePage.managementLists.clearSearchWithKeyboard();

        // * Verify the default ten-row list is restored
        await consolePage.managementLists.expectRowCount(PAGE_SIZE);
    });
});
