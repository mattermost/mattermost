// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @keyboard_shortcuts

describe('Keyboard Shortcuts', () => {
    beforeEach(() => {
        cy.apiAdminLogin();

        cy.apiInitSetup().
            then(({user, team}) => cy.
                wrap(user).as('mainUser').
                wrap(team).as('mainTeam'),
            );
        cy.apiInitSetup().
            then(({user, team}) => cy.
                wrap(user).as('otherUser').
                wrap(team).as('otherTeam'),
            );
    });

    it('MM-T1228_1 CTRL/CMD+K - Open DM with user not on the current team / with ANY', function() {
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictDirectMessage: 'any',
            },
        });

        // # Log-in with created user
        cy.apiLogin(this.mainUser);

        // * User is found and DM channel with the user opens
        verifyUserIsFoundAndDMOpensOnClick(this.otherUser);
    });

    it('MM-T1228_2 CTRL/CMD+K - Open DM with user not on the current team / with TEAM', function() {
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictDirectMessage: 'team',
            },
        });

        // # Log-in with created user
        cy.apiLogin(this.mainUser);

        cy.visit('/');

        // # Select CTRL/CMD+K (or ⌘+K) to open the channel switcher
        cy.typeCmdOrCtrl().type('K', {release: true});

        // # Start typing the name of other user
        cy.findByRole('textbox', {name: 'quick switch input'}).type(this.otherUser.username);

        // # Select other user from the list
        cy.findByTestId(this.otherUser.username).should('not.exist');
    });

    it('MM-T1228_3 CTRL/CMD+K - Open DM with user belonging to both teams / with ANY', function() {
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictDirectMessage: 'any',
            },
        });

        // # Add other user to the main team
        cy.apiAddUserToTeam(this.mainTeam.id, this.otherUser.id);

        // # Log-in with created user
        cy.apiLogin(this.mainUser);

        // * User is found and DM channel with the user opens
        verifyUserIsFoundAndDMOpensOnClick(this.otherUser);
    });

    it('MM-T1228_4 CTRL/CMD+K - Open DM with user belonging to both teams / with TEAM', function() {
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictDirectMessage: 'team',
            },
        });

        // # Add other user to the main team
        cy.apiAddUserToTeam(this.mainTeam.id, this.otherUser.id);

        // # Log-in with created user
        cy.apiLogin(this.mainUser);

        // * User is found and DM channel with the user opens
        verifyUserIsFoundAndDMOpensOnClick(this.otherUser);
    });
});

function verifyUserIsFoundAndDMOpensOnClick(user) {
    cy.visit('/');

    // # Select CTRL/CMD+K (or ⌘+K) to open the channel switcher
    cy.typeCmdOrCtrl().type('K', {release: true});

    // # Start typing the name of other user
    cy.findByRole('textbox', {name: 'quick switch input'}).type(user.username);

    // # Select other user from the list
    cy.findByTestId(user.username).should('be.visible');
    cy.findByTestId(user.username).click();

    // * Other user name is visible in header
    cy.get('#channelHeaderTitle').should('contain', user.username);
}
