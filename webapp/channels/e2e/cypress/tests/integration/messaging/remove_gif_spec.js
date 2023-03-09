// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import * as TIMEOUTS from '../../fixtures/timeouts';
import {getAdminAccount} from '../../support/env';

describe('Messaging', () => {
    const admin = getAdminAccount();
    let testUser;
    let testTeam;

    before(() => {
        // # Set the configuration on Link Previews
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableLinkPreviews: true,
            },
        });

        // # Login as test user and go to town-square
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('MM-T114_1 Delete a GIF from RHS reply thread, other user viewing in center and RHS sees GIF preview disappear from both', () => {
        // # Type message to use
        cy.postMessage('123');

        // # Click Reply button
        cy.clickPostCommentIcon();

        // # Write message on reply box
        cy.postMessageReplyInRHS('https://media1.giphy.com/media/l41lM6sJvwmZNruLe/giphy.gif');

        // # Change user and go to Town Square
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Click Reply button to open the RHS
        cy.clickPostCommentIcon();

        // # Remove message from the other user
        cy.getLastPostId().as('postId').then((postId) => {
            // * Can view the gif on main view
            cy.get(`#post_${postId}`).find('.attachment__image').should('exist');

            // * Can view the gif on RHS
            cy.get(`#rhsPost_${postId}`).find('.attachment__image').should('exist');

            // # Delete the message
            cy.externalRequest({user: admin, method: 'DELETE', path: `posts/${postId}`});

            // # Wait for the message to be deleted
            cy.wait(TIMEOUTS.HALF_SEC);

            // * Cannot view the gif on main channel
            cy.get(`#post_${postId}`).find('.attachment__image').should('not.exist');

            // * Should see (message deleted)
            cy.get(`#post_${postId}`).should('contain', '(message deleted');

            // * Cannot view the gif on RHS
            cy.get(`#rhsPost_${postId}`).find('.attachment__image').should('not.exist');

            // * Should see (message deleted)
            cy.get(`#rhsPost_${postId}`).should('contain', '(message deleted');

            // # Refresh the website and wait for it to be loaded
            cy.reload();
            cy.wait(TIMEOUTS.FIVE_SEC);

            // * The RHS is closed
            cy.get('#rhsCloseButton').should('not.exist');

            // * Should see (message deleted)
            cy.get(`#post_${postId}`).should('not.exist');

            // # Log in as the other user and go to town square
            cy.apiAdminLogin();
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * The post should not exist
            cy.get(`#post_${postId}`).should('not.exist');
        });
    });

    it('MM-T114_2 Delete a GIF from RHS reply thread, other user viewing in center and RHS sees GIF preview disappear from both (mobile view)', () => {
        cy.apiAdminLogin();

        // # Type message to use
        cy.postMessage('123');

        // # Click Reply button
        cy.clickPostCommentIcon();

        // # Write message on reply box
        cy.postMessageReplyInRHS('https://media1.giphy.com/media/l41lM6sJvwmZNruLe/giphy.gif');

        // # Change user and go to Town Square
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Change viewport so it has mobile view
        cy.viewport('iphone-6');

        // # Click Reply button to open the Message Details
        cy.clickPostCommentIcon();

        // # Remove message from the other user
        cy.getLastPostId().as('postId').then((postId) => {
            // * Can view the gif on Message Details
            cy.get(`#rhsPost_${postId}`).find('.attachment__image').should('exist').and('be.visible');

            // # Close Message Details
            cy.get('#sbrSidebarCollapse').click();

            // * Can view the gif on main view
            cy.get(`#post_${postId}`).find('.attachment__image').should('exist').and('be.visible');

            // # Click Reply button to open the Message Details
            cy.clickPostCommentIcon();

            // # Delete the message
            cy.externalRequest({user: admin, method: 'DELETE', path: `posts/${postId}`});

            // # Wait for the message to be deleted
            cy.wait(TIMEOUTS.HALF_SEC);

            // * Cannot view the gif on main channel
            cy.get(`#post_${postId}`).find('.attachment__image').should('not.exist');

            // * Cannot view the gif on RHS
            cy.get(`#rhsPost_${postId}`).find('.attachment__image').should('not.exist');

            // # Log in as the other user and go to town square
            cy.apiAdminLogin();
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * The post should not exist
            cy.get(`#post_${postId}`).should('not.exist');
        });
    });
});
