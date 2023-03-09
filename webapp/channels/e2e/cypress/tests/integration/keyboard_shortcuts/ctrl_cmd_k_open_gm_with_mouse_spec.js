// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Keyboard Shortcuts', () => {
    let testTeam;
    let firstUser;
    let secondUser;
    let thirdUser;

    before(() => {
        // # Login as test user
        cy.apiInitSetup().then(({offTopicUrl, team, user: user1}) => {
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
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T1245 CTRL/CMD+K - Open GM using mouse', () => {
        // # Create a GM channel
        cy.apiCreateGroupChannel([firstUser.id, secondUser.id, thirdUser.id]).then(() => {
            // # Press Cmd/Ctrl-K to open "Switch Channels" modal
            cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');

            // # Click on the GM link to go to channel
            cy.get('.status--group').click();

            // * Check if channel intro message with usernames is visible
            cy.findByText(/This is the start/).should('be.visible').contains(secondUser.username).contains(thirdUser.username);
        });
    });
});
