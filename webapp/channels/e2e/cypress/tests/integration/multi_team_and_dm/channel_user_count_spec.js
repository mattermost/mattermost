// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channel

describe('Channel user count', () => {
    let testTeam;
    let secondUser;
    before(() =>

        // # Create a new user and assign it to a team
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;

            // # Visit 'off-topic' channel for this team, as sysadmin
            cy.visit(`/${testTeam.name}/channels/off-topic`);
        }),
    );

    it('MM-T481 User count is updated if user automatically joins channel', () => {
        const initialUserCount = 2;

        // * Assert channel user count displays '2' (system admin + main user)
        cy.get('#channelMemberCountText').should('be.visible').and('have.text', `${initialUserCount}`);
        cy.get('#channelMemberCountText').invoke('text').as('initialUserCountText');

        // # Create another user
        cy.apiCreateUser().then(({user}) => {
            secondUser = user;

            // # Add new user (secondUser) to current team
            cy.apiAddUserToTeam(testTeam.id, secondUser.id);
        });

        cy.apiGetChannelByName(testTeam.name, 'off-topic').then(({channel}) => {
            // # Add secondUser to 'off-topic' channel
            cy.apiAddUserToChannel(channel.id, secondUser.id);
        });

        // * Assert channel user count now displays '3'  (system admin + main user + second user)
        cy.get('#channelMemberCountText').should('be.visible').and('have.text', `${initialUserCount + 1}`);
    });
});
