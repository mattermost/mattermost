// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import * as TIMEOUTS from '@/fixtures/timeouts';

describe('Direct Message', () => {
    let testTeam;
    let testUser;
    let otherUser;
    let townsquareLink;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
            townsquareLink = `/${team.name}/channels/town-square`;
            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            });
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.visit(townsquareLink);
    });

    it('MM-T1536 - Mute & Unmute', () => {
        // # Create a DM channel
        cy.apiCreateDirectChannel([testUser.id, otherUser.id]).then(({channel}) => {
            // Have another user send you a DM.
            cy.postMessageAs({sender: otherUser, message: 'Hello', channelId: channel.id}).wait(TIMEOUTS.HALF_SEC);
        });

        // # Visit the DM channel
        cy.visit(`/${testTeam.name}/messages/@${otherUser.username}`);

        // # Open channel menu and click Mute
        cy.uiOpenChannelMenu('Mute');

        // * Assert that channel appears as muted on the LHS
        cy.uiGetLhsSection('DIRECT MESSAGES').find('.muted').first().should('contain', otherUser.username);

        // # Open channel menu and click Unmute
        cy.uiOpenChannelMenu('Unmute');

        // * Assert that channel does not appear as muted on the LHS
        cy.uiGetLhsSection('DIRECT MESSAGES').find('.muted').should('not.exist');
    });
});
