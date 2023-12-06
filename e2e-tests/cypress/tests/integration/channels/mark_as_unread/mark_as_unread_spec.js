// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @mark_as_unread

import {beRead, beUnread} from '../../../support/assertions';

import {verifyPostNextToNewMessageSeparator, verifyTopSpaceForNewMessage, verifyBottomSpaceForNewMessage, switchToChannel, showCursor, notShowCursor} from './helpers';

describe('Mark as Unread', () => {
    let testUser;
    let team1;
    let channelA;
    let channelB;

    let post1;
    let post2;
    let post3;

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiInitSetup().then(({team, channel, user}) => {
            team1 = team;
            testUser = user;
            channelA = channel;

            cy.apiCreateChannel(team1.id, 'channel-b', 'Channel B').then((out) => {
                channelB = out.channel;
                cy.apiAddUserToChannel(channelB.id, testUser.id);
            });

            cy.apiCreateUser().then(({user: user2}) => {
                const otherUser = user2;

                cy.apiAddUserToTeam(team1.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(channelA.id, otherUser.id);

                    // Another user creates posts in the channel since you can't mark your own posts unread currently
                    cy.postMessageAs({
                        sender: otherUser,
                        message: 'post1',
                        channelId: channelA.id,
                    }).then((p1) => {
                        post1 = p1;

                        cy.postMessageAs({
                            sender: otherUser,
                            message: 'post2',
                            channelId: channelA.id,
                        }).then((p2) => {
                            post2 = p2;

                            cy.postMessageAs({
                                sender: otherUser,
                                message: 'post3',
                                channelId: channelA.id,
                                rootId: post1.id,
                            }).then((post) => {
                                post3 = post;
                            });
                        });
                    });
                });
            });

            cy.apiLogin(testUser);
            cy.visit(`/${team1.name}/channels/town-square`);
        });
    });

    it('Channel should appear unread after switching away from channel and be read after switching back', () => {
        // Starts unread
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        switchToChannel(channelA);

        // Then becomes read when you view the channel
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);

        markAsUnreadFromPost(post2);

        // Then becomes unread when the channel is marked as unread
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        switchToChannel(channelB);

        // Then stays unread when switching away
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        switchToChannel(channelA);

        // And becomes read when switching back
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);
    });

    it('MM-T5223 The latest post should appear unread after marking the channel as unread', () => {
        // channelA starts unread, then becomes read after you viewed
        // and switched to channelB
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);
        switchToChannel(channelA);
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);
        switchToChannel(channelB);

        // After mark channelA with the LHS mark as unread option, channelA
        // should appear unread
        cy.get(`#sidebarItem_${channelA.name}`).find('.SidebarMenu').click({force: true});
        cy.get(`#markAsUnread-${channelA.id}`).click();
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        // After switching back to channelA,
        // the New Messages line should appear above the last post (post3)
        cy.get(`#sidebarItem_${channelA.name}`).click();
        verifyPostNextToNewMessageSeparator('post3');
    });

    it('MM-T5224 The latest post should appear unread after marking the channel as unread with alt/option+left-click on channel sidebar item', () => {
        // channelA starts unread, then becomes read after you viewed
        // and switched to channelB
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);
        switchToChannel(channelA);
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);
        switchToChannel(channelB);

        // After mark channelA with alt/option+left-click, channelA
        // should appear unread
        cy.get(`#sidebarItem_${channelA.name}`).type('{alt}', {release: false}).click();
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        // After switching back to channelA,
        // the New Messages line should appear above the last post (post3)
        cy.get(`#sidebarItem_${channelA.name}`).click();
        verifyPostNextToNewMessageSeparator('post3');
    });

    it('MM-T257 Mark as Unread when bringing window into focus', () => {
        // * Verify channels are unread
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);
        cy.get(`#sidebarItem_${channelB.name}`).should(beUnread);

        // # Navigate to integration screen (away from chat/main screen)
        cy.visit(`/${team1.name}/integrations/`);

        // # Navigate back to chat/main screen
        cy.visit(`/${team1.name}/channels/town-square`);

        // * Verify channels are unread
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);
        cy.get(`#sidebarItem_${channelB.name}`).should(beUnread);

        switchToChannel(channelA);
        switchToChannel(channelB);

        // * Verify channel are read
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);
        cy.get(`#sidebarItem_${channelB.name}`).should(beRead);
    });

    it('New messages line should remain after switching back to channel', () => {
        switchToChannel(channelA);

        // Starts not visible
        cy.get('.NotificationSeparator').should('not.exist');

        markAsUnreadFromPost(post2);

        // Then becomes visible
        cy.get('.NotificationSeparator').should('exist');

        switchToChannel(channelB);
        switchToChannel(channelA);

        // Then stays visible when switching back to channel
        cy.get('.NotificationSeparator').should('exist');

        switchToChannel(channelB);
        switchToChannel(channelA);

        // Then finally disappears when switching back a second time
        cy.get('.NotificationSeparator').should('not.exist');
    });

    it('MM-T260 Mark as Unread New Messages line extra space moves with it', () => {
        switchToChannel(channelA);

        markAsUnreadFromPost(post2);

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post2');

        // Top separator space should appear above the selected post
        verifyTopSpaceForNewMessage('post2');

        // Bottom separator space should appear below the post
        verifyBottomSpaceForNewMessage('post1');

        markAsUnreadFromPost(post1);

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post1');

        // Top separator space should appear above the selected post
        verifyTopSpaceForNewMessage('post1');

        // Bottom separator space should appear below the post by user
        verifyBottomSpaceForNewMessage('System');

        markAsUnreadFromPost(post3);

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post3');

        // Top separator space should appear above the selected post
        verifyTopSpaceForNewMessage('post3');

        // Bottom separator space should appear below the post
        verifyBottomSpaceForNewMessage('post2');
    });

    it('Should be able to mark channel as unread by alt-clicking on RHS', () => {
        switchToChannel(channelA);

        // Show the RHS
        cy.get(`#CENTER_commentIcon_${post3.id}`).click({force: true});

        markAsUnreadFromPost(post1, true);

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post1');

        markAsUnreadFromPost(post3, true);

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post3');
    });

    it('Should show cursor pointer when holding down alt', () => {
        const componentIds = [
            `#post_${post1.id}`,
            `#post_${post2.id}`,
            `#post_${post3.id}`,
            `#rhsPost_${post1.id}`,
            `#rhsPost_${post3.id}`,
        ];

        switchToChannel(channelA);

        // Show the RHS
        cy.get(`#CENTER_commentIcon_${post3.id}`).click({force: true});

        // Pretend that we start hovering over each and then hold alt afterwards
        for (const componentId of componentIds) {
            // * Verify that we don't show the pointer on mouseover
            cy.get(componentId).trigger('mouseover').should(notShowCursor);

            // * Verify that we show the pointer after pressing alt
            cy.get(componentId).trigger('keydown', {altKey: true}).should(showCursor);

            // * Verify that we stop showing the pointer after releasing alt
            cy.get(componentId).trigger('keydown', {altKey: false}).should(notShowCursor);

            // # Move the mouse away from the post
            cy.get(componentId).trigger('mouseout');
        }

        // Pretend that we hold down alt and then hover over each post
        for (const componentId of componentIds) {
            // * Verify that we don't show the pointer on mouseover
            cy.get(componentId).trigger('mouseover', {altKey: true}).should(showCursor);

            // # Move the mouse away from the post
            cy.get(componentId).trigger('mouseout', {altKey: true}).should(notShowCursor);
        }
    });

    it('Marking a channel as unread from another session while viewing channel', () => {
        switchToChannel(channelA);

        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);

        markAsUnreadFromAnotherSession(post2, testUser);

        // The channel should now be unread
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post2');

        switchToChannel(channelB);

        // Then stays unread when switching away
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        switchToChannel(channelA);

        // And becomes read when switching back
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post2');
    });

    it('Marking a channel as unread from another session while viewing another channel', () => {
        switchToChannel(channelA);
        switchToChannel(channelB);

        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);

        markAsUnreadFromAnotherSession(post2, testUser);

        // The channel should now be unread
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        switchToChannel(channelA);

        // And becomes read when switching back
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post2');
    });

    it('MM-T244 Webapp: Post menu item `Mark as Unread` appearance', () => {
        switchToChannel(channelA);
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);
        postMessage(post1.message);
        cy.getLastPostId().then((postId) => {
            cy.clickPostDotMenu(postId);
            cy.get('ul.Menu__content.dropdown-menu').
                as('menuOptions').
                should('be.visible').
                scrollIntoView();

            // # Post menu item `Mark as Unread` should be visible
            cy.get('@menuOptions').
                find('[aria-label="Mark as Unread"]').
                as('markAsReadElement').
                should('be.visible');

            // # Shrink the window and verify post menu options in the mobile view
            cy.viewport('iphone-5');
            cy.get('@markAsReadElement').should('be.visible');

            // * Verify there are no extra divider lines at the bottom of the menu for the non-admin user
            cy.findByText('Edit').should('not.exist');
            cy.findByText('Delete').should('not.exist');

            // * Verify there are extra divider lines at the bottom
            cy.get('ul.Menu__content').find('li.MenuItem').each(($listElement) => {
                cy.wrap($listElement).find('button').then(($buttonElement) => {
                    cy.wrap($buttonElement).invoke('attr', 'aria-label').then((ariaLabel) => {
                        if (ariaLabel !== 'Copy Text') {
                            cy.wrap($buttonElement).should('have.css', 'border-color', 'rgba(63, 67, 80, 0.12)');
                        }
                    });
                });
            });
        });
    });

    it('Should be able to mark channel as unread from post menu', () => {
        switchToChannel(channelA);

        // # Mark post2 as unread
        cy.uiClickPostDropdownMenu(post2.id, 'Mark as Unread');

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post2');

        // # Mark post1 as unread
        cy.uiClickPostDropdownMenu(post1.id, 'Mark as Unread');

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post1');

        // # Mark post3 as unread
        cy.uiClickPostDropdownMenu(post3.id, 'Mark as Unread');

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post3');
    });

    it('Should be able to mark channel as unread from RHS post menu', () => {
        switchToChannel(channelA);

        // Show the RHS
        cy.get(`#CENTER_commentIcon_${post3.id}`).click({force: true});

        // # Mark post1 as unread in RHS as root thread
        cy.uiClickPostDropdownMenu(post1.id, 'Mark as Unread', 'RHS_ROOT');

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post1');

        // # Mark post3 as unread in RHS as comment
        cy.uiClickPostDropdownMenu(post3.id, 'Mark as Unread', 'RHS_COMMENT');

        // The New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post3');
    });

    it('MM-T250 Mark as unread in the RHS', () => {
        switchToChannel(channelA);

        // # Open RHS (reply thread)
        cy.clickPostCommentIcon(post1.id);

        // # Mark the post as unread from RHS
        cy.uiClickPostDropdownMenu(post1.id, 'Mark as Unread', 'RHS_ROOT');

        // * Verify the New Messages line should appear above the selected post
        verifyPostNextToNewMessageSeparator('post1');

        // * Verify the channelA has unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        // * Verify the RHS does not have the NotificationSeparator line
        cy.get('#rhsContainer').find('.NotificationSeparator').should('not.exist');

        // # Switch to channelB
        switchToChannel(channelB);

        // # Switch to channelA
        switchToChannel(channelA);

        // * Verify the channelA does not have unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);

        // * Hover on the post with holding alt should show cursor
        cy.get(`#post_${post2.id}`).trigger('mouseover').type('{alt}', {release: false}).should(showCursor);

        // # Mouse click on the post holding alt
        cy.get(`#post_${post2.id}`).type('{alt}', {release: false}).click();

        // * Verify the post is marked as unread
        verifyPostNextToNewMessageSeparator('post2');

        // * Verify the channelA has unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beUnread);

        // * Verify the RHS does not have the NotificationSeparator line
        cy.get('#rhsContainer').find('.NotificationSeparator').should('not.exist');

        // # Switch to channelB
        switchToChannel(channelB);

        // # Switch to channelA
        switchToChannel(channelA);

        // * Verify the channelA does not have unread in LHS
        cy.get(`#sidebarItem_${channelA.name}`).should(beRead);
    });
});

function markAsUnreadFromPost(post, rhs = false) {
    const prefix = rhs ? 'rhsPost' : 'post';

    cy.get('body').type('{alt}', {release: false});
    cy.get(`#${prefix}_${post.id}`).click({force: true});
    cy.get('body').type('{alt}', {release: true});
}

function markAsUnreadFromAnotherSession(post, user) {
    cy.externalRequest({
        user,
        method: 'post',
        path: `users/${user.id}/posts/${post.id}/set_unread`,
    });
}
