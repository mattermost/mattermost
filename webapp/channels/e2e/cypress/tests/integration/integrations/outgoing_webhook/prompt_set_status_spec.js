// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Prompting set status', () => {
    let user1;
    let user2;
    let testChannelUrl;

    before(() => {
        cy.apiInitSetup().then(({user, team}) => {
            user1 = user;
            testChannelUrl = `/${team.name}/channels/town-square`;

            cy.apiCreateUser().then(({user: otherUser}) => {
                user2 = otherUser;

                cy.apiAddUserToTeam(team.id, user2.id);
            });

            cy.apiLogin(user1);
            cy.visit(testChannelUrl);
        });
    });

    it('MM-T673 Prompting to set status to online', () => {
        // # Set user status to offline
        cy.uiOpenUserMenu('Offline');

        // * Your status stays offline in your view
        cy.uiGetSetStatusButton().find('.icon-circle-outline');

        // # Log out
        cy.apiLogout();

        cy.apiLogin(user2);
        cy.visit(testChannelUrl);
        openDM(user1.username);

        // * Your status stays offline in other users' views.
        cy.get('#channelHeaderInfo').within(() => {
            cy.get('.offline--icon').should('be.visible');
            cy.get('.online--icon').should('not.exist');
            cy.findByText('Offline').should('be.visible');
        });
        cy.apiGetUserStatus(user1.id).then((result) => {
            cy.wrap(result.status.status).should('be.equal', 'offline');
        });

        // # Log back in
        cy.apiLogin(user1);
        cy.visit(testChannelUrl);

        // # On modal that asks if you want to be set Online, select No.
        cy.get('.modal-content').within(() => {
            cy.findByText('Your Status is Set to "Offline"').should('be.visible');
            cy.get('#cancelModalButton').click();
        });

        // * Your status stays offline in your view
        cy.uiGetSetStatusButton().find('.icon-circle-outline');

        // * Your status stays offline in other user's view.
        cy.apiLogin(user2);
        cy.visit(testChannelUrl);
        openDM(user1.username);

        // * Your status stays offline in other user's view.
        cy.get('#channelHeaderInfo').within(() => {
            cy.get('.offline--icon').should('be.visible');
            cy.get('.online--icon').should('not.exist');
            cy.findByText('Offline').should('be.visible');
        });
        cy.apiGetUserStatus(user1.id).then((result) => {
            cy.wrap(result.status.status).should('be.equal', 'offline');
        });
    });
});

const openDM = (username) => {
    // # Click '+' to open DM and wait for some time to get the DM modal fully loaded
    cy.uiAddDirectMessage().click().wait(TIMEOUTS.TWO_SEC);

    // # Type username and wait for some time to load users list
    cy.get('#selectItems input').typeWithForce(username).wait(TIMEOUTS.TWO_SEC);

    // # Find the user in the list and click
    cy.get('#multiSelectList').findByText(`@${username}`).click();

    // * Verify that the user is selected
    cy.get('#selectItems').findByText(username).should('be.visible');

    // # Click go to open DM with the user
    cy.findByText('Go').click();
};
