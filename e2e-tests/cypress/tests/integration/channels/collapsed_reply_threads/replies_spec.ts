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
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Collapsed Reply Threads', () => {
    let testTeam: Team;
    let testUser: UserProfile;
    let otherUser: UserProfile;
    let testChannel: Channel;
    let rootPost: PostMessageResp;
    let postForAvatar: PostMessageResp;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
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

                    // # Post a message as other user for clicking avatar test
                    cy.postMessageAs({sender: otherUser, message: 'Root post for clicking avatar', channelId: testChannel.id}).then((post) => {
                        postForAvatar = post;
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Visit the channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('MM-T4142 should show number of replies in thread', () => {
        cy.uiWaitUntilMessagePostedIncludes(rootPost.data.message);

        // # Thread footer should not exist
        cy.uiGetPostThreadFooter(rootPost.id).should('not.exist');

        // # Post a reply post as current user
        cy.postMessageAs({sender: testUser, message: 'reply!', channelId: testChannel.id, rootId: rootPost.id});

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
        cy.get('div.ThreadItem').find('.activity').should('have.text', '1 reply');

        // # Visit the channel
        cy.uiClickSidebarItem(testChannel.name);

        // # Post another reply as current user
        cy.postMessageAs({sender: testUser, message: 'another reply!', channelId: testChannel.id, rootId: rootPost.id});

        // # Get thread footer of last post
        cy.uiGetPostThreadFooter(rootPost.id).within(() => {
            // * Reply button in thread footer should say '2 replies'
            cy.get('.ReplyButton').should('have.text', '2 replies');

            // * 1 avatar/participant should show in Thread Footer
            cy.get('.Avatar').should('have.lengthOf', 1);
        });

        // # Visit global threads
        cy.uiClickSidebarItem('threads');

        // * The sole thread item should have text in footer saying '2 replies'
        cy.get('div.ThreadItem').find('.activity').should('have.text', '2 replies');

        // # Visit the channel
        cy.uiClickSidebarItem(testChannel.name);

        // # Post another reply as other user
        cy.postMessageAs({sender: otherUser, message: 'other reply!', channelId: testChannel.id, rootId: rootPost.id});

        // # Get thread footer of last post
        cy.uiGetPostThreadFooter(rootPost.id).within(() => {
            // * Reply button in thread footer should say '3 replies'
            cy.get('.ReplyButton').should('have.text', '3 replies');

            // * 2 avatars/participants should show in Thread Footer
            cy.get('.Avatar').should('have.lengthOf', 2);
        });

        // # Visit global threads
        cy.uiClickSidebarItem('threads');

        // * The sole thread item should have text in footer saying '1 new reply'
        cy.get('div.ThreadItem').find('.activity').should('have.text', '1 new reply');
    });

    it('MM-T4646 should open popover when avatar is clicked', () => {
        cy.uiWaitUntilMessagePostedIncludes(postForAvatar.data.message);

        // # Post a reply post as current user
        cy.postMessageAs({sender: testUser, message: 'reply!', channelId: testChannel.id, rootId: postForAvatar.id});

        // # Post another reply as other user
        cy.postMessageAs({sender: otherUser, message: 'another reply!', channelId: testChannel.id, rootId: postForAvatar.id});

        // # Get thread footer of last post and find avatars
        cy.uiGetPostThreadFooter(postForAvatar.id).find('.Avatars').find('button').first().click();

        // * Profile popover should be visible and close on ESC
        cy.get('div.user-profile-popover').first().should('be.visible').find('button.btn-primary.btn-sm').type('{esc}');

        // # Visit global threads
        cy.uiClickSidebarItem('threads');

        // * Find the first avatar and click it
        cy.get('div.ThreadItem').find('.activity').find('.Avatars').find('button').first().click();

        // * Profile popover should be visible and close on ESC
        cy.get('div.user-profile-popover').first().should('be.visible').find('button.btn-primary.btn-sm');
    });

    it('MM-T4143 Emoji reaction - type +:+1:', () => {
        // # Create a root post
        cy.postMessage('Hello!');

        cy.getLastPostId().then((postId) => {
            // # Click on post to open the thread in RHS
            cy.get(`#post_${postId}`).click();

            // # Type "+:+1:" in comment box to react to the post with a thumbs-up and post
            cy.postMessageReplyInRHS('+:+1:');

            // * Thumbs-up reaction displays as reaction on post
            cy.get(`#${postId}_message`).within(() => {
                cy.findByLabelText('reactions').should('be.visible');
                cy.findByLabelText('remove reaction +1').should('be.visible');
            });

            // * Reacting to a root post should not create a thread (thread footer should not exist)
            cy.uiGetPostThreadFooter(postId).should('not.exist');

            // # Close RHS
            cy.uiCloseRHS();
        });
    });

    it('MM-T5413 should auto-scroll to bottom upon pasting long text in reply', () => {
        // # Post a root post as current user
        cy.postMessageAs({
            sender: testUser,
            message: 'Another interesting post,',
            channelId: testChannel.id,
        }).then(({id: rootId}) => {
            // # Post multiple replies as other user so that the new messages line is pushed up
            Cypress._.times(20, (i) => {
                cy.postMessageAs({
                    sender: otherUser,
                    message: 'Reply ' + i,
                    channelId: testChannel.id,
                    rootId,
                });
            });

            // # Click root post
            cy.get(`#post_${rootId}`).click();

            // # Wait for RHS to open and scroll to position
            cy.wait(TIMEOUTS.ONE_SEC);

            // * RHS should open and the editor's actions should be visible.
            cy.get('#rhsContainer').findByTestId('SendMessageButton').should('be.visible');

            // # Close RHS
            cy.uiCloseRHS();

            // # Click root post
            cy.get(`#post_${rootId}`).click();

            // # Paste a multiline string in the RHS textbox.
            const text = 'word '.repeat(2000);
            cy.get('#rhsContainer').findByTestId('reply_textbox').clear().invoke('val', text).trigger('input');

            // * RHS should open and the editor should be visible and focused
            cy.get('#rhsContainer').findByTestId('SendMessageButton').scrollIntoView().should('be.visible');
        });
    });
});
