// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @search

import {getRandomId} from '../../../utils';

describe('Search', () => {
    before(() => {
        // # Login as test user and visit Off-Topic
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);

            // # Post several messages of similar format to add complexity in searching
            Cypress._.times(5, () => {
                cy.postMessage(`apple${getRandomId()}`);
                cy.postMessage(`banana${getRandomId()}`);
            });
        });
    });

    it('S19944 Highlighting does not change to what is being typed in the search input box', () => {
        const apple = `apple${getRandomId()}`;
        const banana = `banana${getRandomId()}`;

        const message = apple + ' ' + banana;

        // # Post a message as "apple" and "banana"
        cy.postMessage(message);

        // # Search for "apple"
        cy.get('#searchBox').should('be.visible').type(apple).type('{enter}');

        // # Get last postId
        cy.getLastPostId().as('lastPostId');

        // * Search result should return one post with highlight on apple
        cy.get('@lastPostId').then((postId) => {
            verifySearchResult(1, postId, message, apple);
        });

        // * Type banana on search box but don't hit search
        cy.get('#searchBox').clear({force: true}).type(banana, {force: true});

        // * Search result should not change and remain as one result with highlight still on apple
        cy.get('@lastPostId').then((postId) => {
            verifySearchResult(1, postId, message, apple);
        });
    });
});

function verifySearchResult(results, postId, fullMessage, highlightedTerm) {
    cy.findAllByTestId('search-item-container').should('have.length', results).within(() => {
        cy.get(`#rhsPostMessageText_${postId}`).should('have.text', `${fullMessage}`);
        cy.get('.search-highlight').should('be.visible').and('have.text', highlightedTerm);
    });
}
