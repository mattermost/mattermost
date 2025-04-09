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

describe('Collapsed Reply Threads', () => {
    let testTeam: Team;
    let testChannel: Channel;
    let user1: UserProfile;
    let user2: UserProfile;
    let user3: UserProfile;
    let rootPost: PostMessageResp;
    let replyPost1: PostMessageResp;
    let replyPost2: PostMessageResp;

    const messages = {
        ROOT: 'ROOT POST',
        REPLY1: 'REPLY 1',
        REPLY2: 'REPLY 2',
    };

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
            user1 = user;
            testChannel = channel;

            cy.apiSaveCRTPreference(user1.id, 'on');
            cy.apiCreateUser({prefix: 'user2'}).then(({user: newUser}) => {
                user2 = newUser;

                cy.apiAddUserToTeam(testTeam.id, user2.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, user2.id);
                });
            });

            cy.apiCreateUser({prefix: 'user3'}).then(({user: newUser}) => {
                user3 = newUser;

                cy.apiAddUserToTeam(testTeam.id, user3.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, user3.id);
                });
            });
        });
    });

    beforeEach(() => {
        // # Visit the channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post a message as other user
        cy.postMessageAs({sender: user1, message: messages.ROOT, channelId: testChannel.id}).then((post) => {
            rootPost = post;
        });
    });

    it('MM-T4379 Display: Click to open threads', () => {
        cy.uiWaitUntilMessagePostedIncludes(rootPost.data.message);

        // # Get the root post
        cy.getLastPost().click();

        // * Verify the post is opened in RHS
        cy.get(`#rhsPost_${rootPost.id}`).should('be.visible');

        // # Close RHS
        cy.uiCloseRHS();

        // # Open settings modal and disable opening the thread in RHS when being clicked
        cy.uiOpenSettingsModal('Display');

        // # Open section "click to open threads"
        cy.get('#click_to_replyTitle').click();

        // # Click radio button with option B ('off')
        cy.get('#click_to_replyFormatB').click();

        // # Save settings
        cy.get('#saveSetting').click();

        // # close settings modal
        cy.uiClose();

        // # (Re-) Visit the channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Get the root post
        cy.getLastPost().click();

        // * Verify the post is opened in RHS
        cy.get(`rhsPost_${rootPost.id}`).should('not.exist');

        // # Cleanup for next test
        cy.apiDeletePost(rootPost.id);
    });

    it('MM-T4445 CRT - Delete root post', () => {
        /**
         * When you delete a post the current behavior in displaying it and the thread replies is incorrect.
         * Deleting a root post leads to a post showing `(message deleted)`, but still rendering the replies
         * in the ThreadFooter. Ideally we should remove the root post without removing the replies.
         */
        cy.uiWaitUntilMessagePostedIncludes(rootPost.data.message);

        // # Thread footer should not exist
        cy.uiGetPostThreadFooter(rootPost.id).should('not.exist');

        // # Post a reply post as current user
        cy.postMessageAs({sender: user2, message: messages.REPLY1, channelId: testChannel.id, rootId: rootPost.id});

        // # Visit global threads
        cy.uiClickSidebarItem('threads');

        // * There should be a single thread item
        cy.get('article.ThreadItem').should('have.lengthOf', 1);

        // # Delete thread root post
        cy.apiDeletePost(rootPost.id);

        /**
         * TODO: this should not be there once the root post is deleted, so remove it once the feature is adjusted
         */
        // * There should be a single thread item showing '(message deleted)'
        cy.get('article.ThreadItem').should('have.lengthOf', 1).should('contain.text', '(message deleted)');

        // # Refresh the page
        cy.reload(true);

        // * There should be no thread item anymore
        cy.get('article.ThreadItem').should('have.lengthOf', 0);
    });

    it('MM-T4446 CRT - Delete single reply post on a thread', () => {
        /**
         * When you delete a reply you are still following the thread, so the thread is not being removed
         * from the global threads view. The test description was written differently as it was assuming the
         * thread to not be followed after that. The test will be build keeping that in mind, but should
         * thread to not be followed after that. The test will be build keeping that in mind, but should
         * probably be adjusted later on.
         */
        cy.uiWaitUntilMessagePostedIncludes(rootPost.data.message);

        // # Thread footer should not exist
        cy.uiGetPostThreadFooter(rootPost.id).should('not.exist');

        // # Post a reply post as current user
        cy.postMessageAs({sender: user1, message: messages.REPLY1, channelId: testChannel.id, rootId: rootPost.id}).then((post) => {
            replyPost1 = post;

            // # Visit global threads
            cy.uiClickSidebarItem('threads');

            // * There should be a single thread item
            cy.get('article.ThreadItem').should('have.lengthOf', 1).first().click();

            // * Reply should be in RHS
            cy.get(`#rhsPostMessageText_${replyPost1.id}`).should('be.visible').should('contain.text', messages.REPLY1);

            // # Delete thread reply post
            cy.apiDeletePost(replyPost1.id);

            // * There should be a single thread item
            cy.get('article.ThreadItem').should('have.lengthOf', 1);

            // * The reply should be in RHS showing '(message deleted)'
            cy.get(`#rhsPost_${replyPost1.id}`).should('be.visible').should('contain.text', '(message deleted)');

            // # Reload to re-render UI
            cy.reload(true);

            // * There should be a single thread item with no reply
            cy.get('article.ThreadItem').should('have.lengthOf', 0);

            // * The reply post should not exist anymore
            cy.get(`#rhsPost_${replyPost1.id}`).should('not.exist');

            // # Cleanup for next test
            cy.apiDeletePost(rootPost.id);
        });
    });

    it('MM-T4447 CRT - Delete single reply post on a multi-reply thread', () => {
        cy.uiWaitUntilMessagePostedIncludes(rootPost.data.message);

        // # Thread footer should not exist
        cy.uiGetPostThreadFooter(rootPost.id).should('not.exist');

        // # Post a reply post as current user
        cy.postMessageAs({sender: user2, message: messages.REPLY1, channelId: testChannel.id, rootId: rootPost.id}).then((post) => {
            replyPost1 = post;
        }).then(() => {
            return cy.postMessageAs({sender: user3, message: messages.REPLY2, channelId: testChannel.id, rootId: rootPost.id});
        }).then((post) => {
            replyPost2 = post;

            // # Get thread footer of last post
            cy.uiGetPostThreadFooter(rootPost.id).within(() => {
                // * Reply button in Thread Footer should say '2 replies'
                cy.get('.ReplyButton').should('have.text', '2 replies');

                // * 2 avatars/participants should show in Thread Footer
                cy.get('.Avatar').should('have.lengthOf', 2);
            });

            // # Visit global threads
            cy.uiClickSidebarItem('threads');

            // * There should be a single thread item
            cy.get('article.ThreadItem').should('have.lengthOf', 1).first().click().within(() => {
                // * Activity section in ThreadItem should say '2 replies'
                cy.get('.activity').should('have.text', '2 replies');

                // * 3 avatars/participants should show in ThreadItem
                cy.get('.Avatar').should('have.lengthOf', 3);
            });

            // * The reply should be in RHS showing '(message deleted)'
            cy.get(`#rhsPost_${replyPost2.id}`).should('be.visible').should('contain.text', messages.REPLY2);

            // # Delete thread reply post
            cy.apiDeletePost(replyPost2.id);

            // # Reload to re-render UI
            cy.reload(true);

            // * There should be a single thread item
            cy.get('article.ThreadItem').should('have.lengthOf', 1).first().click().within(() => {
                // * Activity section in ThreadItem should say '1 reply'
                cy.get('.activity').should('have.text', '1 reply');

                // * 2 avatars/participants should show in ThreadItem
                cy.get('.Avatar').should('have.lengthOf', 2);
            });

            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Get thread footer of last post
            cy.uiGetPostThreadFooter(rootPost.id).within(() => {
                // * Reply button in Thread Footer should say '1 reply'
                cy.get('.ReplyButton').should('have.text', '1 reply');

                // * 1 avatar/participant should show in Thread Footer
                cy.get('.Avatar').should('have.lengthOf', 1);
            });

            // # Cleanup for next test
            cy.apiDeletePost(rootPost.id);
        });
    });

    it('MM-T4448_1 CRT - L16 - Use “Mark all as read” button', () => {
        cy.uiWaitUntilMessagePostedIncludes(rootPost.data.message);

        // # Thread footer should not exist
        cy.uiGetPostThreadFooter(rootPost.id).should('not.exist');

        // # Post a reply post as current user
        cy.postMessageAs({sender: user2, message: messages.REPLY1, channelId: testChannel.id, rootId: rootPost.id}).then((post) => {
            replyPost1 = post;

            // # Get thread footer of last post
            cy.uiGetPostThreadFooter(rootPost.id).within(() => {
                // * Reply button in Thread Footer should say '1 reply'
                cy.get('.ReplyButton').should('have.text', '1 reply');

                // * 1 avatar/participant should show in Thread Footer
                cy.get('.Avatar').should('have.lengthOf', 1);
            });

            // # Visit global threads
            cy.uiClickSidebarItem('threads');

            // * The unreads tab button has a blue dot (unread indicator)
            cy.get('#threads-list-unread-button .dot').should('have.lengthOf', 1);

            // * There should be a single thread item
            cy.get('article.ThreadItem').should('have.lengthOf', 1).within(() => {
                // * The unread indicator (blue dot) should be present
                cy.get('.dot-unreads').should('have.lengthOf', 1);

                // * Activity section in ThreadItem should say '1 new reply'
                cy.get('.activity').should('have.text', '1 new reply');
            });

            // # Get the "mark all as read" button (the selector is pretty ambiguous here, but should work for now)
            cy.get('#threads-list__mark-all-as-read').click();

            // * mark_all_threads_as_read_modal is open
            cy.get('#mark-all-threads-as-read-modal').should('exist');

            // # Click confirm button
            cy.get('button.confirm').contains('Mark all as read').click();

            // * mark_all_threads_as_read_modal is closed
            cy.get('#mark-all-threads-as-read-modal').should('not.exist');

            // * The unreads tab button does NOT have a blue dot (unread indicator)
            cy.get('#threads-list-unread-button .dot').should('not.exist');

            // * There should be a single thread item
            cy.get('article.ThreadItem').should('have.lengthOf', 1).within(() => {
                // * The unread indicator (blue dot) should NOT be present
                cy.get('.dot-unreads').should('have.lengthOf', 0);

                // * Activity section in ThreadItem should say '1 reply'
                cy.get('.activity').should('have.text', '1 reply');
            });

            // * Assert that the RHS shows the correct view
            cy.get('.no-results__holder').should('contain.text', 'Looks like you’re all caught up');

            // # Cleanup for next test
            cy.apiDeletePost(rootPost.id);
        });
    });

    it('MM-T4448_2 CRT - L16 - Cancel “Mark all as unread” modal', () => {
        cy.uiWaitUntilMessagePostedIncludes(rootPost.data.message);

        // # Thread footer should not exist
        cy.uiGetPostThreadFooter(rootPost.id).should('not.exist');

        // # Post a reply post as current user
        cy.postMessageAs({sender: user2, message: messages.REPLY1, channelId: testChannel.id, rootId: rootPost.id}).then((post) => {
            replyPost1 = post;

            // # Visit global threads
            cy.uiClickSidebarItem('threads');

            // * The unreads tab button has a blue dot (unread indicator)
            cy.get('#threads-list-unread-button .dot').should('have.lengthOf', 1);

            // * There should be a single thread item
            cy.get('article.ThreadItem').should('have.lengthOf', 1).within(() => {
                // * The unread indicator (blue dot) should be present
                cy.get('.dot-unreads').should('have.lengthOf', 1);

                // * Activity section in ThreadItem should say '1 new reply'
                cy.get('.activity').should('have.text', '1 new reply');
            });

            // # Get the "mark all as read" button
            cy.get('#threads-list__mark-all-as-read').click();

            // * Verify mark_all_threads_as_read_modal is open
            cy.get('#mark-all-threads-as-read-modal').should('exist');

            // # Click cancel button
            cy.get('.btn-tertiary').contains('Cancel').click();

            // * Verify mark_all_threads_as_read_modal is closed
            cy.get('#mark-all-threads-as-read-modal').should('not.exist');

            // * Verify the unreads tab button still has a blue dot
            cy.get('#threads-list-unread-button .dot').should('exist');

            // # Click on “Mark all as unread” button again
            cy.get('#threads-list__mark-all-as-read').click();

            // * Verify mark_all_threads_as_read_modal is open
            cy.get('#mark-all-threads-as-read-modal').should('exist');

            // # Click close button
            cy.get('button.close').click();

            // * Verify mark_all_threads_as_read_modal is closed
            cy.get('#mark-all-threads-as-read-modal').should('not.exist');

            // * Verify the unreads tab button still has a blue dot
            cy.get('#threads-list-unread-button .dot').should('exist');

            // # Click on “Mark all as unread” button again
            cy.get('#threads-list__mark-all-as-read').click();

            // # Press ESC key to close the modal
            cy.get('body').type('{esc}');

            // * Verify mark_all_threads_as_read_modal is closed
            cy.get('#mark-all-threads-as-read-modal').should('not.exist');

            // * Verify the unreads tab button still has a blue dot
            cy.get('#threads-list-unread-button .dot').should('exist');

            // * There should be a single thread item
            cy.get('article.ThreadItem').should('have.lengthOf', 1).within(() => {
                // * The unread indicator (blue dot) should be present
                cy.get('.dot-unreads').should('have.lengthOf', 1);

                // * Activity section in ThreadItem should say '1 new reply'
                cy.get('.activity').should('have.text', '1 new reply');
            });
        });

        // * Assert that the RHS shows the correct view
        cy.get('.no-results__holder').should('not.contain.text', 'Looks like you’re all caught up');

        // # Cleanup for next test
        cy.apiDeletePost(rootPost.id);
    });

    it('CRT - Threads list keyboard navigation', () => {
        // # Post a few messages as another user and then reply to each one as the current user to follow them
        let firstRoot;
        let firstReply;
        let secondRoot;
        let secondReply;
        let thirdRoot;
        let thirdReply;

        cy.postMessageAs({sender: user1, message: messages.ROOT + '1', channelId: testChannel.id}).then((post) => {
            firstRoot = post;

            cy.postMessageAs({sender: user2, message: messages.REPLY1 + '1', channelId: testChannel.id, rootId: firstRoot.id}).then((reply) => {
                firstReply = reply;
            });
        }).then(() => {
            cy.postMessageAs({sender: user1, message: messages.ROOT + '1', channelId: testChannel.id}).then((post) => {
                secondRoot = post;

                cy.postMessageAs({sender: user2, message: messages.REPLY1 + '1', channelId: testChannel.id, rootId: secondRoot.id}).then((reply) => {
                    secondReply = reply;
                });
            });
        }).then(() => {
            cy.postMessageAs({sender: user1, message: messages.ROOT + '1', channelId: testChannel.id}).then((post) => {
                thirdRoot = post;

                cy.postMessageAs({sender: user2, message: messages.REPLY1 + '1', channelId: testChannel.id, rootId: thirdRoot.id}).then((reply) => {
                    thirdReply = reply;
                });
            });
        }).then(() => {
            // # Click on the Threads item in the LHS
            cy.get('a').contains('Threads').click();

            // * There should be a three threads in the threads list
            cy.get('article.ThreadItem').should('have.lengthOf', 3);

            // * No thread should be selected at first
            cy.contains('Catch up on your threads').should('be.visible');

            // # Press the down arrow
            cy.get('body').type('{downArrow}');

            // * The third thread should be visible since it's the most recent one
            cy.contains('Catch up on your threads').should('not.exist');
            cy.get(`#rhsPost_${thirdRoot.id}`).should('be.visible');
            cy.get(`#rhsPost_${thirdReply.id}`).should('be.visible');

            // * The comment box should not be focused
            cy.focused().should('not.have.id', 'reply_textbox');

            // # Press the down arrow again
            cy.get('body').type('{downArrow}');

            // * The second thread should be visible
            cy.get(`#rhsPost_${secondRoot.id}`).should('be.visible');
            cy.get(`#rhsPost_${secondReply.id}`).should('be.visible');

            // * The comment box should still not be focused
            cy.focused().should('not.have.id', 'reply_textbox');

            // # Press the down arrow again
            cy.get('body').type('{downArrow}');

            // * The first thread should be visible
            cy.get(`#rhsPost_${firstRoot.id}`).should('be.visible');
            cy.get(`#rhsPost_${firstReply.id}`).should('be.visible');

            // * The comment box should still not be focused
            cy.focused().should('not.have.id', 'reply_textbox');

            // # Press the up arrow
            cy.get('body').type('{upArrow}');

            // * The second thread should be visible
            cy.get(`#rhsPost_${secondRoot.id}`).should('be.visible');
            cy.get(`#rhsPost_${secondReply.id}`).should('be.visible');

            // * The comment box should still not be focused
            cy.focused().should('not.have.id', 'reply_textbox');

            // # Type something
            cy.get('body').type('something');

            // * The comment box should be focused and have received that input
            cy.focused().should('have.id', 'reply_textbox').
                should('contain.text', 'something');

            // # Press the up arrow again
            cy.get('body').type('{upArrow}');

            // * The second thread should still be visible because focus is now in the comment box
            cy.get(`#rhsPost_${secondRoot.id}`).should('be.visible');
            cy.get(`#rhsPost_${secondReply.id}`).should('be.visible');
        });
    });
});
