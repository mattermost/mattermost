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

    const emoji = 'slightly_frowning_face';
    const otherEmoji = 'sweat_smile';

    beforeEach(() => {
        cy.apiAdminLogin().apiInitSetup().then(({team, user}) => {
            testTeam = team;
            userOne = user;

            cy.apiCreateUser().then((data) => {
                userTwo = data.user;

                cy.apiAddUserToTeam(testTeam.id, userTwo.id);

                // # Login as userOne, visit Off-Topic and post a message
                cy.apiLogin(userOne);
                cy.visit(`/${testTeam.name}/channels/off-topic`);
                cy.postMessage('hello');
            });
        });
    });

    it('adding a reaction to a post is visible to another user in the channel', () => {
        // # Mouseover the last post
        cy.getLastPost().trigger('mouseover');

        cy.getLastPostId().then((postId) => {
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Choose "slightly_frowning_face" emoji
            cy.clickEmojiInEmojiPicker(emoji);

            // * The number shown on the reaction is incremented by 1
            cy.get(`#postReaction-${postId}-${emoji} .Reaction__number--display`).
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
            cy.get(`#postReaction-${postId}-${emoji} .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');
        });
    });

    it('another user adding to existing reaction increases reaction count', () => {
        // # Mouseover the last post
        cy.getLastPost().trigger('mouseover');

        cy.getLastPostId().then((postId) => {
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Choose "slightly_frowning_face" emoji
            cy.clickEmojiInEmojiPicker(emoji);

            // * The number shown on the reaction is incremented by 1
            cy.get(`#postReaction-${postId}-${emoji} .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');
        });

        // # Logout then login as userTwo and off-topic
        cy.apiLogout().apiLogin(userTwo);
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        cy.getLastPostId().then((postId) => {
            // # Click on the "slightly_frowning_face" emoji
            cy.get(`#postReaction-${postId}-${emoji}`).click();

            // * The number shown on the "slightly_frowning_face" reaction is incremented by 1
            cy.get(`#postReaction-${postId}-${emoji} .Reaction__number--display`).
                should('have.text', '2').
                should('be.visible');
        });
    });

    it('a reaction added by current user has highlighted background color', () => {
        // # Mouseover the last post
        cy.getLastPost().trigger('mouseover');

        cy.getLastPostId().then((postId) => {
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Choose "slightly_frowning_face" emoji
            cy.clickEmojiInEmojiPicker(emoji);

            // * The number shown on the reaction is incremented by 1
            cy.get(`#postReaction-${postId}-${emoji} .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');

            // # The "slightly_frowning_face" emoji of the last post and the background color changes
            cy.get(`#postReaction-${postId}-${emoji}`).
                should('be.visible').
                should('have.css', 'background-color').
                and('eq', 'rgba(28, 88, 217, 0.08)');
        });
    });

    it("can click another user's reaction to detract from it", () => {
        // # Mouseover the last post
        cy.getLastPost().trigger('mouseover');

        cy.getLastPostId().then((postId) => {
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Choose "slightly_frowning_face" emoji
            cy.clickEmojiInEmojiPicker(emoji);

            // * The number shown on the reaction is incremented by 1
            cy.get(`#postReaction-${postId}-${emoji} .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');
        });

        // # Logout then login as userTwo and off-topic
        cy.apiLogout().apiLogin(userTwo);
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        cy.getLastPostId().then((postId) => {
            // # Click on the "slightly_frowning_face" emoji
            cy.get(`#postReaction-${postId}-${emoji}`).click();

            // * The number shown on the "slightly_frowning_face" reaction is incremented by 1
            cy.get(`#postReaction-${postId}-${emoji} .Reaction__number--display`).
                should('have.text', '2').
                should('be.visible');
        });

        // # Logout then login as userOne and off-topic
        cy.apiLogout().apiLogin(userOne);
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        cy.getLastPostId().then((postId) => {
            // # Click on the "slightly_frowning_face" emoji
            cy.get(`#postReaction-${postId}-${emoji}`).click();

            // * The number shown on the "slightly_frowning_face" reaction  is decremented by 1
            cy.get(`#postReaction-${postId}-${emoji} .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');
        });
    });

    it('can add a reaction to a post with an existing reaction', () => {
        // # Mouseover the last post
        cy.getLastPost().trigger('mouseover');

        cy.getLastPostId().then((postId) => {
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Choose "slightly_frowning_face" emoji
            cy.clickEmojiInEmojiPicker(emoji);

            // * The number shown on the reaction is incremented by 1
            cy.get(`#postReaction-${postId}-${emoji} .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');
        });

        // # Logout then login as userTwo and off-topic
        cy.apiLogout().apiLogin(userTwo);
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        cy.getLastPostId().then((postId) => {
            // # Click on the + icon
            cy.get(`#addReaction-${postId}`).click({force: true});

            // * The reaction emoji picker is open
            cy.get('#emojiPicker').should('be.visible');

            // # Select the "sweat_smile" emoji
            cy.clickEmojiInEmojiPicker(otherEmoji);

            // * The emoji picker is no longer open
            cy.get('#emojiPicker').should('not.exist');

            // * The "sweat_smile" emoji is added to the post
            cy.get(`#postReaction-${postId}-${otherEmoji}`).should('be.visible');
        });
    });

    it('can remove a reaction to a post with an existing reaction', () => {
        // # Mouseover the last post
        cy.getLastPost().trigger('mouseover');

        cy.getLastPostId().then((postId) => {
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Choose "slightly_frowning_face" emoji
            cy.clickEmojiInEmojiPicker(emoji);

            // * The number shown on the reaction is incremented by 1
            cy.get(`#postReaction-${postId}-${emoji} .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');

            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Choose "sweat_smile" emoji
            cy.clickEmojiInEmojiPicker(otherEmoji);

            // * The number shown on the reaction is incremented by 1
            cy.get(`#postReaction-${postId}-${otherEmoji} .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');
        });

        cy.getLastPostId().then((postId) => {
            // * The "sweat_smile" should exist on the post
            cy.get(`#postReaction-${postId}-${otherEmoji}`).should('be.visible');

            // # Click on the "sweat_smile" emoji
            cy.get(`#postReaction-${postId}-${otherEmoji}`).click();

            // * The "sweat_smile" emoji is removed
            cy.get(`#postReaction-${postId}-${otherEmoji}`).should('not.exist');
        });
    });
});
