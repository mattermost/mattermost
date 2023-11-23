// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel @channel_settings @not_cloud

// Make sure that the current channel is Town Square and that the
// channel identified by the passed name is no longer in the channel
// sidebar
function verifyChannelWasProperlyClosed(channelName) {
    // * Make sure that we have switched channels
    cy.get('#channelHeaderTitle').should('contain', 'Town Square');

    // * Make sure the old DM no longer exists
    cy.get('#sidebarItem_' + channelName).should('not.exist');
}

describe('Close direct messages', () => {
    let testUser;
    let otherUser;
    let testTeam;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            cy.apiCreateUser().then(({user: newUser}) => {
                otherUser = newUser;
                cy.apiAddUserToTeam(team.id, newUser.id);
            });

            // # Login as test user and go to town square
            cy.apiLogin(testUser);
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('Through channel header dropdown menu', () => {
        createAndVisitDMChannel([testUser.id, otherUser.id]).then((channel) => {
            // # Open channel header dropdown menu and click on Close Direct Message
            cy.get('#channelHeaderDropdownIcon').click();
            cy.findByText('Close Direct Message').click();

            verifyChannelWasProperlyClosed(channel.name);
        });
    });

    function createAndVisitDMChannel(userIds) {
        return cy.apiCreateDirectChannel(userIds).then(({channel}) => {
            // # Visit the new channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // * Verify channel's display name
            cy.get('#channelHeaderTitle').should('contain', channel.display_name);

            return cy.wrap(channel);
        });
    }
});

describe('Close group messages', () => {
    let testUser;
    let otherUser1;
    let otherUser2;
    let testTeam;

    before(() => {
        cy.apiAdminLogin();
        cy.shouldNotRunOnCloudEdition();

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

    it('Through channel header dropdown menu', () => {
        createAndVisitGMChannel([otherUser1, otherUser2]).then((channel) => {
            // # Open channel header dropdown menu and click on Close Direct Message
            cy.get('#channelHeaderDropdownIcon').click();
            cy.findByText('Close Group Message').click();

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
});
