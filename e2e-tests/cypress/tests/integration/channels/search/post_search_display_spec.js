// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @search

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Search', () => {
    let testTeam;
    let testUser;

    before(() => {
        // Initialize a user.
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();

        // Visit town square as an admin
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T353 After clearing search query, search options display', () => {
        const searchWord = 'Hello';

        // # Post a message
        cy.postMessage(searchWord);

        cy.uiGetSearchContainer().click();

        // * Search word in searchBox and validate searchWord
        cy.uiGetSearchBox().type(searchWord + '{enter}');

        cy.uiGetSearchContainer().click();
        cy.uiGetSearchBox().should('have.value', searchWord);

        // # Click on "x" displayed on searchbox
        cy.uiGetSearchBox().parent().siblings('.input-clear-x').wait(TIMEOUTS.ONE_SEC).click({force: true});
        cy.uiGetSearchBox().parents('[class*="SearchInputContainer"]').siblings('#searchHints').should('be.visible');
        cy.uiGetSearchBox().first().focus().type('{esc}');

        // # RHS should be visible with search results
        cy.get('#search-items-container').should('be.visible');

        cy.uiGetSearchContainer().click();

        assertSearchHintFilesOrMessages();
    });

    it('MM-T376 - From:user search, using autocomplete', () => {
        const testMessage = 'Hello World';
        const testSearch = `FROM:${testUser.username.substring(0, 5)}`;

        cy.apiCreateUser().then(({user}) => {
            cy.apiAddUserToTeam(testTeam.id, user.id);
            cy.apiLogin(user);

            cy.apiGetChannelByName(testTeam.name, 'Off-Topic').then(({channel}) => {
                // # Have another user send a post
                cy.postMessageAs({sender: testUser, message: testMessage, channelId: channel.id});
            });

            // # Visit town-square.
            cy.visit(`/${testTeam.name}/channels/town-square`);

            cy.uiGetSearchContainer().click();

            // # Search for posts from that user
            cy.uiGetSearchBox().type(testSearch, {force: true}).wait(TIMEOUTS.HALF_SEC);

            // # Select user from suggestion list
            cy.contains('.suggestion-list__item', `@${testUser.username}`).scrollIntoView().click({force: true});

            // # Verify that search box has the updated query
            cy.uiGetSearchBox().should('have.value', `FROM:${testUser.username} `);

            // # Perform search
            cy.uiGetSearchBox().type('{enter}').wait(TIMEOUTS.HALF_SEC);

            // * Assert that RHS should be visible with search results
            cy.get('#search-items-container').should('be.visible');

            // * Search query clear icon is still present
            cy.uiGetSearchContainer().click();

            // # Hover search query clear icon
            cy.get('.input-clear-x').first().trigger('mouseover', {force: true}).then(($span) => {
                // # Click the clear query icon
                cy.wrap($span).click({force: true});

                // * Assert search results are intact
                cy.get('[data-testid="search-item-container"]').should('be.visible');
            });
        });
    });

    it('MM-T1450 - Autocomplete behaviour', () => {
        // # Post message in town-square
        cy.postMessage('hello');

        // # Click on searchbox
        cy.uiGetSearchContainer().should('be.visible').click();

        // * Check the contents in search options
        assertSearchHintFilesOrMessages();

        // # Search for search term in:
        cy.uiGetSearchBox().type('in:');

        // # Select option from suggestion list
        cy.get('.suggestion-list__item').first().click({force: true});

        // * Assert suggestions are not present after selecting item
        cy.get('.suggestion-list__item').should('not.exist');

        // # Clear search box
        cy.get('.input-clear-x').first().click({force: true}).wait(TIMEOUTS.HALF_SEC);

        // # Search for search term in:town-square{space}
        cy.uiGetSearchBox().type('in:town-square ').wait(TIMEOUTS.HALF_SEC);

        // * Check the hint contents are now visible
        assertSearchHint();

        // # Clear search box
        cy.uiGetSearchBox().get('.input-clear-x').first().click({force: true}).wait(TIMEOUTS.HALF_SEC);

        // # Search for search term in:town-square{enter}
        cy.uiGetSearchBox().type('in:town-square').wait(TIMEOUTS.HALF_SEC);

        // * Assert that channel name displays appropriately
        cy.get('.suggestion-list__item').first().should('contain.text', 'Town Square~town-square');

        // # Press enter to register search term
        cy.uiGetSearchBox().type('{enter}');

        // * Check the hint contents are now visible
        assertSearchHint();

        // * Assert that searchBox now includes a trailing space
        cy.uiGetSearchBox().should('have.value', 'in:town-square ');

        // # Perform the search
        cy.uiGetSearchBox().type('{enter}').wait(TIMEOUTS.HALF_SEC);

        // * Assert autocomplete list is gone
        cy.get('.suggestion-list__item').should('not.exist');
    });

    it('MM-T2291 - Wildcard Search', () => {
        const testMessage = 'Hello World!!!';

        // # Post message
        cy.postMessage(testMessage);

        cy.uiGetSearchContainer().click();

        // # Search for `Hell*`
        cy.uiGetSearchBox().type('Hell*{enter}').wait(TIMEOUTS.HALF_SEC);

        // # RHS should be visible with search results
        cy.get('#search-items-container').should('be.visible');

        // * Assert search results are present and correct
        cy.get('[data-testid="search-item-container"]').should('be.visible');
        cy.get('.search-highlight').first().should('contain.text', 'Hell');
    });
});

const assertSearchHintFilesOrMessages = () => {
    cy.get('#searchHints').should('be.visible');
};

const assertSearchHint = () => {
    cy.get('#searchHints').should('be.visible');
};
