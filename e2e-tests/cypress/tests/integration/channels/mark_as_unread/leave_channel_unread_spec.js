// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @mark_as_unread

import {beRead, beUnread} from '../../../support/assertions';

import {markAsUnreadFromPost, switchToChannel} from './helpers';

describe('Leaving channel', () => {
    let testUser;
    let otherUser;

    let channelA;
    let channelB;

    let post1;

    beforeEach(() => {
        cy.visit('/');
        cy.apiAdminLogin();
        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            channelA = channel;

            cy.apiCreateChannel(team.id, 'channel-b', 'Channel B').then((out) => {
                channelB = out.channel;
                cy.apiAddUserToChannel(channelB.id, testUser.id);
            });

            cy.apiCreateUser().then(({user: user2}) => {
                otherUser = user2;

                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(channelA.id, otherUser.id);

                    cy.postMessageAs({
                        sender: otherUser,
                        message: 'post1',
                        channelId: channelA.id,
                    }).then((p1) => {
                        post1 = p1;
                    });
                });
            });

            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T2924_1 Channel is marked as read as soon as user leaves', () => {
        switchToChannel(channelA);

        cy.postMessageAs({sender: otherUser, message: 'post2', channelId: channelA.id});

        switchToChannel(channelB);

        // * Verify that channelA does not have unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);
    });

    it('MM-T2924_2 Channel is left unread if post is manually marked as unread and user leaves', () => {
        switchToChannel(channelA);

        markAsUnreadFromPost(post1);

        switchToChannel(channelB);

        // * Verify that channelA has unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);
    });
});

