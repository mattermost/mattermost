// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @notifications

describe('Notifications', () => {
    let user1;
    let user2;
    let team1;
    let team2;
    let testTeam1TownSquareUrl;
    let siteName;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            team1 = team;
            user1 = user;
            testTeam1TownSquareUrl = `/${team.name}/channels/town-square`;

            cy.apiCreateUser().then(({user: otherUser}) => {
                user2 = otherUser;
                cy.apiAddUserToTeam(team.id, user2.id);
            });

            cy.apiCreateTeam('team-b', 'Team B').then(({team: anotherTeam}) => {
                team2 = anotherTeam;
                cy.apiAddUserToTeam(team2.id, user1.id);
                cy.apiAddUserToTeam(team2.id, user2.id);
            });

            cy.apiGetConfig().then(({config}) => {
                siteName = config.TeamSettings.SiteName;
            });

            // # Remove mention notification (for initial channel).
            cy.apiLogin(user1);
            cy.visit(testTeam1TownSquareUrl);
            cy.findByText('CHANNELS').get('.unread-title').click();
            cy.findByText('CHANNELS').get('.unread-title').should('not.exist');
            cy.apiLogout();
        });
    });

    it('MM-T561 Browser tab and team sidebar - direct messages don\'t add indicator on team icon in team sidebar (but do in browser tab)', () => {
        // # User A: Join teams A and B. Open team A
        cy.apiLogin(user1);
        cy.visit(testTeam1TownSquareUrl);

        // # User B: Join team B
        // # User B: Post a direct message to user A
        cy.apiCreateDirectChannel([user1.id, user2.id]).then(({channel: ownDMChannel}) => {
            cy.postMessageAs({sender: user2, message: `@${user1.username}`, channelId: ownDMChannel.id});
        });

        // * Browser tab shows: (1) * Town Square - [team name] Mattermost
        cy.title().should('include', `(1) Town Square - ${team1.display_name} ${siteName}`);

        // * Team sidebar shows: No unread / mention indicator in team sidebar on either team
        cy.get(`#${team2.name}TeamButton`).parent('.unread').should('not.exist');
        cy.get(`#${team2.name}TeamButton`).parent().within(() => {
            cy.get('.badge').should('not.exist');
        });
    });
});
