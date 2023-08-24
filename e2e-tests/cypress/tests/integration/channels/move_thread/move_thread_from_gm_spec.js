// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Move thread', () => {
    let user1;
    let user2;
    let user3;
    let testTeam;
    let gmChannel;
    let gmChannelName;
    let testPost;
    let replyPost;

    const message = 'Move this message';
    const replyMessage = 'Move this reply';

    beforeEach(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_on',
            },
        });

        // # Login as new user, create new team and visit its URL
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({
            user,
            team,
        }) => {
            user1 = user;
            testTeam = team;

            // # enable CRT for the user
            cy.apiSaveCRTPreference(user.id, 'on');

            // # Create another user
            return cy.apiCreateUser({prefix: 'second_'});
        }).then(({user}) => {
            user2 = user;

            // # Add other user to team
            return cy.apiAddUserToTeam(testTeam.id, user2.id);
        }).then(() => {
            // # Create another user
            return cy.apiCreateUser({prefix: 'third_'});
        }).then(({user}) => {
            user3 = user;

            // # Add other user to team
            return cy.apiAddUserToTeam(testTeam.id, user3.id);
        }).then(() => {
            // # Create new GM channel
            return cy.apiCreateGroupChannel([user1.id, user2.id, user3.id]);
        }).then(({channel}) => {
            gmChannel = channel;
            gmChannelName = gmChannel.display_name.split(', ').filter(((username) => username !== user1.username)).join(', ');

            // # Post a sample message
            return cy.postMessageAs({sender: user1, message, channelId: gmChannel.id});
        }).then((post) => {
            testPost = post.data;

            // # Post a reply
            return cy.postMessageAs({sender: user1, message: replyMessage, channelId: gmChannel.id, rootId: testPost.id});
        }).then((post) => {
            replyPost = post.data;

            // # Got to Test channel
            cy.visit(`/${testTeam.name}/channels/${gmChannel.name}`);
        });
    });

    afterEach(() => {
        // # Go to 1. public channel
        cy.visit(`/${testTeam.name}/channels/${gmChannel.name}`);
    });

    it('Move post from GM (with at least 2 other users)', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Move menu-item
        cy.findByText('Move Thread').type('{shift}W');

        // # Move Post
        moveThreadFromGM();

        // * Assert switch to GM channel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', gmChannelName);

        // * Assert post has been moved
        verifyMovedMessage({post: testPost});
    });

    it('Move thread with replies from GM (with at least 2 other users)', () => {
        // # Open the RHS with replies to the root post
        cy.uiClickPostDropdownMenu(testPost.id, 'Reply', 'CENTER');

        // * Assert RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Click on ... button of reply post
        cy.clickPostDotMenu(replyPost.id, 'RHS_COMMENT');

        // * Assert availability of the Move menu-item
        cy.findByText('Move Thread').type('{shift}W');

        // # Move Post
        moveThreadFromGM();

        // * Assert switch to GM channel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', gmChannelName);

        // * Assert post has been moved
        verifyMovedMessage({post: testPost});
    });

    it('Move thread from GM (with at least 2 other users) - Cancel using X', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Move menu-item
        cy.findByText('Move Thread').type('{shift}W');

        // # Move Post
        moveThreadFromGM({cancel: true});

        // * Assert switch to GM channel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', gmChannelName);

        // * Assert last post id is identical with testPost
        cy.getLastPostId((id) => {
            assert.isEqual(id, testPost.id);
        });
    });

    /**
     * Verify that the post has been moved
     *
     * @param {string?} comment
     * @param {boolean?} showMore
     * @param {Post} post
     */
    const verifyMovedMessage = ({post, comment, showMore}) => {
        const permaLink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${post.id}`;

        // * Assert post has been moved
        cy.getLastPostId().then((id) => {
            // * Assert last post is visible
            cy.get(`#${id}_message`).should('be.visible').within(() => {
                if (comment) {
                    // * Assert the text in the post body is the permalink only
                    cy.get(`#postMessageText_${id}`).should('be.visible').should('contain.text', permaLink).should('contain.text', comment);

                    if (showMore) {
                        // * Assert show more button is rendered and works as expected
                        cy.get('#showMoreButton').should('be.visible').should('contain.text', 'Show more').click().should('contain.text', 'Show less').click();
                    }
                }

                // * Assert the text in the preview matches the original post message
                cy.get(`#postMessageText_${post.id}`).should('be.visible').should('contain.text', post.message);
            });

            // # Cleanup
            cy.apiDeletePost(id);
        });
    };

    /**
     * Move thread
     *
     * @param {object?} options
     * @param {boolean?} options.cancel
     */
    const moveThreadFromGM = ({cancel = false} = {}) => {
        const participants = gmChannel.display_name.split(', ').slice(1).join(' and ');

        // * Assert visibility of the move thread modal
        cy.get('#move-thread-modal').should('be.visible').within(() => {
            // * Assert channel select is not existent
            cy.get('.move-thread__select').should('not.exist');

            // * Assert if button is enabled
            cy.get('.GenericModal__button.confirm').should('not.be.disabled');

            // * Assert Notification is shown
            cy.findByTestId('notification-text').should('be.visible').should('contain.text', `Moving this thread changes who has access`);

            if (cancel) {
                // * Assert if button is active
                cy.uiCloseModal('Move thread');
            } else {
                // * Assert if button is active
                cy.get('.GenericModal__button.confirm').should('not.be.disabled').type('{enter}', {force: true});
            }
        });
    };
});
