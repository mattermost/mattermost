// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @integrations

describe('Integrations', () => {
    let teamA;

    before(() => {
        // # Setup with the new team
        cy.apiInitSetup().then(({team}) => {
            teamA = team.name;
        });
    });

    it('MM-T569 Integrations Page', () => {
        // # Visit the integrations page
        cy.visit(`/${teamA}/integrations`);

        // # Shrink the page
        cy.viewport(500, 500);

        // * Left side bar integrations link is visible and works
        cy.get('.backstage-sidebar__category > .category-title').should('be.visible').and('have.attr', 'href', `/${teamA}/integrations`).click();
        cy.url().should('include', '/integrations');

        // * Left side bar incoming webhooks link is visible and works
        cy.get('#incomingWebhooks > .section-title').should('be.visible').and('have.attr', 'href', `/${teamA}/integrations/incoming_webhooks`).click();
        cy.url().should('include', '/incoming_webhooks');

        // * Left side bar outgoing webhooks link is visible and works
        cy.get('#outgoingWebhooks > .section-title').should('be.visible').and('have.attr', 'href', `/${teamA}/integrations/outgoing_webhooks`).click();
        cy.url().should('include', '/outgoing_webhooks');

        // * Left side bar slash commands link is visible and works
        cy.get('#slashCommands > .section-title').should('be.visible').and('have.attr', 'href', `/${teamA}/integrations/commands`).click();
        cy.url().should('include', 'commands');

        // * Left side bar bot accounts link is visible and works
        cy.get('#botAccounts > .section-title').should('be.visible').and('have.attr', 'href', `/${teamA}/integrations/bots`).click();
        cy.url().should('include', '/bots');

        // # Return to integrations home
        cy.visit(`/${teamA}/integrations`);

        // * Incoming Webhooks link is visible and works
        cy.findByRole('link', {name: /Incoming Webhooks Incoming webhooks allow external integrations to send messages/}).scrollIntoView().should('be.visible').click();
        cy.url().should('include', '/incoming_webhooks');

        // # Return to integrations home
        cy.visit(`/${teamA}/integrations`);

        // * Outgoing Webhooks link is visible and works
        cy.findByRole('link', {name: /Outgoing Webhooks Outgoing webhooks allow external integrations to receive and respond to messages/}).scrollIntoView().should('be.visible').click();
        cy.url().should('include', '/outgoing_webhooks');

        // # Return to integrations home
        cy.visit(`/${teamA}/integrations`);

        // * Slash Commands link is visible and works
        cy.findByRole('link', {name: /Slash Commands Slash commands send events to external integrations/}).scrollIntoView().should('be.visible').click();
        cy.url().should('include', '/commands');

        // # Return to integrations home
        cy.visit(`/${teamA}/integrations`);

        // * Bot Accounts link is visible and works
        cy.findByRole('link', {name: /Bot Accounts Use bot accounts to integrate with Mattermost through plugins or the API/}).scrollIntoView().should('be.visible').click();
        cy.url().should('include', '/bots');
    });
});

