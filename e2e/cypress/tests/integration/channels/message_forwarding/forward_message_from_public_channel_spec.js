// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

const DEFAULT_CHARACTER_LIMIT = 16383;

describe('Forward Message', () => {
    let user1;
    let user2;
    let user3;
    let testTeam;
    let testChannel;
    let otherChannel;
    let privateChannel;
    let dmChannel;
    let gmChannel;
    let testPost;
    let replyPost;

    const message = 'Forward this message';
    const replyMessage = 'Forward this reply';

    before(() => {
        // # Testing Forwarding from Insights view requires a license
        cy.apiRequireLicense();
        cy.shouldHaveFeatureFlag('InsightsEnabled', true);

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
            channel,
        }) => {
            user1 = user;
            testTeam = team;
            testChannel = channel;

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
            cy.apiAddUserToChannel(testChannel.id, user2.id);
            cy.apiAddUserToChannel(testChannel.id, user3.id);

            // # Post a sample message
            return cy.postMessageAs({sender: user1, message, channelId: testChannel.id});
        }).then((post) => {
            testPost = post.data;

            // # Post a reply
            return cy.postMessageAs({sender: user1, message: replyMessage, channelId: testChannel.id, rootId: testPost.id});
        }).then((post) => {
            replyPost = post.data;

            // # Create new DM channel
            return cy.apiCreateDirectChannel([user1.id, user2.id]);
        }).then(({channel}) => {
            dmChannel = channel;

            // # Create new DM channel
            return cy.apiCreateGroupChannel([user1.id, user2.id, user3.id]);
        }).then(({channel}) => {
            gmChannel = channel;

            // # Create a private channel to forward to
            return cy.apiCreateChannel(testTeam.id, 'private', 'Private');
        }).then(({channel}) => {
            privateChannel = channel;

            // # Create a second channel to forward to
            return cy.apiCreateChannel(testTeam.id, 'forward', 'Forward');
        }).then(({channel}) => {
            otherChannel = channel;

            // # Got to Test channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        });
    });

    afterEach(() => {
        // # Go to 1. public channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('MM-T4934_1 Forward root post from public channel to another public channel', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').click();

        // # Forward Post
        forwardPost({channelId: otherChannel.id});

        // * Assert switch to testchannel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', otherChannel.display_name);

        // * Assert post has been forwarded
        verifyForwardedMessage({post: testPost});
    });

    it('MM-T4934_2 Forward root post from public channel to another public channel, long comment', () => {
        const longMessage = 'M'.repeat(6000);

        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').click();

        // # Forward Post
        forwardPost({channelId: otherChannel.id, comment: longMessage, testLongComment: true});

        // * Assert switch to testchannel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', otherChannel.display_name);

        // * Assert post has been forwarded
        verifyForwardedMessage({post: testPost, comment: longMessage, showMore: true});
    });

    it('MM-T4934_3 Forward reply post from public channel to another public channel', () => {
        // # Open the RHS with replies to the root post
        cy.uiClickPostDropdownMenu(testPost.id, 'Reply', 'CENTER');

        // * Assert RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Click on ... button of reply post
        cy.clickPostDotMenu(replyPost.id, 'RHS_COMMENT');

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').click();

        // * Forward Post
        forwardPost({channelId: otherChannel.id});

        // * Assert switch to testchannel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', otherChannel.display_name);

        // * Assert post has been forwarded
        verifyForwardedMessage({post: replyPost});
    });

    it('MM-T4934_4 Forward public channel post from global threads', () => {
        // # Visit global threads
        cy.uiClickSidebarItem('threads');

        // # Open the RHS with replies to the root post
        cy.get('article.ThreadItem').should('have.lengthOf', 1).first().click();

        // # Click on ... button of reply post
        cy.clickPostDotMenu(replyPost.id, 'RHS_COMMENT');

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').click();

        // * Forward Post
        forwardPost({channelId: otherChannel.id});

        // * Assert switch to testchannel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', otherChannel.display_name);

        // * Assert post has been forwarded
        verifyForwardedMessage({post: replyPost});
    });

    it('MM-T4934_5 Forward public channel post while viewing Insights', () => {
        // # Open the RHS with replies to the root post
        cy.uiClickPostDropdownMenu(testPost.id, 'Reply', 'CENTER');

        // * Assert RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Visit global threads
        cy.uiClickSidebarItem('insights');

        // # Click on ... button of reply post
        cy.clickPostDotMenu(replyPost.id, 'RHS_COMMENT');

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').click();

        // * Forward Post
        forwardPost({channelId: privateChannel.id});

        // * Assert switch to testchannel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', privateChannel.display_name);

        // * Assert post has been forwarded
        verifyForwardedMessage({post: replyPost});
    });

    it('MM-T4934_6 Forward public channel post to Private channel', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').click();

        // # Forward Post
        forwardPost({channelId: privateChannel.id});

        // * Assert switch to testchannel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', privateChannel.display_name);

        // * Assert post has been forwarded
        verifyForwardedMessage({post: testPost});
    });

    it('MM-T4934_7 Forward public channel post to GM', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').click();

        // # Forward Post
        forwardPost({channelId: gmChannel.id});

        // * Assert switch to GM channel
        const displayName = gmChannel.display_name.split(', ').filter(((username) => username !== user1.username)).join(', ');
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', displayName);

        // * Assert post has been forwarded
        verifyForwardedMessage({post: testPost});
    });

    it('MM-T4934_8 Forward public channel post to DM', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Forward menu-item
        cy.findByText('Forward').click();

        // # Forward Post
        forwardPost({channelId: dmChannel.id});

        // * Assert switch to DM channel
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').should('contain', dmChannel.display_name);

        // * Assert post has been forwarded
        verifyForwardedMessage({post: testPost});
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
     * @param {string?} options
     * @param {string?} options.channelId
     * @param {string?} options.comment
     * @param {boolean?} options.testLongComment
     */
    const forwardPost = ({channelId, comment = '', testLongComment = false}) => {
        const permalink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${testPost.id}`;
        const maxPostSize = DEFAULT_CHARACTER_LIMIT - permalink.length - 1;
        const longMessage = 'M'.repeat(maxPostSize);
        const extraChars = 'X';

        // * Assert visibility of the forward post modal
        cy.get('#forward-post-modal').should('be.visible').within(() => {
            // * Assert if button is disabled
            cy.get('.GenericModal__button.confirm').should('be.disabled');

            // * Assert visibility of channel select
            cy.get('.forward-post__select').should('be.visible').click();

            // # Select the testchannel to forward it to
            cy.get(`#post-forward_channel-select_option_${channelId}`).scrollIntoView().click();

            // * Assert that the testchannel is selected
            cy.get(`#post-forward_channel-select_singleValue_${channelId}`).should('be.visible');

            if (testLongComment) {
                // # Enter long comment and add one char to make it too long
                cy.get('#forward_post_textbox').invoke('val', longMessage).trigger('change').type(extraChars, {delay: 500});

                // * Assert if error message is shown
                cy.get('label.post-error').scrollIntoView().should('be.visible').should('contain', `Your message is too long. Character count: ${longMessage.length + extraChars.length}/${maxPostSize}`);

                // * Assert if button is disabled
                cy.get('.GenericModal__button.confirm').should('be.disabled');

                // # Enter a valid comment
                cy.get('#forward_post_textbox').invoke('val', longMessage).trigger('change').type(' {backspace}');

                // * Assert if error message is removed
                cy.get('label.post-error').should('not.exist');
            }

            if (comment) {
                // # Enter comment
                cy.get('#forward_post_textbox').invoke('val', comment).trigger('change').type(' {backspace}');

                // * Assert if error message is not present
                cy.get('label.post-error').should('not.exist');
            }

            // * Assert if button is active
            cy.get('.GenericModal__button.confirm').should('not.be.disabled').click();
        });
    };
});
