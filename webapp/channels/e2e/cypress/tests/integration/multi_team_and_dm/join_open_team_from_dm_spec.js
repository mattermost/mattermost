// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Stage: @prod
// Group: @multi_team_and_dm

describe('Join an open team from a direct message link', () => {
    let openTeam;
    let testUserInOpenTeam;
    let publicChannelInOpenTeam;

    let secondTestTeam;
    let testUserOutsideOpenTeam;

    before(() => {
        cy.apiCreateTeam('mmt452-second-team', 'mmt452-second-team', 'I', true).then(({team}) => {
            secondTestTeam = team;

            // # Create test user in closed team
            cy.apiCreateUser().then(({user}) => {
                testUserOutsideOpenTeam = user;
                cy.apiAddUserToTeam(secondTestTeam.id, testUserOutsideOpenTeam.id);
            });
        });

        cy.apiCreateTeam('mmt452-open-team', 'mmt452-open-team', 'O', true).then(({team}) => {
            openTeam = team;

            // # Allow any user with an account on this server to join this team
            cy.apiPatchTeam(openTeam.id, {
                allow_open_invite: true,
            });

            // # Create a public channel inside the open team
            cy.apiCreateChannel(openTeam.id, 'open-team-channel', 'open-team-channel').then(({channel}) => {
                publicChannelInOpenTeam = channel;
            });

            // # Create test user
            cy.apiCreateUser().then(({user}) => {
                testUserInOpenTeam = user;

                // # Add user to open team
                cy.apiAddUserToTeam(openTeam.id, testUserInOpenTeam.id);

                // # Login as test user
                cy.apiLogin(testUserInOpenTeam);
            });
        });
    });

    it('MM-T452 User with no teams should be able to join an open team from a link in direct messages', () => {
        // # View 'off-topic' channel
        cy.visit(`/${openTeam.name}/channels/${publicChannelInOpenTeam.name}`);

        // * Expect channel title to match title passed in argument
        cy.get('#channelHeaderTitle').
            should('be.visible').
            and('contain.text', publicChannelInOpenTeam.display_name);

        // # Copy full url to channel
        cy.url().then((publicChannelUrl) => {
            // # From the 'Direct Messages' menu, send the URL of the public channel to the user outside the team
            sendDirectMessageToUser(testUserOutsideOpenTeam, openTeam, publicChannelUrl);

            // # Logout as test user
            cy.apiLogout();

            // # Login as user outside team
            cy.apiLogin(testUserOutsideOpenTeam);

            // # Reload the page to ensure the new session is active
            cy.reload();

            // * Expect page to reload with new user session, username should display in the header
            cy.uiOpenUserMenu().findByText(`@${testUserOutsideOpenTeam.username}`);

            // # Open direct message from the user in the open team (testUserInOpenTeam)
            cy.visit(`/${secondTestTeam.name}/messages/@${testUserInOpenTeam.username}`);

            // * Expect channel title to contain the username (ensures we opened the right DM)
            cy.get('#channelHeaderTitle').
                should('be.visible').
                and('contain.text', `${testUserInOpenTeam.username}`);

            // # Click on URL sent by the user in the open team
            cy.findByTestId('postContent').
                first().
                find('a.theme.markdown__link').
                should('have.attr', 'href', publicChannelUrl);
            cy.visit(publicChannelUrl);

            // * Expect URL to equal what was sent to the user outside the team
            cy.url().should('equal', publicChannelUrl);
        });

        // * Expect the current team's display name to match the open team's display name
        cy.uiGetLHSHeader().findByText(openTeam.display_name);

        // * Expect channel title to match the display name of our previously created channel
        cy.get('#channelHeaderTitle').
            should('be.visible').
            and('contain.text', publicChannelInOpenTeam.display_name);
    });
});

const sendDirectMessageToUser = (user, team, message) => {
    // # Open the the direct messages channel with the target user
    cy.visit(`/${team.name}/messages/@${user.username}`);

    // * Expect the channel title to be the user's username
    // In the channel header, it seems there is a space after the username, justifying the use of contains.text instead of have.text
    cy.get('#channelHeaderTitle').should('be.visible').and('contain.text', user.username);

    // # Type message and send it to the user
    cy.postMessage(message);
};
