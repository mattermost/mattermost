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
    let newIncomingHook;

    before(() => {
        // # Create test team, channel, and webhook
        cy.apiInitSetup().then(({team, channel}) => {
            newIncomingHook = {
                channel_id: channel.id,
                channel_locked: true,
                description: 'Test Webhook Description',
                display_name: 'Test Webhook Name',
            };

            //# Create a new webhook
            cy.apiCreateWebhook(newIncomingHook);

            // # Visit the webhook page
            cy.visit(`/${team.name}/integrations/incoming_webhooks`);
        });
    });

    it('MM-T640 Cancel out of edit', () => {
        // # Make an edit to the webhook
        cy.findByText('Edit').click();
        cy.get('#displayName').type('name changed');
        cy.get('#description').type('description changed ');
        cy.get('#channelSelect').select('Town Square');
        cy.get('#channelLocked').uncheck();

        //# Click cancel to cancel the edits
        cy.findByText('Cancel').click();

        // # Assert the webhook's previous values are present
        cy.findAllByText(newIncomingHook.display_name).should('be.visible');
        cy.findAllByText(newIncomingHook.description).should('be.visible');
        cy.findByText('Delete').should('be.visible');
        cy.findByText('Edit').click();
        cy.get('#channelLocked').should('be.checked');
    });
});
