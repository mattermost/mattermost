// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @bot_accounts

import * as MESSAGES from '../../fixtures/messages';
import {getRandomId} from '../../utils';

describe('Edit bot', () => {
    let testTeam;

    before(() => {
        cy.apiInitSetup().then(({team, townSquareUrl}) => {
            testTeam = team;

            cy.visit(townSquareUrl);
            cy.postMessage('hello');
        });
    });

    it('MM-T1840 Description allows for special character', () => {
        const userName = `bot-${getRandomId()}`;
        const description = MESSAGES.LARGE.concat('!@#$%&*');

        // # Create bot
        createBot(userName, testTeam.name);

        // * Set alias for bot entry in bot list, this also checks that the bot entry exists
        cy.get('.backstage-list__item').contains('.backstage-list__item', userName).as('botEntry');

        cy.get('@botEntry').then((el) => {
            // # Find the edit link for the bot
            const editLink = el.find('.item-actions>a');

            if (editLink.text() === 'Edit') {
                // # Click the edit link for the bot
                cy.wrap(editLink).click();

                // * Check that user name is as expected
                cy.get('#username').should('have.value', userName);

                // * Check that details are empty
                cy.get('#displayName').should('have.value', '');
                cy.get('#description').should('have.value', '');

                // # Set long description
                cy.get('#description').clear().type(description);

                // # Click update button
                cy.get('#saveBot').click();
            }
        });

        // * Get bot entry in bot list by username
        cy.get('@botEntry').then((el) => {
            cy.wrap(el).scrollIntoView();

            // * Confirm long description is as expected
            cy.wrap(el.find('.bot-details__description')).should('have.text', description);
        });
    });

    function createBot(userName, teamName) {
        // # Go to bot integrations page
        cy.uiOpenProductMenu('Integrations');
        cy.get('a.integration-option[href$="/bots"]').click();
        cy.get('#addBotAccount').click();

        // # Fill and submit form
        cy.get('#username').type(userName);
        cy.get('#saveBot').click();

        // * Verify confirmation page
        cy.url().
            should('include', `/${teamName}/integrations/confirm`).
            should('match', /token=[a-zA-Z0-9]{26}/);

        // * Verify confirmation form/token
        cy.get('div.backstage-form').
            should('include.text', 'Setup Successful').
            should((confirmation) => {
                expect(confirmation.text()).to.match(/Token: [a-zA-Z0-9]{26}/);
            });
        cy.get('#doneButton').click();
    }
});
