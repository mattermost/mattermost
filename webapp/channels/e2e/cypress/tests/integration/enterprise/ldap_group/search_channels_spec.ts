// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @ldap_group

import {getRandomId} from '../../../utils';

describe('Search channels', () => {
    const PAGE_SIZE = 10;
    let testTeamId;

    before(() => {
        // * Check if server has license for LDAP Groups
        cy.apiRequireLicenseForFeature('LDAPGroups');

        // Enable LDAP
        cy.apiUpdateConfig({LdapSettings: {Enable: true}});

        cy.apiInitSetup().then(({team}) => {
            testTeamId = team.id;
        });
    });

    beforeEach(() => {
        cy.visit('/admin_console/user_management/channels');
    });

    it('loads with no search text', () => {
        // * Check that text input loads empty.
        cy.get('.DataGrid_searchBar').within(() => {
            cy.findByPlaceholderText('Search').should('be.visible').and('have.text', '');
        });
    });

    it('returns results', () => {
        // # Create a channel.
        const displayName = getRandomId();
        cy.apiCreateChannel(testTeamId, 'channel-search', displayName);

        // # Search for the channel.
        cy.get('.DataGrid_searchBar').within(() => {
            cy.findByPlaceholderText('Search').type(displayName + '{enter}');
        });

        // * Check that channel is in search results.
        cy.findAllByTestId('channel-display-name').contains(displayName);
    });

    it('results are paginated', () => {
        // # Create enough new channels with common name prefixes to get multiple pages of search results.
        const displayName = getRandomId();
        for (let i = 0; i < PAGE_SIZE + 2; i++) {
            cy.apiCreateChannel(testTeamId, 'channel-search-paged-' + i, displayName + ' ' + i);
        }

        // # Search using the common channel name prefix.
        cy.get('.DataGrid_searchBar').within(() => {
            cy.findByPlaceholderText('Search').type(displayName + '{enter}');
        });

        // * Check that the first page of results is full.
        cy.findAllByTestId('channel-display-name').should('have.length', PAGE_SIZE);

        // # Click the next pagination arrow.
        cy.get('.DataGrid_footer').should('have.text', '1 - 10 of 12').within(() => {
            cy.get('.next').should('be.enabled').click();
        });

        // * Check that the 2nd page of results has the expected amount.
        cy.findAllByTestId('channel-display-name').should('have.length', 2);
    });

    it('clears the results when "x" is clicked', () => {
        // # Create a new channel.
        const displayName = getRandomId();
        cy.apiCreateChannel(testTeamId, 'channel-search', displayName);

        // # Search for the channel.
        cy.get('.DataGrid_searchBar').within(() => {
            cy.findByPlaceholderText('Search').as('searchInput').type(displayName + '{enter}');
        });

        // * Check that the list of channels is in search results mode.
        cy.findAllByTestId('channel-display-name').should('have.length', 1);

        // # Click the x in the search input.
        cy.findByTestId('clear-search').click();

        // * Check that the search input text is cleared.
        cy.get('@searchInput').should('be.visible').and('have.text', '');

        // * Check that the search results are reset to the default page-load list.
        cy.findAllByTestId('channel-display-name').should('have.length', PAGE_SIZE);
    });

    it('clears the results when the search term is deleted with backspace', () => {
        // # Create a channel.
        const displayName = getRandomId();
        cy.apiCreateChannel(testTeamId, 'channel-search', displayName);

        // # Search for the channel.
        cy.get('.DataGrid_searchBar').within(() => {
            cy.findByPlaceholderText('Search').as('searchInput').type(displayName + '{enter}');
        });

        // * Check that the list of teams is in search results mode.
        cy.findAllByTestId('channel-display-name').should('have.length', 1);

        // # Clear the search input by deleting the search text.
        cy.get('@searchInput').type('{selectall}{del}');

        // * Check that the search results are reset to the default page-load list.
        cy.findAllByTestId('channel-display-name').should('have.length', PAGE_SIZE);
    });
});
