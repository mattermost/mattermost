// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @modals

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Quick switcher', () => {
    const userPrefix = 'az';
    const gmBadge = 'G';
    let testTeam;
    let testUser;
    let firstUser;
    let secondUser;
    let thirdUser;
    let testChannel;

    before(() => {
        // # Create three users for testing
        cy.apiInitSetup().then(({user, team, channel}) => {
            testUser = user;
            testTeam = team;
            testChannel = channel;
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
        cy.apiCreateUser({prefix: `${userPrefix}1`}).then(({user: user1}) => {
            firstUser = user1;
        });

        cy.apiCreateUser({prefix: `${userPrefix}2`}).then(({user: user1}) => {
            secondUser = user1;
        });

        cy.apiCreateUser({prefix: `${userPrefix}3`}).then(({user: user1}) => {
            thirdUser = user1;
        });

        cy.apiLogout();
    });

    beforeEach(() => {
        // # Login as test user
        cy.apiLogin(testUser);
    });

    it('MM-T3447_1 Should add recent user on top of results', () => {
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Type either cmd+K / ctrl+K depending on OS
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');

        // # This is to remove the unread channel created on apiInitSetup
        cy.focused().type(testChannel.display_name).wait(TIMEOUTS.HALF_SEC).type('{enter}');

        cy.postMessage('Testing quick switcher');

        // # Go to the DM channel of second user
        cy.goToDm(secondUser.username);

        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');

        // # Search with the term a
        cy.focused().type('a').wait(TIMEOUTS.HALF_SEC);

        // * Should have recently interacted DM on top
        cy.get('.suggestion--selected').should('exist').and('contain.text', secondUser.username);

        // # Close quick switcher
        cy.get('body').typeWithForce('{esc}');
    });

    it('MM-T3447_2 Should add latest interacted user on top of results instead of alphabetical order', () => {
        // # Go to the DM channel of third user
        cy.goToDm(thirdUser.username);

        // # Type either cmd+K / ctrl+K depending on OS
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');

        // # Search with the term a
        cy.focused().type('a').wait(TIMEOUTS.HALF_SEC);

        // * Should have recently interacted DM on top
        cy.get('.suggestion--selected').should('exist').and('contain.text', thirdUser.username);

        // # Close quick switcher
        cy.get('body').typeWithForce('{esc}');
        cy.postMessage('Testing quick switcher');

        // # Go to the DM channel of second user
        cy.goToDm(secondUser.username);

        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');
        cy.focused().type('a').wait(TIMEOUTS.HALF_SEC);

        // * Should have recently interacted DM on top
        cy.get('.suggestion--selected').should('exist').and('contain.text', secondUser.username);
        cy.get('body').typeWithForce('{esc}');
    });

    it('MM-T3447_3 Should match interacted users even with a partial match', () => {
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');

        // # Search with the term z2
        cy.focused().type('z2');

        // * Should match second user as it has a partial match with the search term
        cy.get('.suggestion--selected').should('exist').and('contain.text', secondUser.username);

        cy.get('body').typeWithForce('{esc}');
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');

        // # Search with the term z3
        cy.focused().type('z3');

        // * Should match third user as it has a partial match with the search term
        cy.get('.suggestion--selected').should('exist').and('contain.text', thirdUser.username);
        cy.get('body').typeWithForce('{esc}');
    });

    it('MM-T3447_4 Should not match GM if it is removed from LHS', () => {
        cy.apiCreateGroupChannel([testUser.id, firstUser.id, secondUser.id]).then(({channel}) => {
            // # Visit the newly created group message
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
            cy.postMessage('Hello to GM');

            cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');
            cy.focused().type(userPrefix);

            // * Should have recently interacted GM on top, Matching as Gaz because we have G prefixed for GM's
            cy.get('.suggestion--selected').should('exist').and('contain.text', gmBadge + userPrefix);
            cy.get('body').typeWithForce('{esc}');

            // # Open channel menu and click Close Group Message
            cy.uiOpenChannelMenu('Close Group Message');

            // # Go to the DM channel of third user
            cy.goToDm(thirdUser.username);
            cy.postMessage('Hello to DM');

            cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');
            cy.focused().type(userPrefix);

            // * Should have recently interacted DM on top
            cy.get('.suggestion--selected').should('exist').and('contain.text', thirdUser.username);
        });
    });

    it('MM-T3447_5 Should match GM even with space in search term', () => {
        cy.apiCreateGroupChannel([testUser.id, firstUser.id, thirdUser.id]).then(({channel}) => {
            // # Visit the newly created group message
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');
            cy.focused().type(`${testUser.username} az3`);

            // * Should have the GM listed in the results
            cy.get('.suggestion--selected').should('exist').and('contain.text', gmBadge + userPrefix);
        });
    });
});
