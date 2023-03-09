// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @integrations

import {getRandomId} from '../../utils';

describe('Integrations', () => {
    let teamName;

    before(() => {
        // # Setup with the new team and channel
        cy.apiInitSetup().then(({team, channel}) => {
            teamName = team.name;

            // # Setup 2 incoming webhooks
            Cypress._.times(2, (i) => {
                const newIncomingHook = {
                    channel_id: channel.id,
                    description: `Incoming webhook Test Description ${i}`,
                    display_name: `Test ${i}`,
                };
                cy.apiCreateWebhook(newIncomingHook);
            });

            // # Setup 2 outgoing webhooks
            Cypress._.times(2, (i) => {
                const newOutgoingHook = {
                    team_id: team.id,
                    display_name: `Test ${i} `,
                    trigger_words: [`test-trigger-${i}`],
                    callback_urls: ['https://mattermost.com'],
                };
                cy.apiCreateWebhook(newOutgoingHook, false);
            });

            // # Setup 2 Slash Commands
            Cypress._.times(2, (i) => {
                const slashCommand1 = {
                    description: `Test Slash Command ${i}`,
                    display_name: `Test ${i}`,
                    method: 'P',
                    team_id: team.id,
                    trigger: `trigger${i}`,
                    url: 'https://google.com',
                };
                cy.apiCreateCommand(slashCommand1);
            });

            // # Setup 2 bot accounts
            Cypress._.times(2, () => {
                cy.apiCreateBot();
            });

            // # Visit the integrations page
            cy.visit(`/${teamName}/integrations`);
        });
    });

    it('MM-T571 Integration search gives feed back when there are no results', () => {
        // # Shrink the page, set up constants
        cy.viewport('ipad-2');
        const results = 'Test';
        const noResults = `${getRandomId(6)}`;

        // * Check incoming webhooks for no match message
        cy.get('#incomingWebhooks').click();
        cy.get('#searchInput').type(results).then(() => {
            cy.get('#emptySearchResultsMessage').should('not.exist');
        });
        cy.get('#searchInput').clear().type(noResults);
        cy.get('#emptySearchResultsMessage').contains(`No incoming webhooks match ${noResults}`);

        // * Check outgoing webhooks for no match message
        cy.get('#outgoingWebhooks').click();
        cy.get('#searchInput').type(results).then(() => {
            cy.get('#emptySearchResultsMessage').should('not.exist');
        });
        cy.get('#searchInput').clear().type(noResults);
        cy.get('#emptySearchResultsMessage').contains(`No outgoing webhooks match ${noResults}`);

        // * Check slash commands for no match message
        cy.get('#slashCommands').click();
        cy.get('#searchInput').type(results).then(() => {
            cy.get('#emptySearchResultsMessage').should('not.exist');
        });
        cy.get('#searchInput').clear().type(noResults);
        cy.get('#emptySearchResultsMessage').contains(`No commands match ${noResults}`);

        // * Check bot accounts for no match message
        cy.get('#botAccounts').click();
        cy.get('#searchInput').type(results).then(() => {
            cy.get('#emptySearchResultsMessage').should('not.exist');
        });
        cy.get('#searchInput').clear().type(noResults);
        cy.get('#emptySearchResultsMessage').contains(`No bot accounts match ${noResults}`);
    });
});
