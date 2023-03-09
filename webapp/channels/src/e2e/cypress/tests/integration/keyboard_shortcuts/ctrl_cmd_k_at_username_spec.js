// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @keyboard_shortcuts

describe('Keyboard Shortcuts', () => {
    let testTeam;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team, user, offTopicUrl}) => {
            testTeam = team;
            testUser = user;
            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
                cy.apiLogin(testUser);
                cy.visit(offTopicUrl);
            });
        });
    });

    it('MM-T1246 CTRL/CMD+K - @ at beginning of username', () => {
        // # Type CTRL/CMD+K
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('k');

        // # Enter @ followed by the first 2 characters of username of the other user
        cy.get('#quickSwitchInput').type('@' + otherUser.username.slice(0, 3));

        // # Click on the username in the suggestion list
        cy.findByTestId(otherUser.username).click();

        // * The direct message channel for the user opens
        cy.url().should('include', `/${testTeam.name}/messages/@${otherUser.username}`);
    });
});
