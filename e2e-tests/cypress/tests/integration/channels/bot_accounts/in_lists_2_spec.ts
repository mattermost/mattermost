// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @bot_accounts

import {Bot} from '@mattermost/types/bots';
import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {createBotPatch} from '../../../support/api/bots';
import {generateRandomUser} from '../../../support/api/user';

describe('Bots in lists', () => {
    let team: Team;
    let channel: Channel;
    let testUser: UserProfile;

    const STATUS_PRIORITY = {
        online: 0,
        away: 1,
        dnd: 2,
        offline: 3,
        ooo: 3,
    };

    before(() => {
        cy.apiInitSetup().then((out) => {
            team = out.team;
            channel = out.channel;
            testUser = out.user;
        });

        cy.makeClient().then(async (client) => {
            // # Create bots
            const bots = await Promise.all([
                client.createBot(createBotPatch()),
                client.createBot(createBotPatch()),
                client.createBot(createBotPatch()),
            ]);

            // # Create users
            const createdUsers = await Promise.all([
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

    it('MM-T1835 Channel Members list for BOTs', () => {
        cy.makeClient({user: testUser}).then((client) => {
            // # Login as regular user and visit a channel
            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/${channel.name}`);

            // # Open channel members
            cy.get('.channel-header__trigger').click();
            cy.findByText('Manage Members').click();

            cy.get('.more-modal__row .more-modal__name').then(async ($query) => {
                // # Extract usernames from jQuery collection
                const usernames = $query.toArray().map(({innerText}) => innerText.split('\n')[0]);

                // # Get users
                const profiles = await client.getProfilesByUsernames(usernames);
                const statuses = await client.getStatusesByIds(profiles.map((user) => user.id));
                const users = Cypress._.zip(profiles, statuses).map(([profile, status]) => ({...profile, ...status}));

                // # Sort 'em
                const sortedUsers = Cypress._.sortBy(users, [
                    ({is_bot: isBot}) => (isBot ? 1 : 0), // users first
                    ({status}) => STATUS_PRIORITY[status],
                    ({username}) => username,
                ]);

                // * Verify order of member-dropdown users against API-sourced/data-sorted version
                cy.wrap(usernames).should('deep.equal', sortedUsers.map(({username}) => username));
            });

            // * Verify no statuses on bots
            cy.get('.more-modal__row--bot .status-wrapper .status').should('not.exist');

            // * Verify bot badges
            cy.get('.more-modal__row--bot .Tag').then(($tags) => {
                $tags.toArray().forEach((tagEl) => {
                    cy.wrap(tagEl).then(() => tagEl.scrollIntoView());
                    cy.wrap(tagEl).should('be.visible').and('have.text', 'BOT');
                });
            });
        });
    });
});
