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
    const maxDescription = '1234567890'.repeat(50);
    const overMaxDescription = `${maxDescription}123`;

    let testTeam;

    before(() => {
        // # Login as test user and visit the newly created test channel
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;

            // # Visit the Incoming Webhooks add page
            cy.visit(`/${team.name}/integrations/incoming_webhooks/add`);
        });
    });

    it('MM-T636 Description field length check', () => {
        // * Check incoming description field only accepts 500 characters
        cy.get('#description').clear().type(maxDescription).should('have.value', maxDescription);
        cy.get('#description').clear().type(overMaxDescription).should('have.value', maxDescription);

        // * Check outgoing description field only accepts 500 characters
        cy.visit(`/${testTeam.name}/integrations/outgoing_webhooks/add`);
        cy.get('#description').clear().type(maxDescription).should('have.value', maxDescription);
        cy.get('#description').clear().type(overMaxDescription).should('have.value', maxDescription);
    });
});
