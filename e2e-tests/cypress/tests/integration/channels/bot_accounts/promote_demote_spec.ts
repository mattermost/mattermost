// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @bot_accounts

import {Team} from '@mattermost/types/teams';
import {createBotPatch} from '../../../support/api/bots';

describe('Managing bots in Teams and Channels', () => {
    let team: Team;

    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictCreationToDomains: 'sample.mattermost.com',
            },
        });
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            team = out.team;
        });
    });
    it('MM-T1819 Promote a BOT to team admin', () => {
        cy.makeClient().then(async (client) => {
            // # Go to channel
            const channel = await client.getChannelByName(team.id, 'off-topic');
            cy.visit(`/${team.name}/channels/${channel.name}`);

            // # Add bot to team
            const bot = await client.createBot(createBotPatch());
            await client.addToTeam(team.id, bot.user_id);

            // # Open team menu and click 'Manage Members'
            cy.uiOpenTeamMenu('Manage Members');

            // # Find bot
            cy.get('.more-modal__list').find('.more-modal__row').its('length').should('be.gt', 0);
            cy.get('#searchUsersInput').type(bot.username);

            // # Wait for loading screen
            cy.get('#teamMembersModal .loading-screen').should('be.visible');

            // # Find bot member dropdown
            cy.get(`#teamMembersDropdown_${bot.username}`).as('memberDropdown').should('contain.text', 'Member').click();

            // # Promote bot to team admin
            cy.findByTestId('userListItemActions').find('button').contains('Make Team Admin').click();

            // * Verify bot was promoted
            cy.get('@memberDropdown').should('contain.text', 'Team Admin');
        });
    });
});
