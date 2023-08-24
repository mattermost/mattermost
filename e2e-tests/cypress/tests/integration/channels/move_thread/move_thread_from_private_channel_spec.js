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
    let testTeam;
    let privateChannel;
    let testPost;
    let replyPost;

    const message = 'Move this message';
    const replyMessage = 'Move this reply';

    beforeEach(() => {
        cy.apiRequireLicense();

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

            // # Create a private channel
            return cy.apiCreateChannel(testTeam.id, 'private', 'Private', 'P');
        }).then(({channel}) => {
            privateChannel = channel;

            // # Post a sample message
            return cy.postMessageAs({sender: user1, message, channelId: privateChannel.id});
        }).then((post) => {
            testPost = post.data;

            // # Post a reply
            return cy.postMessageAs({sender: user1, message: replyMessage, channelId: privateChannel.id, rootId: testPost.id});
        }).then((post) => {
            replyPost = post.data;

            // # Got to Private channel
            cy.visit(`/${testTeam.name}/channels/${privateChannel.name}`);
        });
    });

    it('Move root post from private channel', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Move Thread menu-item
        cy.findByText('Move Thread').type('{shift}W');

        // # Move Thread
        moveThreadFromPrivateChannel();

        // * Assert switch to testchannel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', privateChannel.display_name);

        // * Assert post has been moved
        verifyMovedMessage({post: testPost});
    });

    it('Move thread with replies from private channel', () => {
        // # Open the RHS with replies to the root post
        cy.uiClickPostDropdownMenu(testPost.id, 'Reply', 'CENTER');

        // * Assert RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Click on ... button of reply post
        cy.clickPostDotMenu(replyPost.id, 'RHS_COMMENT');

        // * Assert availability of the Move Thread menu-item
        cy.findByText('Move Thread').type('{shift}W');

        // # Move Thread
        moveThreadFromPrivateChannel();

        // * Assert switch to testchannel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', privateChannel.display_name);

        // * Assert post has been moved
        verifyMovedMessage({post: testPost});
    });

    it('Move post from private channel - Cancel', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Move Thread menu-item
        cy.findByText('Move Thread').type('{shift}W');

        // # Move Thread
        moveThreadFromPrivateChannel(true);

        // * Assert switch to testchannel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', privateChannel.display_name);

        // * Assert last post id is identical with testPost
        cy.getLastPostId((id) => {
            assert.isEqual(id, testPost.id);
        });
    });

    /**
     * Verify that the post has been moved
     *
     * @param {Post} post
     */
    const verifyMovedMessage = ({post, comment, showMore}) => {
        const permaLink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${post.id}`;

        // * Assert post has been moved
        cy.getLastPostId().then((id) => {
            // * Assert last post is visible
            cy.get(`#${id}_message`).should('be.visible').within(() => {
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
     * @param {boolean?} cancel
     */
    const moveThreadFromPrivateChannel = (cancel = false) => {
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
                cy.get('.GenericModal__button.cancel').should('not.be.disabled').click();
            } else {
                // * Assert if button is active
                cy.get('.GenericModal__button.confirm').should('not.be.disabled').click();
            }
        });
    };
});
