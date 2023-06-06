// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @multi_team_and_dm

describe('Close group messages', () => {
    let testUser;
    let otherUser1;
    let otherUser2;
    let testTeam;

    before(() => {
        cy.apiAdminLogin();
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            cy.apiCreateUser({prefix: 'aaa'}).then(({user: newUser}) => {
                otherUser1 = newUser;
                cy.apiAddUserToTeam(team.id, newUser.id);
            });
            cy.apiCreateUser({prefix: 'bbb'}).then(({user: newUser}) => {
                otherUser2 = newUser;
                cy.apiAddUserToTeam(team.id, newUser.id);
            });

            // # Login as test user and go to town square
            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T474 - GM: Favorite, and close', () => {
        createAndVisitGMChannel([otherUser1, otherUser2]).then((channel) => {
            // # Favorite the channel
            cy.get('#toggleFavorite').click();

            // * Check that the channel is on top of favorites list
            cy.uiGetLhsSection('FAVORITES').find('.SidebarChannel').first().should('contain', channel.display_name.replace(`, ${testUser.username}`, ''));

            // # Click on the x button on the sidebar channel item
            cy.uiGetChannelSidebarMenu(channel.name, true).within(() => {
                cy.findByText('Close Conversation').click();
            });

            verifyChannelWasProperlyClosed(channel.name);
        });
    });

    function createAndVisitGMChannel(users = []) {
        const userIds = users.map((user) => user.id);
        return cy.apiCreateGroupChannel(userIds).then(({channel}) => {
            // # Visit the new channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // * Verify channel's display name
            const displayName = users.
                map((member) => member.username).
                sort((a, b) => a.localeCompare(b, 'en', {numeric: true})).
                join(', ');
            cy.get('#channelHeaderTitle').should('contain', displayName);

            return cy.wrap(channel);
        });
    }

    // Make sure that the current channel is Town Square and that the
    // channel identified by the passed name is no longer in the channel
    // sidebar
    function verifyChannelWasProperlyClosed(channelName) {
        // * Make sure that we have switched channels
        cy.get('#channelHeaderTitle').should('contain', 'Town Square');

        // * Make sure the old DM no longer exists
        cy.get('#sidebarItem_' + channelName).should('not.exist');
    }
});
