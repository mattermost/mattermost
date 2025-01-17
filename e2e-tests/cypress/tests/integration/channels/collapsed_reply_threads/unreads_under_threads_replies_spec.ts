// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @collapsed_reply_threads

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {PostMessageResp} from 'tests/support/task_commands';

describe('Unreads count should not be shown to user', () => {
    let testTeam: Team;
    let testUser: UserProfile;
    let otherUser: UserProfile;
    let testChannel: Channel;
    let rootPost: PostMessageResp;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_on',
            },
        });

        // # Create new channel and other user, and add other user to channel
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({team, channel, user}) => {
            testTeam = team;
            testUser = user;
            testChannel = channel;

            cy.apiSaveCRTPreference(testUser.id, 'on');
            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);

                    // # Post a message as other user
                    cy.postMessageAs({sender: otherUser, message: 'Root post', channelId: testChannel.id}).then((post) => {
                        rootPost = post;
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Visit the channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('when the root post with unreads messages is deleted', () => {
        cy.uiWaitUntilMessagePostedIncludes(rootPost.data.message);

        // # Thread footer should not exist
        cy.uiGetPostThreadFooter(rootPost.id).should('not.exist');

        // # Post a reply post as current user
        cy.postMessageAs({sender: testUser, message: `@${otherUser.username} reply!`, channelId: testChannel.id, rootId: rootPost.id});

        // # Get thread footer of last post
        cy.uiGetPostThreadFooter(rootPost.id).within(() => {
            // * Reply button in Thread Footer should say '1 reply'
            cy.get('.ReplyButton').should('have.text', '1 reply');

            // * 1 avatar/participant should show in Thread Footer
            cy.get('.Avatar').should('have.lengthOf', 1);
        });

        // # Visit global threads
        cy.uiClickSidebarItem('threads');

        // * The sole thread item should have text in footer saying '1 reply'
        cy.get('article.ThreadItem').find('.activity').should('have.text', '1 reply');

        // # Visit the channel
        cy.uiClickSidebarItem(testChannel.name);

        // # Post another reply as current user
        cy.postMessageAs({sender: testUser, message: `@${otherUser.username} another reply!`, channelId: testChannel.id, rootId: rootPost.id});

        // # Get thread footer of last post
        cy.uiGetPostThreadFooter(rootPost.id).within(() => {
            // * Reply button in thread footer should say '2 replies'
            cy.get('.ReplyButton').should('have.text', '2 replies');

            // * 1 avatar/participant should show in Thread Footer
            cy.get('.Avatar').should('have.lengthOf', 1);
        });

        // # Log out and verify that the unread mentions badge is visible
        cy.apiLogout();
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        cy.get('#sidebarItem_threads').should('be.visible').find('span#unreadMentions').should('be.visible').and('have.text', '2');

        // # Login as the original user and delete the root post
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        cy.apiDeletePost(rootPost.id);

        // # Log out and verify that the unread mentions badge is no longer visible
        cy.apiLogout();
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        cy.get('#sidebarItem_threads').should('be.visible').find('span#unreadMentions').should('not.exist');
    });
});
