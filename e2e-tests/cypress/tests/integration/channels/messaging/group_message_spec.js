// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @messaging

describe('Group Message', () => {
    let testTeam;
    let testUser;
    let townsquareLink;
    const users = [];

    const groupUsersCount = 3;

    before(() => {
        cy.apiInitSetup({}).then(({team, user, townSquareUrl}) => {
            testTeam = team;
            testUser = user;
            townsquareLink = townSquareUrl;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();

        // Add users on the testTeam
        Cypress._.times(groupUsersCount, (i) => {
            cy.apiCreateUser().then(({user: newUser}) => {
                cy.apiAddUserToTeam(testTeam.id, newUser.id);
                users.push(newUser);
                if (i === groupUsersCount - 1) {
                    cy.apiLogin(testUser);
                    cy.visit(townsquareLink);
                }
            });
        });
    });

    it('MM-T3319 Add GM', () => {
        const otherUser1 = users[0];
        const otherUser2 = users[1];

        // # Click on '+' sign to open DM modal
        cy.uiAddDirectMessage().click();

        // * Verify that the DM modal is open
        cy.get('#moreDmModal').should('be.visible').contains('Direct Messages');

        // # Search for the user otherA
        cy.get('#selectItems input').should('be.enabled').typeWithForce(`@${otherUser1.username}`);

        // * Verify that the user is found and add to GM
        cy.get('#moreDmModal .more-modal__row').should('be.visible').and('contain', otherUser1.username).click({force: true});

        // # Search for the user otherB
        cy.get('#selectItems input').should('be.enabled').typeWithForce(`@${otherUser2.username}`);

        // * Verify that the user is found and add to GM
        cy.get('#moreDmModal .more-modal__row').should('be.visible').and('contain', otherUser2.username).click({force: true});

        // # Search for the current user
        cy.get('#selectItems input').should('be.enabled').typeWithForce(`@${testUser.username}`);

        // * Assert that it's not found
        cy.get('.no-channel-message').should('be.visible').and('contain', 'No results found matching');

        // # Start GM
        cy.findByText('Go').click();

        // # Post something to create a GM
        cy.uiGetPostTextBox().type('Hi!').type('{enter}');

        // # Click on '+' sign to open DM modal
        cy.uiAddDirectMessage().click();

        // * Verify that the DM modal is open
        cy.get('#moreDmModal').should('be.visible').contains('Direct Messages');

        // # Search for the user otherB
        cy.get('#selectItems input').should('be.enabled').typeWithForce(`@${otherUser2.username}`);

        // * Verify that the user is found and is part of the GM together with the other user
        cy.get('#moreDmModal .more-modal__row').should('be.visible').and('contain', otherUser2.username).and('contain', otherUser1.username);
    });
});
