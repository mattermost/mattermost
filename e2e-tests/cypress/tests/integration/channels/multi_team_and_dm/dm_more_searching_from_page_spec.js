// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @multi_team_and_dm

describe('Multi Team and DM', () => {
    let testChannel;
    let testTeam;
    let testUser;
    let searchTerm;
    const prefix = 'testuser';

    before(() => {
        // # Setup with the new team, channel and user
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;
            searchTerm = user.username;

            // # Create 52 users so the user must page forward in the dm list
            Cypress._.times(52, () => {
                cy.apiCreateUser({prefix}).then(() => {
                    cy.apiAddUserToTeam(testTeam.id, user.id);
                });
            });

            // # Login with testUser and visit test channel
            cy.apiLogin(testUser);
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        });
    });

    it('MM-T446 DM More... searching from page 2 of user list', () => {
        // # Open the Direct Message modal
        cy.uiAddDirectMessage().click();

        // # Move to the next page of users
        cy.findByText('Next').click();
        cy.findByText('Previous').should('exist');

        // # Enter a search term
        cy.findByRole('textbox', {name: 'Search for people'}).typeWithForce(searchTerm);

        // * Assert that the previous / next links do not appear since there should only be 1 record displayed
        cy.findByText('Next').should('not.exist');
        cy.findByText('Previous').should('not.exist');

        // * Assert that the search term does not return wrong user(s)
        cy.findAllByText(prefix).should('not.exist');

        // * Assert that the search term returns the correct user and is visible
        cy.findByText(`${searchTerm}@sample.mattermost.com`).should('be.visible');
    });
});
