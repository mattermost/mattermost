// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @search_date_filter

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Negative search filters will omit results', () => {
    const message = 'negative' + Date.now();
    let testUser;
    let channelName;

    before(() => {
        // # Login as test user and go to test channel
        cy.apiInitSetup({loginAfter: true}).then(({channel, channelUrl, user}) => {
            testUser = user;
            channelName = channel.name;

            cy.visit(channelUrl);

            // # Create a post from today
            cy.postMessage(message);
        });
    });

    it('MM-T607 Negative search term', () => {
        searchAndVerify(message, message);
    });

    it('MM-T608 Negative before: filter', () => {
        const tomorrow = Cypress.dayjs().add(1, 'days').format('YYYY-MM-DD');
        const query = `before:${tomorrow} ${message}`;
        searchAndVerify(query, message);
    });

    it('MM-T609 Negative after: filter', () => {
        const yesterday = Cypress.dayjs().subtract(1, 'days').format('YYYY-MM-DD');
        const query = `after:${yesterday} ${message}`;
        searchAndVerify(query, message);
    });

    it('MM-T611 Negative on: filter', () => {
        const today = Cypress.dayjs().format('YYYY-MM-DD');
        const query = `on:${today} ${message}`;
        searchAndVerify(query, message);
    });

    it('MM-T3996 Negative in: filter', () => {
        const query = `in:${channelName} ${message}`;
        searchAndVerify(query, message);
    });

    it('MM-T610 Negative from: filter', () => {
        const query = `from:${testUser.username} ${message}`;
        searchAndVerify(query, message);
    });
});

function search(query) {
    cy.reload();
    cy.uiGetSearchContainer().should('be.visible').click();
    cy.uiGetSearchBox().first().clear().wait(TIMEOUTS.HALF_SEC).type(query).wait(TIMEOUTS.HALF_SEC).type('{enter}');

    cy.get('#loadingSpinner').should('not.exist');
    cy.uiGetRHSSearchContainer();
}

function searchAndVerify(query, expectedMessage) {
    search(query);

    // * Verify the amount of results matches the amount of our expected results
    cy.uiGetRHSSearchContainer().
        findAllByTestId('search-item-container').
        should('have.length', 1).
        then((results) => {
            // * Verify text of each result
            cy.wrap(results).first().find('.post-message').should('have.text', expectedMessage);
        });

    search(`-${query}`);

    // * If we expect no results, verify results message
    cy.get('.no-results__title').should('be.visible').and('have.text', `No results for “-${query}”`);

    cy.uiCloseRHS();
    cy.uiGetRHSSearchContainer({visible: false});
}
