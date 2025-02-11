// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

describe('Restrict Direct Message Channels', () => {
    let testTeam;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictDirectMessage: 'any',
            },
        });

        // # Initialize setup
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create another user
            cy.apiCreateUser().then(({user}) => {
                otherUser = user;
                cy.apiLogin(testUser);
            });
        });
    });

    it('should allow direct messages between any users when RestrictDirectMessage is set to "any"', () => {
        // # Visit the town-square channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open the direct messages modal
        cy.findByLabelText('DIRECT MESSAGES').parents('.SidebarChannelGroup').within(() => {
            cy.get('.SidebarChannelGroupHeader_addButton').click();
        });
        cy.get('#moreDmModal').should('exist');

        // # Type the username of the other user in the search box
        cy.get('#selectItems input').should('be.enabled').typeWithForce(otherUser.username);

        // * Verify that the otherUser is specifically listed in the direct messages modal
        cy.get('.more-modal__row').contains(otherUser.username).should('exist');
    });

    it('should restrict direct messages to team members when RestrictDirectMessage is set to "team"', () => {
        // # set RestrictDirectMessage to 'team'
        cy.apiAdminLogin().then(() => {
            cy.apiUpdateConfig({
                TeamSettings: {
                    RestrictDirectMessage: 'team',
                },
            }).then(() => {
                cy.apiLogin(testUser);
            });
        });

        // # Visit the town-square channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open the direct messages modal
        cy.findByLabelText('DIRECT MESSAGES').parents('.SidebarChannelGroup').within(() => {
            cy.get('.SidebarChannelGroupHeader_addButton').click();
        });
        cy.get('#moreDmModal').should('exist');

        // # Type the username of the other user in the search box
        cy.get('#selectItems input').should('be.enabled').typeWithForce(otherUser.username);

        // * Verify that no users are listed in the direct messages modal
        cy.get('.more-modal__row').should('not.exist');

        // # Add the other user back to the team
        cy.apiAdminLogin();
        cy.apiAddUserToTeam(testTeam.id, otherUser.id);

        // # Login as the test user again
        cy.apiLogin(testUser);

        // # Visit the town-square channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open the direct messages modal
        cy.findByLabelText('DIRECT MESSAGES').parents('.SidebarChannelGroup').within(() => {
            cy.get('.SidebarChannelGroupHeader_addButton').click();
        });
        cy.get('#moreDmModal').should('exist');

        // # Type the username of the other user in the search box
        cy.get('#selectItems input').should('be.enabled').typeWithForce(otherUser.username);

        // * Verify that the otherUser is specifically listed in the direct messages modal
        cy.get('.more-modal__row').contains(otherUser.username).should('exist');
    });

    it('should not allow direct messages to users that no longer share a team', () => {
        // # Login as sysadmin and set RestrictDirectMessage to 'team'
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictDirectMessage: 'team',
            },
        });
        cy.apiAddUserToTeam(testTeam.id, otherUser.id);

        // # Login as the test user
        cy.apiLogin(testUser);

        // # Visit the town-square channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open a direct message with another user
        cy.apiCreateDirectChannel([otherUser.id, testUser.id]).then((channel) => {
            // # Visit the direct message channel
            cy.visit(`/${testTeam.name}/messages/@${otherUser.username}`);

            // # Verify that the channel is open and the user can send a message
            cy.get('.channel-header').should('exist');
            cy.get('#post_textbox').should('be.enabled');

            // # Post a message in the direct message channel
            cy.get('#post_textbox').type('Hello, this is a test message{enter}');

            // # Verify the message is posted
            cy.getLastPost().should('contain', 'Hello, this is a test message');

            // # Remove the other user from the team
            cy.apiAdminLogin();
            cy.removeUserFromTeam(testTeam.id, otherUser.id);

            // # Login as the test user again
            cy.apiLogin(testUser);

            // # Check if the direct message channel is still in the sidebar
            cy.get(`#sidebarItem_${channel.channel.name}`).should('exist').click();

            // # Verify that the channel is open and the user cannot send a message
            cy.get('#post_textbox').should('not.exist');
            cy.get('#noSharedTeamMessage').should('exist');
        });
    });
});
