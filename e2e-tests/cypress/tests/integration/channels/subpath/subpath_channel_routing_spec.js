// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @subpath

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Subpath Channel routing', () => {
    let testUser;
    let testTeam;
    let otherUser;

    before(() => {
        cy.shouldRunWithSubpath();

        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser({prefix: 'otherUser'}).then(({user: newUser}) => {
                otherUser = newUser;
                cy.apiAddUserToTeam(team.id, newUser.id);
            });

            // # Login as test user
            cy.apiLogin(testUser);
        });
    });

    it('MM-T986 - Should go to town square channel view', () => {
        // # Go to town square channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // * Check if the channel is loaded correctly
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').should('contain', 'Town Square');
    });

    it('MM-T987 - Rejoin channel with permalink', () => {
        // # Visit Town Square channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Create a new channel
        cy.apiCreateChannel(testTeam.id, 'subpath-channel', 'subpath-channel', 'O', 'subpath-ch').then(({channel}) => {
            // # Visit newly created channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Post a message
            cy.postMessage('Subpath Test Message');

            // # Create permalink to post
            cy.getLastPostId().then((id) => {
                const permalink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${id}`;

                // # Click on ... button of last post
                cy.clickPostDotMenu(id);

                // # Click on "Copy Link"
                cy.uiClickCopyLink(permalink, id);

                // # Leave the channel
                cy.uiLeaveChannel();

                // # Visit the permalink
                cy.visit(permalink);

                // * Check that we have rejoined the channel
                cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').should('contain', 'subpath-channel');

                // * Check that the post message is the correct one
                cy.get(`#postMessageText_${id}`).should('contain', 'Subpath Test Message');
            });
        });
    });

    it('MM-T988 - Should redirect to DM on login', () => {
        // # Create a direct channel between two users
        cy.apiCreateDirectChannel([testUser.id, otherUser.id]).then(() => {
            const dmChannelURL = `/${testTeam.name}/messages/@${otherUser.username}`;

            // # Logout
            cy.apiLogout();

            // # Visit the channel using the channel name
            cy.visit(dmChannelURL);

            // # Login
            cy.findByPlaceholderText('Email or Username').clear().type(testUser.username);
            cy.findByPlaceholderText('Password').clear().type(testUser.password);
            cy.get('#saveSetting').should('not.be.disabled').click();

            // * Check that we in are in DM channel
            cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').should('contain', otherUser.username);
        });
    });
});
