// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***********************************************************  ****

// Stage: @prod
// Group: @messaging

describe('Messaging', () => {
    let testTeam;
    let firstUser;
    let secondUser;
    let thirdUser;

    before(() => {
        // # Login as test user
        cy.apiInitSetup().then(({team, user: user1}) => {
            firstUser = user1;
            testTeam = team;

            // # Create two more users
            cy.apiCreateUser().then(({user: user2}) => {
                secondUser = user2;
                cy.apiAddUserToTeam(testTeam.id, secondUser.id);
            });

            cy.apiCreateUser().then(({user: user3}) => {
                thirdUser = user3;
                cy.apiAddUserToTeam(testTeam.id, thirdUser.id);
            });

            cy.apiLogin(firstUser);
        });
    });

    it('MM-T1226 - CTRL/CMD+K - Find GM by matching username, full name, or nickname, even if that name isn\'t displayed', () => {
        // # Create a group channel and add the three users created in the 'before' hook
        cy.apiCreateGroupChannel([firstUser.id, secondUser.id, thirdUser.id]).then(({channel}) => {
            // # Visit the newly created group message
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Go to off-topic
            cy.get('#sidebarItem_off-topic').click();

            // # Type either cmd+K / ctrl+K depending on OS and type in the first 7 of the second user's last name
            cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');
            cy.focused().type(secondUser.last_name.slice(0, 7));

            // * The suggestion for the GM channel with the user that was searched for should show the username of the user and verify the suggestion for the GM channel with the user that was searched for should show the 'G' text
            cy.get('.suggestion--selected').should('exist').and('contain.text', secondUser.username).findByText('G').should('exist');
        });
    });
});
