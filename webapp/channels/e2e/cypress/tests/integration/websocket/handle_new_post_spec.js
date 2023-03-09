// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @websocket

import {beRead, beUnread} from '../../support/assertions';
import {getAdminAccount} from '../../support/env';

import {getRandomId} from '../../utils';

describe('Handle new post', () => {
    const admin = getAdminAccount();
    let channel1;
    let team1;
    let user1;

    before(() => {
        cy.apiInitSetup().then(({channel, team, user}) => {
            channel1 = channel;
            team1 = team;
            user1 = user;

            cy.apiLogin(user1);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T4609 - should mark channel as unread when a message is sent in another channel', () => {
        // # Explicitly click over to the test channel from Town Square
        // # to dismiss the unread + badge from adding `user` to the channel
        cy.get(`#sidebarItem_${channel1.name}`).click();

        // * Verify those are now gone
        cy.get(`#sidebarItem_${channel1.name}`).should(beRead);
        cy.get(`#sidebarItem_${channel1.name} .badge`).should('not.exist');

        // # Switch back to Town Square
        cy.get('#sidebarItem_town-square').click();

        // # Have another user post in the test channel
        cy.postMessageAs({sender: admin, message: 'post', channelId: channel1.id});

        // * Verify that the channel is now unread
        cy.get(`#sidebarItem_${channel1.name}`).should(beUnread);
        cy.get(`#sidebarItem_${channel1.name} .badge`).should('not.exist');
    });

    it('MM-T4610 - should show the mention badge when a mention is sent in another channel', () => {
        // # Explicitly click over to the test channel from Town Square
        // # to dismiss the unread + badge from the end of the previous test
        // # (maybe should use a new channel but then the same thing has to be done
        // # for that anyways)
        cy.get(`#sidebarItem_${channel1.name}`).click();

        cy.get(`#sidebarItem_${channel1.name}`).should(beRead);
        cy.get(`#sidebarItem_${channel1.name} .badge`).should('not.exist');

        // # Switch back to Town Square
        cy.get('#sidebarItem_town-square').click();

        // # Have another user post in the test channel
        cy.postMessageAs({sender: admin, message: `@${user1.username}`, channelId: channel1.id});

        // * Verify that the channel is now unread with one mention
        cy.get(`#sidebarItem_${channel1.name}`).should(beUnread);
        cy.get(`#sidebarItem_${channel1.name} .badge`).should('exist').contains('1');

        // # And have them post again
        cy.postMessageAs({sender: admin, message: `@${user1.username}`, channelId: channel1.id});

        // * Verify that the channel is now unread with two mentions
        cy.get(`#sidebarItem_${channel1.name}`).should(beUnread);
        cy.get(`#sidebarItem_${channel1.name} .badge`).should('exist').contains('2');
    });

    it('MM-T2015 - should show the mention badge when added to another channel', () => {
        const baseUrl = Cypress.config('baseUrl');

        // # Have another user create a new channel
        const channelName = 'channel_' + getRandomId();
        cy.externalRequest({
            user: admin,
            baseUrl,
            method: 'post',
            path: 'channels',
            data: {
                display_name: channelName,
                name: channelName,
                team_id: team1.id,
                type: 'O',
            },
        }).then((response) => {
            expect(response.status).to.equal(201);

            const channel = response.data;

            // # And then invite the current user
            cy.externalRequest({
                user: admin,
                baseUrl,
                method: 'post',
                path: `channels/${channel.id}/members`,
                data: {
                    user_id: user1.id,
                },
            }).then((addResponse) => {
                expect(addResponse.status).to.equal(201);
            });
        });

        // * Verify that the channel is in the current user's sidebar and is unread with one mention
        cy.get(`#sidebarItem_${channelName}`).should(beUnread);
        cy.get(`#sidebarItem_${channelName} .badge`).should('exist').contains('1');
    });

    it('MM-25452 should only show one mention added to another channel with network lag', () => {
        const baseUrl = Cypress.config('baseUrl');

        // # Have another user create a new channel
        const channelName = 'channel_' + getRandomId();
        cy.externalRequest({
            user: admin,
            baseUrl,
            method: 'post',
            path: 'channels',
            data: {
                display_name: channelName,
                name: channelName,
                team_id: team1.id,
                type: 'O',
            },
        }).then((response) => {
            expect(response.status).to.equal(201);

            const channel = response.data;

            // # Add a small delay to the request to fetch the channel
            cy.delayRequestToRoutes([`channels/${channel.id}`], 100);

            // # And then invite the current user
            cy.externalRequest({
                user: admin,
                baseUrl,
                method: 'post',
                path: `channels/${channel.id}/members`,
                data: {
                    user_id: user1.id,
                },
            }).then((addResponse) => {
                expect(addResponse.status).to.equal(201);
            });
        });

        // * Verify that the channel is in the current user's sidebar and is unread with one mention
        cy.get(`#sidebarItem_${channelName}`).should(beUnread);
        cy.get(`#sidebarItem_${channelName} .badge`).should('exist').contains('1');
    });
});
