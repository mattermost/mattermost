// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @messaging

describe('Move Thread', () => {
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

            // # Create a private channel to Move Thread to
            return cy.apiCreateChannel(testTeam.id, 'private', 'Private');
        }).then(({channel}) => {
            privateChannel = channel;

            // # Create a second channel to Move Thread to
            return cy.apiCreateChannel(testTeam.id, 'Move Thread', 'Move Thread');
        }).then(({channel}) => {
            otherChannel = channel;

            // # Got to Test channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        });
    });

    it('Move root post from public channel to another public channel', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Move Thread menu-item
        cy.findByText('Move Thread').click();

        // # Move Thread
        moveThread({channelId: otherChannel.id});

        // * Assert post has been moved
        verifyMovedMessage({post: testPost});
    });

    it('Move reply post from public channel to another public channel', () => {
        // # Open the RHS with replies to the root post
        cy.uiClickPostDropdownMenu(testPost.id, 'Reply', 'CENTER');

        // * Assert RHS is open
        cy.get('#rhsContainer').should('be.visible');

        // # Click on ... button of reply post
        cy.clickPostDotMenu(replyPost.id, 'RHS_COMMENT');

        // * Assert availability of the Move Thread menu-item
        cy.findByText('Move Thread').click();

        // * Move Thread
        moveThread({channelId: otherChannel.id});

        // * Assert post has been moved
        verifyMovedMessage({post: testPost});
    });

    it('Move public channel post to Private channel', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Move Thread menu-item
        cy.findByText('Move Thread').click();

        // # Move Thread
        moveThread({channelId: privateChannel.id});

        // * Assert post has been moved
        verifyMovedMessage({post: testPost});
    });

    it('Move public channel post to GM', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Move Thread menu-item
        cy.findByText('Move Thread').click();

        // # Move Thread
        moveThread({channelId: gmChannel.id});

        // * Assert post has been moved
        verifyMovedMessage({post: testPost});
    });

    it('Move public channel post to DM', () => {
        // # Check if ... button is visible in last post right side
        cy.get(`#CENTER_button_${testPost.id}`).should('not.be.visible');

        // # Click on ... button of last post
        cy.clickPostDotMenu(testPost.id);

        // * Assert availability of the Move Thread menu-item
        cy.findByText('Move Thread').click();

        // # Move Thread
        moveThread({channelId: dmChannel.id});

        // * Assert post has been moved
        verifyMovedMessage({post: testPost});
    });

    /**
     * Verify that the post has been moved
     *
     * @param {Post} post
     */
    const verifyMovedMessage = ({post}) => {
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
     * Move Thread with optional comment.
     *
     */
    const moveThread = () => {
        // * Assert visibility of the Move Thread modal
        cy.get('#move-thread-modal').should('be.visible').within(() => {
            // * Assert channel select is not existent
            cy.get('.move-thread__select').should('not.exist');

            // * Assert if button is enabled
            cy.get('.GenericModal__button.confirm').should('not.be.disabled');

            // * Assert Notification is shown
            cy.findByTestId('notification-text').should('be.visible').should('contain.text', `Moving this thread changes who has access`);
        });
    };
});
