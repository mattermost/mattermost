// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @collapsed_reply_threads

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import * as TIMEOUTS from '../../../fixtures/timeouts';
import {isMac} from '../../../utils';
import {ChainableT} from '../../../types';

describe('Collapsed Reply Threads', () => {
    let testTeam: Team;
    let testUser: UserProfile;
    let otherUser: UserProfile;
    let testChannel: Channel;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
            },
        });

        // # Create new channel and other user and add other user to channel
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({team, channel, user}) => {
            testTeam = team;
            testUser = user;
            testChannel = channel;

            cy.apiSaveCRTPreference(testUser.id, 'on');
            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });
        });
    });

    beforeEach(() => {
        // # Visit channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('MM-T4141_1 should follow a thread after replying', () => {
        // # Post message as other user
        cy.postMessageAs({
            sender: otherUser,
            message: 'Root post,',
            channelId: testChannel.id,
        }).then(({id: rootId}) => {
            // * Thread footer should not be visible
            cy.get(`#post_${rootId}`).find('.ThreadFooter').should('not.exist');

            // # Click on post to open RHS
            cy.get(`#post_${rootId}`).click();

            // * Button on header should say Follow as current user is not following
            cy.get('#rhsContainer').find('.FollowButton').should('have.text', 'Follow');

            // # Post a reply as current user
            cy.postMessageReplyInRHS('Reply!');

            // # Get last root post
            cy.get(`#post_${rootId}`).

                // * thread footer should exist now
                get('.ThreadFooter').should('exist').
                within(() => {
                    // * the button on the footer should say Following
                    cy.get('.FollowButton').should('have.text', 'Following');
                });

            // * the button on the RHS header should now say Following
            cy.get('#rhsContainer').find('.FollowButton').should('have.text', 'Following');

            // # Visit global threads
            cy.uiClickSidebarItem('threads');

            // * There should be a thread there
            cy.get('article.ThreadItem').should('have.have.lengthOf', 1);
        });
    });

    it('MM-T4141_2 should follow a thread after marking it as unread', () => {
        // # Post a root post as other user
        postMessageWithReply(testChannel.id, otherUser, 'Another interesting post,', otherUser, 'Self reply!').then(({rootId, replyId}) => {
            // # Get root post
            cy.get(`#post_${rootId}`).within(() => {
                // * Thread footer should be visible
                cy.get('.ThreadFooter').should('exist').

                    // * Thread footer button should say 'Follow'
                    find('.FollowButton').should('have.text', 'Follow');
            });

            // # Click on root post to open thread
            cy.get(`#post_${rootId}`).click();

            // * RHS header button should say 'Follow'
            cy.get('#rhsContainer').find('.FollowButton').should('have.text', 'Follow');

            // # Click on the reply's dot menu and mark as unread
            cy.uiClickPostDropdownMenu(replyId, 'Mark as Unread', 'RHS_COMMENT');

            // * RHS header button should say 'Following'
            cy.get('#rhsContainer').find('.FollowButton').should('have.text', 'Following');

            // # Get root post
            cy.get(`#post_${rootId}`).within(() => {
                // * Thread footer should be visible
                cy.get('.ThreadFooter').should('exist').

                    // * Thread footer button should say 'Following'
                    find('.FollowButton').should('have.text', 'Following');
            });

            // # Visit global threads
            cy.uiClickSidebarItem('threads');

            // * There should be 2 threads now
            cy.get('article.ThreadItem').should('have.have.lengthOf', 2);
        });
    });

    it('MM-T4141_3 clicking "Following" button in the footer should unfollow the thread', () => {
        // # Post a root post as other user
        postMessageWithReply(testChannel.id, otherUser, 'Another interesting post,', testUser, 'Self reply!');

        // # Get last root post in channel
        cy.getLastPostId().then((rootId) => {
            // # Open the thread
            cy.get(`#post_${rootId}`).click();

            // * RHS header button should say 'Following'
            cy.get('#rhsContainer').find('.FollowButton').should('have.text', 'Following');

            // # Get thread footer of last root post
            cy.get(`#post_${rootId}`).within(() => {
                // * thread footer should exist
                cy.get('.ThreadFooter').should('exist');

                // * thread footer button should say 'Following'
                cy.get('.FollowButton').should('have.text', 'Following');

                // # Click thread footer Following button
                cy.get('.FollowButton').click({force: true});

                // * thread footer button should say 'Follow'
                cy.get('.FollowButton').should('have.text', 'Follow');
            });

            // * RHS header button should say 'Follow'
            cy.get('#rhsContainer').find('.FollowButton').should('have.text', 'Follow');

            // # Close RHS
            cy.uiCloseRHS();
        });
    });

    it('MM-T4141_4 clicking "Follow" button in the footer should follow the thread', () => {
        // # Post a root post as other user
        postMessageWithReply(testChannel.id, otherUser, 'Another interesting post,', otherUser, 'Self reply!');

        // # Get last root post in channel
        cy.getLastPostId().then((rootId) => {
            // # Open the thread
            cy.get(`#post_${rootId}`).click();

            // * RHS header button should say 'Follow'
            cy.get('#rhsContainer').find('.FollowButton').should('have.text', 'Follow');

            // # Get thread footer of last root post
            cy.get(`#post_${rootId}`).within(() => {
                // * thread footer should exist
                cy.get('.ThreadFooter').should('exist');

                // * thread footer button should say 'Follow'
                cy.get('.FollowButton').should('have.text', 'Follow');

                // # Click thread footer 'Follow' button
                cy.get('.FollowButton').click({force: true});

                // * thread footer button should say 'Following'
                cy.get('.FollowButton').should('have.text', 'Following');
            });

            // * RHS header button should say 'Following'
            cy.get('#rhsContainer').find('.FollowButton').should('have.text', 'Following');

            // # Close RHS
            cy.uiCloseRHS();
        });
    });

    it('MM-T4682 should show search guidance at the end of the list after scroll loading', () => {
        // # Create more than 25 threads so we can use scroll loading in the Threads list
        for (let i = 1; i <= 30; i++) {
            postMessageWithReply(testChannel.id, otherUser, `Another interesting post ${i}`, testUser, `Another reply ${i}!`).then(({rootId}) => {
                // # Mark last thread as Unread
                if (i === 30) {
                    // # Click on root post to open thread
                    cy.get(`#post_${rootId}`).click();

                    // # Click on the reply's dot menu and mark as unread
                    cy.uiClickPostDropdownMenu(rootId, 'Mark as Unread', 'RHS_ROOT');
                }
            });
        }

        cy.uiClickSidebarItem('threads');

        // # Scroll load the threads list to reach the end
        const maxScrolls = 3;
        scrollThreadsListToEnd(maxScrolls);

        // * Search guidance item should be shown at the end of the threads list
        cy.get('.ThreadList .no-results__wrapper').should('be.visible').within(() => {
            // * Title, subtitle and shortcut keys should be shown
            cy.findByText('That’s the end of the list').should('be.visible');
            cy.contains('If you’re looking for older conversations, try searching with ').should('be.visible').within(() => {
                cy.findByText(isMac() ? '⌘' : 'Ctrl').should('be.visible');
                cy.findByText('Shift').should('be.visible');
                cy.findByText('F').should('be.visible');
            });
        });

        // # Click Unreads button
        cy.findByText('Unreads').click();

        // * Search guidance item should not be shown at the end of the Unreads threads list
        cy.get('.ThreadList .no-results__wrapper').should('not.exist');
    });
});

function postMessageWithReply(channelId, postSender, postMessage, replySender, replyMessage): ChainableT {
    return cy.postMessageAs({
        sender: postSender,
        message: postMessage || 'Another interesting post.',
        channelId,
    }).then(({id: rootId}) => {
        cy.postMessageAs({
            sender: replySender || postSender,
            message: replyMessage || 'Another reply!',
            channelId,
            rootId,
        }).then(({id: replyId}) => (Promise.resolve({rootId, replyId})));
    });
}

function scrollThreadsListToEnd(maxScrolls = 1, scrolls = 0): ChainableT<void> {
    if (scrolls === maxScrolls) {
        return;
    }

    cy.get('.ThreadList .virtualized-thread-list').scrollTo('bottom').then(($el) => {
        const element = $el.find('.no-results__wrapper');

        if (element.length < 1) {
            cy.wait(TIMEOUTS.ONE_SEC).then(() => {
                scrollThreadsListToEnd(maxScrolls, scrolls + 1);
            });
        } else {
            cy.wrap(element).scrollIntoView();
        }
    });
}
