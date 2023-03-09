// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @messaging

import {getAdminAccount} from '../../support/env';

function demoteUserToGuest(user, admin) {
    // # Issue a Request to demote the user to guest
    const baseUrl = Cypress.config('baseUrl');
    cy.externalRequest({user: admin, method: 'post', baseUrl, path: `users/${user.id}/demote`});
}

function promoteGuestToUser(user, admin) {
    // # Issue a Request to promote the guest to user
    const baseUrl = Cypress.config('baseUrl');
    cy.externalRequest({user: admin, method: 'post', baseUrl, path: `users/${user.id}/promote`});
}

describe('Channel header menu', () => {
    const admin = getAdminAccount();
    let testUser;
    let testTeam;

    before(() => {
        // # Login as new user, create new team and visit its URL
        cy.apiInitSetup({loginAfter: true}).then(({team, user}) => {
            testUser = user;
            testTeam = team;
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('MM-14490 show/hide properly menu dividers', () => {
        // # Go to "/"
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Create new test channel
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel Test').then(({channel}) => {
            // # Select channel on the left hand side
            cy.get(`#sidebarItem_${channel.name}`).click();

            // * Channel's display name should be visible at the top of the center pane
            cy.get('#channelHeaderTitle').should('contain', channel.display_name);

            // # Then click it to access the drop-down menu
            cy.get('#channelHeaderTitle').click();

            // * The dropdown menu of the channel header should be visible;
            cy.get('.Menu__content').should('be.visible');

            // * The dropdown menu of the channel header should have 3 dividers;
            cy.get('.Menu__content').find('.menu-divider:visible').should('have.lengthOf', 3);

            // # Demote the user to guest
            demoteUserToGuest(testUser, admin);

            // # Reload the browser
            cy.reload();

            // # Then click it to access the drop-down menu
            cy.get('#channelHeaderTitle').click();

            // * The dropdown menu of the channel header should have 2 dividers because some options have disappeared;
            cy.get('.Menu__content').find('.menu-divider:visible').should('have.lengthOf', 2);

            // # Promote the guest to user again
            promoteGuestToUser(testUser, admin);

            // # Reload the browser
            cy.reload();

            // # Then click it to access the drop-down menu
            cy.get('#channelHeaderTitle').click();

            // * The dropdown menu of the channel header should have 3 dividers again;
            cy.get('.Menu__content').find('.menu-divider:visible').should('have.lengthOf', 3);
        });
    });

    it('MM-24590 should leave channel successfully', () => {
        // # Go to "/"
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Create new test channel
        cy.apiAdminLogin();
        cy.apiCreateChannel(testTeam.id, 'channel-test-leave', 'Channel Test Leave').then(({channel}) => {
            // # Reload the browser
            cy.reload();

            // # Select channel on the left hand side
            cy.get(`#sidebarItem_${channel.name}`).click();

            // * Channel's display name should be visible at the top of the center pane
            cy.get('#channelHeaderTitle').should('contain', channel.display_name);

            // # Then click it to access the drop-down menu
            cy.get('#channelHeaderTitle').click();

            // * The dropdown menu of the channel header should be visible;
            cy.get('.Menu__content').should('be.visible');

            // # Click the "Leave Channel" option
            cy.get('#channelLeaveChannel').click();

            // * Should now be in Town Square
            cy.get('#channelHeaderInfo').should('be.visible').and('contain', 'Town Square');
        });
    });
});
