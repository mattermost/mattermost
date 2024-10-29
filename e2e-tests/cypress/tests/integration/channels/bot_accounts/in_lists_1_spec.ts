// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @bot_accounts

import {Bot} from '@mattermost/types/bots';
import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {createBotPatch} from '../../../support/api/bots';
import {generateRandomUser} from '../../../support/api/user';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Bots in lists', () => {
    let team: Team;
    let channel: Channel;
    let bots: Bot[];
    let createdUsers: UserProfile[];

    before(() => {
        cy.apiInitSetup().then((out) => {
            team = out.team;
            channel = out.channel;
        });

        cy.makeClient().then(async (client) => {
            // # Create bots
            bots = await Promise.all([
                client.createBot(createBotPatch()),
                client.createBot(createBotPatch()),
                client.createBot(createBotPatch()),
            ]);

            // # Create users
            createdUsers = await Promise.all([
                client.createUser(generateRandomUser() as UserProfile, '', ''),
                client.createUser(generateRandomUser() as UserProfile, '', ''),
            ]);

            await Promise.all([
                ...bots,
                ...createdUsers,
            ].map(async (user) => {
                // * Verify username exists
                cy.wrap(user).its('username');

                // # Add to team and channel
                await client.addToTeam(team.id, (user as Bot).user_id ?? (user as UserProfile).id);
                await client.addToChannel((user as Bot).user_id ?? (user as UserProfile).id, channel.id);
            }));
        });
    });

    it('MM-T1834 Bots are not listed on “Users” list in System Console > Users', () => {
        // # Go to system console > users
        cy.visit('/admin_console/user_management/users');

        bots.forEach(({username}) => {
            // # Search for bot
            cy.get('#input_searchTerm').clear().type(`${username}`).wait(TIMEOUTS.ONE_SEC);

            // * Verify bot not in list
            cy.get('.noRows').should('have.text', 'No data');

            // * Verify pseudo checksum total of non bot users
            cy.get('.adminConsoleListTabletOptionalHead > span').should('have.text', '0 users').should('be.visible');
        });
    });
});
