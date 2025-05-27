// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @messaging

describe('Emoji reactions to posts/messages', () => {
    let userOne;
    let userTwo;
    let testTeam;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            userOne = user;

            cy.apiCreateUser().then((data) => {
                userTwo = data.user;

                cy.apiAddUserToTeam(testTeam.id, userTwo.id);

                // # Login as userOne and Off-Topic
                cy.apiLogin(userOne);
                cy.visit(`/${testTeam.name}/channels/off-topic`);
            });
        });
    });

    it('adding a reaction to a post is visible to another user in the channel', () => {
        // # Post a message
        cy.postMessage('The reaction to this post should be visible to user-2');

        // # Mouseover the last post
        cy.getLastPost().trigger('mouseover');

        cy.getLastPostId().then((postId) => {
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Choose "slightly_frowning_face" emoji
            cy.clickEmojiInEmojiPicker('slightly_frowning_face');

            // * The number shown on the reaction is incremented by 1
            cy.get(`#postReaction-${postId}-slightly_frowning_face .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');
        });

        // # Logout
        cy.apiLogout();

        // # Login as userTwo and off-topic
        cy.apiLogin(userTwo);
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        cy.getLastPostId().then((postId) => {
            // * userOne's reaction "slightly_frowning_face" is visible and is equal to 1
            cy.get(`#postReaction-${postId}-slightly_frowning_face .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');
        });
    });

    it.skip('another user adding to existing reaction increases reaction count', () => {
        cy.getLastPostId().then((postId) => {
            // # Click on the "slightly_frowning_face" emoji
            cy.get(`#postReaction-${postId}-slightly_frowning_face`).click();

            // * The number shown on the "slightly_frowning_face" reaction is incremented by 1
            cy.get(`#postReaction-${postId}-slightly_frowning_face .Reaction__number--display`).
                should('have.text', '2').
                should('be.visible');
        });
    });

    it.skip('a reaction added by current user has highlighted background color', () => {
        cy.getLastPostId().then((postId) => {
            // # The "slightly_frowning_face" emoji of the last post and the background color changes
            cy.get(`#postReaction-${postId}-slightly_frowning_face`).
                should('be.visible').
                should('have.css', 'background-color').
                and('eq', 'rgba(28, 88, 217, 0.08)');
        });
    });

    it.skip("can click another user's reaction to detract from it", () => {
        cy.getLastPostId().then((postId) => {
            // * The number shown on the "slightly_frowning_face" reaction is currently at 2
            cy.get(`#postReaction-${postId}-slightly_frowning_face .Reaction__number--display`).
                should('have.text', '2').
                should('be.visible');

            // # Click on the "slightly_frowning_face" emoji
            cy.get(`#postReaction-${postId}-slightly_frowning_face`).click();

            // * The number shown on the "slightly_frowning_face" reaction  is decremented by 1
            cy.get(`#postReaction-${postId}-slightly_frowning_face .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');
        });
    });

    it.skip('can add a reaction to a post with an existing reaction', () => {
        cy.getLastPostId().then((postId) => {
            // # Click on the + icon
            cy.get(`#addReaction-${postId}`).click({force: true});

            // * The reaction emoji picker is open
            cy.get('#emojiPicker').should('be.visible');

            // # Select the "sweat_smile" emoji
            cy.clickEmojiInEmojiPicker('sweat_smile');

            // * The emoji picker is no longer open
            cy.get('#emojiPicker').should('not.exist');

            // * The "sweat_smile" emoji is added to the post
            cy.get(`#postReaction-${postId}-sweat_smile`).should('be.visible');
        });
    });

    it.skip('can remove a reaction to a post with an existing reaction', () => {
        cy.getLastPostId().then((postId) => {
            // * The "sweat_smile" should exist on the post
            cy.get(`#postReaction-${postId}-sweat_smile`).should('be.visible');

            // # Click on the "sweat_smile" emoji
            cy.get(`#postReaction-${postId}-sweat_smile`).click();

            // * The "sweat_smile" emoji is removed
            cy.get(`#postReaction-${postId}-sweat_smile`).should('not.exist');
        });
    });
});
