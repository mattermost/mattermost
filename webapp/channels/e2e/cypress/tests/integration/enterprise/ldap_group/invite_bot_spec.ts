// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @ldap_group

describe('Group Synced Team - Bot invitation flow', () => {
    let groupConstrainedTeam;
    let bot;

    before(() => {
        // * Check if server has license for LDAP Groups
        cy.apiRequireLicenseForFeature('LDAPGroups');

        // # Enable LDAP
        cy.apiUpdateConfig({LdapSettings: {Enable: true}});

        // # Get the first group constrained team available on the server
        cy.apiGetAllTeams().then(({teams}) => {
            teams.forEach((team) => {
                if (team.group_constrained && !groupConstrainedTeam) {
                    groupConstrainedTeam = team;
                }
            });
        });

        // # Get the first bot on the server
        cy.apiGetBots().then(({bots}) => {
            bot = bots[0];
        });
    });

    it('MM-21793 Invite and remove a bot within a group synced team', () => {
        if (!groupConstrainedTeam || !bot) {
            return;
        }

        // # Logout sysadmin and login as an LDAP Group synced user
        cy.apiLogout();

        const user = {
            username: 'test.one',
            password: 'Password1',
        } as Cypress.UserProfile;
        cy.apiLogin(user);

        // # Visit the group constrained team
        cy.visit(`/${groupConstrainedTeam.name}`);

        // # Click 'Invite People' at team menu
        cy.uiOpenTeamMenu('Invite People');

        // # Type the first letters of a bot
        cy.get('.users-emails-input__control input').typeWithForce(bot.username);

        // * Verify user is on the list, then select by clicking on it
        cy.get('.users-emails-input__menu').
            children().should('have.length', 1).
            eq(0).should('contain', `@${bot.username}`).
            click();

        // # Invite the bot
        cy.get('#inviteMembersButton').click();

        // * Ensure that the response message was not an error
        cy.get('.InviteResultRow').find('.reason').should('not.contain', 'Error');

        // # Visit the group constrained team
        cy.visit(`/${groupConstrainedTeam.name}`);

        // # Click 'Manage Members' at team menu
        cy.uiOpenTeamMenu('Manage Members');

        // # Search for the bot that we want to remove
        cy.get('#searchUsersInput').should('be.visible').type(bot.username);

        cy.get(`#teamMembersDropdown_${bot.username}`).should('be.visible').then((el) => {
            // # Have to use a jquery click here instead of a cypress click due to in order for the dropdown menu to stay open
            el.click();

            // * Ensure that we have the ability to remove the bot and click the dropdown option
            cy.get('#removeFromTeam').should('be.visible').click();
        });

        // * Ensure that the bot is no longer there
        cy.findByTestId('noUsersFound').should('be.visible');
    });
});
