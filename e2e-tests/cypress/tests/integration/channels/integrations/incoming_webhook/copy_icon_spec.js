// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod

describe('Incoming webhook', () => {
    before(() => {
        // # Set ServiceSettings to expected values
        const newSettings = {
            ServiceSettings: {
                EnableIncomingWebhooks: true,
            },
        };

        cy.apiUpdateConfig(newSettings);

        cy.apiInitSetup().then(({team}) => {
            // # Go to integrations
            cy.visit(`/${team.name}/integrations`);

            // * Validate that incoming webhooks are enabled
            cy.get('#incomingWebhooks').should('be.visible');
        });
    });

    it('MM-T637 Copy icon for Incoming Webhook URL', () => {
        const title = 'test-title';
        const description = 'test-description';
        const channel = 'Town Square';

        cy.get('#incomingWebhooks').should('be.visible').click();

        // # For this test purpose, fill in "Title", "Description" and select a "channel" with some test data
        cy.findByText('Add Incoming Webhook').should('be.visible').click();

        cy.findByLabelText('Title').should('be.visible').type(title);

        cy.findByLabelText('Description').should('be.visible').type(description);

        cy.get('#channelSelect').should('be.visible').select(channel);

        // # Scroll down and click "Save"
        cy.findByText('Save').should('be.visible').click();

        cy.findByText('Setup Successful').should('be.visible');

        // * You should see a "copy" icon to the right of the URL in the "Setup Successful" screen
        copyIconIsVisible('.backstage-form__confirmation');

        // # Click "Done" in the "Setup Successful" screen
        cy.findByText('Done').should('be.visible').click();

        // # You should see a "copy" icon to the right of the webhook's URL
        copyIconIsVisible('.item-details__url');
    });
});

function copyIconIsVisible(element) {
    cy.get(element).within(() => {
        cy.get('.fa.fa-copy').
            should('be.visible').
            trigger('mouseover').
            should('have.attr', 'aria-describedby', 'copy');
    });
}
