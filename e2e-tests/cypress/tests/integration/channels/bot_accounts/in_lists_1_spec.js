// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @bot_accounts

import {createBotPatch} from '../../../support/api/bots';
import {generateRandomUser} from '../../../support/api/user';

describe('Bots in lists', () => {
    let team;
    let channel;
    let bots;
    let createdUsers;

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
                client.createUser(generateRandomUser()),
                client.createUser(generateRandomUser()),
            ]);

            await Promise.all([
                ...bots,
                ...createdUsers,
            ].map(async (user) => {
                // * Verify username exists
                cy.wrap(user).its('username');

                // # Add to team and channel
                await client.addToTeam(team.id, user.user_id ?? user.id);
                await client.addToChannel(user.user_id ?? user.id, channel.id);
            }));
        });
    });

    it('MM-T1834 Bots are not listed on “Users” list in System Console > Users', () => {
        // # Go to system console > users
        cy.visit('/admin_console/user_management/users');

        bots.forEach(({username}) => {
            // # Search for bot
            cy.get('#searchUsers').clear().type(`@${username}`);

            // * Verify bot not in list
            cy.findByTestId('noUsersFound').should('have.text', 'No users found');

            // * Verify pseudo checksum total of non bot users
            cy.get('#searchableUserListTotal').contains('0 users of').should('be.visible');
        });
    });
});
