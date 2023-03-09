// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***********************************************************  ****

// Stage: @prod
// Group: @messaging @keyboard_shortcuts

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Messaging', () => {
    let firstUser;
    let secondUser;
    let offTopicUrl;

    before(() => {
        // # Login as test user
        cy.apiInitSetup().then(({team, user, offTopicUrl: url}) => {
            firstUser = user;
            offTopicUrl = url;

            // # Create a second user that will be searched
            cy.apiCreateUser().then(({user: user1}) => {
                secondUser = user1;
                cy.apiAddUserToTeam(team.id, secondUser.id);
            });

            cy.apiLogin(firstUser);

            // # Visit created test team
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T1224 - CTRL/CMD+K - Open DM using mouse', () => {
        // # Type CTRL/CMD+K
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');

        // # In the "Switch Channels" modal type the first 6 characters of the username
        cy.findByRole('textbox', {name: 'quick switch input'}).should('be.focused').type(secondUser.username.substring(0, 6)).wait(TIMEOUTS.HALF_SEC);

        // # Verify that the list of users and channels suggestions is present
        cy.get('#suggestionList').should('be.visible').within(() => {
            // * Newly created username should be there in the search list; click it
            cy.findByTestId(secondUser.username).scrollIntoView().should('exist').click().wait(TIMEOUTS.HALF_SEC);
        });

        // # Verify that we are in a DM channel
        cy.get('#channelIntro').should('be.visible').within(() => {
            cy.get('.channel-intro-profile').
                should('be.visible').
                and('have.text', secondUser.username);
            cy.get('.channel-intro-text').
                should('be.visible').
                and('contain', `This is the start of your direct message history with ${secondUser.username}.`).
                and('contain', 'Direct messages and files shared here are not shown to people outside this area.');
        });

        // # Verify that the focus is on the message box
        cy.uiGetPostTextBox().should('be.focused');

        // # Send a DM
        cy.postMessage(`Hi there, ${secondUser.username}!`);

        // # Logout then login as the second user and visit the team
        cy.apiLogout();
        cy.reload();
        cy.apiLogin(secondUser);
        cy.visit(offTopicUrl);

        // * Check that the DM exists and receives the message with mention
        cy.uiGetLhsSection('DIRECT MESSAGES').findByLabelText(`${firstUser.username} 1 mention`).should('exist');
    });
});
