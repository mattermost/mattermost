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
    let testTeam;
    let testChannel;

    before(() => {
        // # Create test team and channel
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team.name;
            testChannel = channel.display_name;
        });
    });

    it('MM-T616 Copy icon for Outgoing Webhook token', () => {
        // Visit the integrations > add page
        cy.visit(`/${testTeam}/integrations/outgoing_webhooks/add`);

        // * Assert that we are on the add page
        cy.url().should('include', '/outgoing_webhooks/add');

        // # Manually set up an outgoing web-hook
        cy.get('#displayName').type('test');
        cy.get('#channelSelect').select(testChannel);
        cy.get('#triggerWords').type('trigger');
        cy.get('#callbackUrls').type('https://mattermost.com');
        cy.findByText('Save').click();

        // Assert that webhook was set up
        cy.findByText('Setup Successful').should('be.visible');

        // * Assert that token copy icon is present
        cy.findByTestId('copyText').should('be.visible');

        // # Close the add outgoing webhooks page
        cy.findByText('Done').click();

        // * Assert that we are back on the integrations > outgoing webhooks page
        cy.get('#addOutgoingWebhook').should('exist');

        // * Assert that the copy icon is present
        cy.findByTestId('copyText').should('be.visible');
    });
});
