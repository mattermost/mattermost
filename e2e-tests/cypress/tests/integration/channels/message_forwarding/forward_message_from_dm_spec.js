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

describe('Forward Message', () => {
    let user1;
    let user2;
    let testTeam;
    let dmChannel;
    let testPost;
    let replyPost;

    const message = 'Forward this message';
    const replyMessage = 'Forward this reply';
    const commentMessage = 'Comment for the forwarded message';

    before(() => {
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
            // # Create new DM channel
            return cy.apiCreateDirectChannel([user1.id, user2.id]);
        }).then(({channel}) => {
            dmChannel = channel;

            // # Post a sample message
            return cy.postMessageAs({sender: user1, message, channelId: dmChannel.id});
        }).then((post) => {
            testPost = post.data;

            // # Post a reply
            return cy.postMessageAs({sender: user1, message: replyMessage, channelId: dmChannel.id, rootId: testPost.id});
        }).then((post) => {
            replyPost = post.data;

            // # Got to Test channel
            cy.visit(`/${testTeam.name}/channels/${dmChannel.name}`);
        });
    });

    afterEach(() => {
        // # Go to 1. public channel
        cy.visit(`/${testTeam.name}/channels/${dmChannel.name}`);
    });

    it('MM-T4936_1 Forward root post from DM', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').type('{shift}F');

        // # Forward Post
        forwardPostFromDM();

        // * Assert switch to DM channel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', dmChannel.display_name);

        // * Assert post has been forwarded
        verifyForwardedMessage({post: testPost});
    });

    it('MM-T4936_2 Forward reply post from DM', () => {
        // # Open the RHS with replies to the root post
        cy.uiClickPostDropdownMenu(testPost.id, 'Reply', 'CENTER');

        // * Assert RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Click on ... button of reply post
        cy.clickPostDotMenu(replyPost.id, 'RHS_COMMENT');

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').type('{shift}F');

        // # Forward Post
        forwardPostFromDM({comment: commentMessage});

        // * Assert switch to DM channel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', dmChannel.display_name);

        // * Assert post has been forwarded
        verifyForwardedMessage({post: replyPost, comment: commentMessage});
    });

    it('MM-T4936_3 Forward post from DM - Cancel using escape key', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').type('{shift}F');

        // # Forward Post
        forwardPostFromDM({cancel: true});

        // * Assert still in the DM channel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', dmChannel.display_name);

        // * Assert last post id is identical with testPost
        cy.getLastPostId((id) => {
            assert.isEqual(id, testPost.id);
        });
    });

    /**
     * Verify that the post has been forwarded
     *
     * @param {string?} comment
     * @param {boolean?} showMore
     * @param {Post} post
     */
    const verifyForwardedMessage = ({post, comment, showMore}) => {
        const permaLink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${post.id}`;

        // * Assert post has been forwarded
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

                // * Assert there is only one preview element rendered
                cy.get('.attachment.attachment--permalink').should('have.length', 1);

                // * Assert the text in the preview matches the original post message
                cy.get(`#postMessageText_${post.id}`).should('be.visible').should('contain.text', post.message);
            });

            // # Cleanup
            cy.apiDeletePost(id);
        });
    };

    /**
     * Forward Post with optional comment.
     * Has the possibility to also test for the post-error on long comments
     *
     * @param {object?} options
     * @param {string?} options.comment
     * @param {boolean?} options.cancel
     */
    const forwardPostFromDM = ({comment = '', cancel = false} = {}) => {
        // * Assert visibility of the forward post modal
        cy.get('#forward-post-modal').should('be.visible').within(() => {
            // * Assert channel select is not existent
            cy.get('.forward-post__select').should('not.exist');

            // * Assert if button is enabled
            cy.get('.btn-tertiary').should('not.be.disabled');

            // * Assert Notification is shown
            cy.findByTestId('notification_forward_post').should('be.visible').should('contain.text', `This message is from a private conversation and can only be shared with ${dmChannel.display_name}`);

            if (comment) {
                // # Enter comment
                cy.get('#forward_post_textbox').invoke('val', comment).trigger('change').type(' {backspace}');

                // * Assert if error message is not present
                cy.get('label.post-error').should('not.exist');
            }

            if (cancel) {
                // * Assert if button is active
                cy.get('.btn-tertiary').should('not.be.disabled').type('{esc}', {force: true});
            } else {
                // * Assert if button is active
                cy.get('.GenericModal__button.confirm').should('not.be.disabled').type('{enter}', {force: true});
            }
        });
    };
});
