// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @search

import * as TIMEOUTS from '../../fixtures/timeouts';

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

        // * Search word in searchBox and validate searchWord
        cy.get('#searchBox').click().type(searchWord + '{enter}').should('have.value', searchWord);

        // # Click on "x" displayed on searchbox
        cy.get('#searchbarContainer').should('be.visible').within(() => {
            cy.get('#searchFormContainer').find('.input-clear-x').wait(TIMEOUTS.ONE_SEC).click({force: true});
            cy.get('#searchbar-help-popup').should('be.visible');
            cy.get('#searchBox').type('{esc}');
        });

        // # RHS should be visible with search results
        cy.get('#search-items-container').should('be.visible');

        // # Click on searchbox
        cy.get('#searchbarContainer').should('be.visible').within(() => {
            cy.get('#searchBox').click();
        });

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

            // # Search for posts from that user
            cy.get('#searchBox').click().type(testSearch, {force: true});

            // # Select user from suggestion list
            cy.contains('.suggestion-list__item', `@${testUser.username}`).scrollIntoView().click({force: true});

            // # Verify that search box has the updated query
            cy.get('#searchBox').should('have.value', `FROM:${testUser.username} `);

            // # Perform search
            cy.get('#searchBox').click().type('{enter}').wait(TIMEOUTS.HALF_SEC);

            // * Assert that RHS should be visible with search results
            cy.get('#search-items-container').should('be.visible');

            // * Search query clear icon is still present
            cy.get('.input-clear.visible').should('be.visible');

            // # Hover search query clear icon
            cy.get('.input-clear-x').first().trigger('mouseover', {force: true}).then(($span) => {
                // * Assert that tooltip has shown
                cy.wrap($span).should('have.attr', 'aria-describedby', 'InputClearTooltip');

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
        cy.get('#searchbarContainer').should('be.visible').within(() => {
            cy.get('input#searchBox').should('be.visible').click();
        });

        // * Check the contents in search options
        assertSearchHintFilesOrMessages();

        // # Search for search term in:
        cy.get('#searchBox').click().type('in:');

        // # Select option from suggestion list
        cy.get('.suggestion-list__item').first().click({force: true});

        // * Assert suggestions are not present after selecting item
        cy.get('.suggestion-list__item').should('not.exist');

        // # Clear search box
        cy.get('.input-clear-x').first().click({force: true}).wait(TIMEOUTS.HALF_SEC);

        // # Search for search term in:town-square{space}
        cy.get('#searchBox').click().type('in:town-square ').wait(TIMEOUTS.HALF_SEC);

        // * Check the hint contents are now visible
        assertSearchHint();

        // # Clear search box
        cy.get('.input-clear-x').first().click({force: true}).wait(TIMEOUTS.HALF_SEC);

        // # Search for search term in:town-square{enter}
        cy.get('#searchBox').click().type('in:town-square').wait(TIMEOUTS.HALF_SEC);

        // * Assert that channel name displays appropriately
        cy.get('.suggestion-list__item').first().should('contain.text', 'Town Square~town-square');

        // # Press enter to register search term
        cy.get('#searchBox').click().type('{enter}');

        // * Check the hint contents are now visible
        assertSearchHint();

        // * Assert that searchBox now includes a trailing space
        cy.get('#searchBox').should('have.value', 'in:town-square ');

        // # Perform the search
        cy.get('#searchBox').click().type('{enter}').wait(TIMEOUTS.HALF_SEC);

        // * Assert autocomplete list is gone
        cy.get('.suggestion-list__item').should('not.exist');
    });

    it('MM-T2291 - Wildcard Search', () => {
        const testMessage = 'Hello World!!!';

        // # Post message
        cy.postMessage(testMessage);

        // # Search for `Hell*`
        cy.get('input#searchBox').click().type('Hell*{enter}').wait(TIMEOUTS.HALF_SEC);

        // # RHS should be visible with search results
        cy.get('#search-items-container').should('be.visible');

        // * Assert search results are present and correct
        cy.get('[data-testid="search-item-container"]').should('be.visible');
        cy.get('.search-highlight').first().should('contain.text', 'Hell');
    });
});

const assertSearchHintFilesOrMessages = () => {
    cy.get('#searchbar-help-popup').should('be.visible').within(() => {
        cy.get('div span').first().should('have.text', 'What are you searching for?');
        cy.get('div button:first-child span').first().should('have.text', 'Messages');
        cy.get('div button:last-child span').first().should('have.text', 'Files');
    });
};

const assertSearchHint = () => {
    cy.get('#searchbar-help-popup').should('be.visible').within(() => {
        cy.get('div span').first().should('have.text', 'Search options');
        cy.get('div ul li').first().should('have.text', 'From:Messages from a user');
        cy.get('div ul li').eq(1).should('have.text', 'In:Messages in a channel');
        cy.get('div ul li').eq(2).should('have.text', 'On:Messages on a date');
        cy.get('div ul li').eq(3).should('have.text', 'Before:Messages before a date');
        cy.get('div ul li').eq(4).should('have.text', 'After:Messages after a date');
        cy.get('div ul li').eq(5).should('have.text', '—Exclude search terms');
        cy.get('div ul li').last().should('have.text', '""Messages with phrases');
    });
};
