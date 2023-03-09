// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @emoji

import * as TIMEOUTS from '../../fixtures/timeouts';
import * as MESSAGES from '../../fixtures/messages';
import {doReactToLastMessageShortcut, checkReactionFromPost} from '../keyboard_shortcuts/ctrl_cmd_shift_slash/helpers';

import {getCustomEmoji} from './helpers';

describe('Custom emojis', () => {
    let testTeam;
    let testUser;
    let otherUser;
    let townsquareLink;

    const builtinEmoji = 'taco';
    const builtinEmojiWithColons = ':taco:';
    const builtinEmojiUppercaseWithColons = ':TAco:';
    const largeEmojiFile = 'gif-image-file.gif';

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableCustomEmoji: true,
            },
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();

        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
            townsquareLink = `/${team.name}/channels/town-square`;
        });

        cy.apiCreateUser().then(({user: user1}) => {
            otherUser = user1;
            cy.apiAddUserToTeam(testTeam.id, otherUser.id);
        }).then(() => {
            cy.apiLogin(testUser);
            cy.visit(townsquareLink);
        });
    });

    it('MM-T2186 Emoji picker - default and custom emoji reaction, case-insensitive', () => {
        const {customEmoji, customEmojiWithColons} = getCustomEmoji();

        const messageText = 'test message';

        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Click on add new emoji
        cy.findByText('Add Custom Emoji').should('be.visible').click();

        // # Type emoji name
        cy.get('#name').type(customEmojiWithColons);

        // # Select emoji image
        cy.get('input#select-emoji').attachFile(largeEmojiFile).wait(TIMEOUTS.THREE_SEC);

        // # Click on Save
        cy.uiSave().wait(TIMEOUTS.THREE_SEC);

        // # Go back to home channel
        cy.visit(townsquareLink);

        // # Post a message
        cy.postMessage(messageText);

        // # Post the built-in emoji
        cy.uiGetPostTextBox().type('+' + builtinEmojiWithColons).wait(TIMEOUTS.HALF_SEC).type('{enter}').type('{enter}');

        cy.getLastPostId().then((postId) => {
            const postText = `#postMessageText_${postId}`;
            cy.get(postText).should('have.text', messageText);

            cy.clickPostReactionIcon(postId);

            // # Search emoji name text in emoji searching input
            cy.findByPlaceholderText('Search emojis').should('be.visible').type(builtinEmojiUppercaseWithColons, {delay: TIMEOUTS.ONE_SEC}).wait(TIMEOUTS.ONE_SEC);

            // * Get list of emojis based on the search text
            cy.findAllByTestId('emojiItem').children().should('have.length', 1);

            // # Select the builtin emoji
            cy.clickEmojiInEmojiPicker(builtinEmoji);

            // # Search for the custom emoji
            cy.clickPostReactionIcon(postId);

            // # Search first three letters of the emoji name text in emoji searching input
            cy.findByPlaceholderText('Search emojis').should('be.visible').type(customEmoji.substring(0, 10), {delay: TIMEOUTS.HALF_SEC});

            // * Get list of emojis based on the search text
            cy.findAllByTestId('emojiItem').children().should('have.length', 1);
            cy.findAllByTestId('emojiItem').children('img').first().should('have.class', 'emoji-category--custom');

            // * Select the custom emoji
            cy.findAllByTestId('emojiItem').children().click();
        });

        cy.getLastPostId().then((postId) => {
            cy.get(`#postReaction-${postId}-` + builtinEmoji).should('be.visible');
            cy.get(`#postReaction-${postId}-` + customEmoji).should('be.visible');
        });

        cy.reload();

        cy.getLastPostId().then((postId) => {
            cy.get(`#postReaction-${postId}-` + builtinEmoji).should('be.visible');
            cy.get(`#postReaction-${postId}-` + customEmoji).should('be.visible');
        });
    });

    it('MM-T2187 Custom emoji reaction', () => {
        const {customEmoji, customEmojiWithColons} = getCustomEmoji();

        const messageText = 'test message';

        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Click on add new emoji
        cy.findByText('Add Custom Emoji').should('be.visible').click();

        // # Type emoji name
        cy.get('#name').type(customEmojiWithColons);

        // # Select emoji image
        cy.get('input#select-emoji').attachFile(largeEmojiFile).wait(TIMEOUTS.THREE_SEC);

        // # Click on Save
        cy.uiSave().wait(TIMEOUTS.THREE_SEC);

        // # Go back to home channel
        cy.visit(townsquareLink);

        // # Post a message
        cy.postMessage(messageText);

        cy.getLastPostId().then((postId) => {
            cy.clickPostReactionIcon(postId);

            // # Search for the emoji name text in emoji searching input
            cy.findByPlaceholderText('Search emojis').should('be.visible').type(customEmoji, {delay: TIMEOUTS.HALF_SEC});

            // * Get list of emojis based on the search text
            cy.findAllByTestId('emojiItem').children().should('have.length', 1);
            cy.findAllByTestId('emojiItem').children('img').first().should('have.class', 'emoji-category--custom');

            // # Select the custom emoji
            cy.findAllByTestId('emojiItem').children().click();
        });
    });

    it('MM-T2188 Custom emoji - delete emoji after using in post', () => {
        const {customEmoji, customEmojiWithColons} = getCustomEmoji();

        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Click on add new emoji
        cy.findByText('Add Custom Emoji').should('be.visible').click();

        // # Type emoji name
        cy.get('#name').type(customEmojiWithColons);

        // # Select emoji image
        cy.get('input#select-emoji').attachFile(largeEmojiFile).wait(TIMEOUTS.THREE_SEC);

        // # Click on Save
        cy.uiSave().wait(TIMEOUTS.THREE_SEC);

        // # Go back to home channel
        cy.visit(townsquareLink);

        // # Post a message with the emoji
        cy.postMessage(customEmojiWithColons);

        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Search for the custom emoji
        cy.findByPlaceholderText('Search Custom Emoji').should('be.visible').type(customEmoji);

        cy.get('.emoji-list__table').should('be.visible').within(() => {
            // * Since we are searching exactly for that custom emoji, we should get only one result
            cy.findByText('Delete').should('have.length', 1);

            // # Delete the custom emoji
            cy.findByText('Delete').should('have.length', 1).click({force: true});
        });

        // # Confirm deletion
        cy.get('#confirmModalButton').should('be.visible').click();

        // # Go back to home channel
        cy.visit(townsquareLink);

        cy.reload();

        // * Show emoji list
        cy.uiOpenEmojiPicker();

        // # Search emoji name text in emoji searching input
        cy.findByPlaceholderText('Search emojis').should('be.visible').type(customEmojiWithColons, {delay: TIMEOUTS.HALF_SEC});

        // * Get list of emojis based on search text
        cy.get('.no-results__title').should('be.visible').and('have.text', 'No results for "' + customEmoji + '"');

        // # Navigate to a channel
        cy.visit(townsquareLink);

        cy.getLastPost().within(() => {
            // * Verify that only the plain message renders in the post and the emoji has been deleted
            cy.get('p').should('have.html', '<span data-emoticon="' + customEmoji + '">' + customEmojiWithColons + '</span>');
        });
    });

    it('MM-T4437 Custom emoji - delete emoji after reacting with it to a post', () => {
        const {customEmoji, customEmojiWithColons} = getCustomEmoji();

        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Click on add new emoji
        cy.findByText('Add Custom Emoji').should('be.visible').click();

        // # Type emoji name
        cy.get('#name').type(customEmojiWithColons);

        // # Select emoji image
        cy.get('input#select-emoji').attachFile(largeEmojiFile).wait(TIMEOUTS.THREE_SEC);

        // # Click on Save
        cy.uiSave().wait(TIMEOUTS.THREE_SEC);

        // # Go back to home channel
        cy.visit(townsquareLink);

        // # Post a message to which we will react with the custom emoji
        cy.postMessage(MESSAGES.TINY);

        // # Execute shortcut to open emoji picker for reacting to last message
        doReactToLastMessageShortcut('CENTER');

        cy.get('#emojiPicker').should('be.visible').within(() => {
            // # Search for the same custom emoji
            cy.findByPlaceholderText('Search emojis').type(customEmojiWithColons, {delay: TIMEOUTS.HALF_SEC}).wait(TIMEOUTS.HALF_SEC);

            // * Since we are searching exactly for that custom emoji, we should get only one result
            cy.findAllByTestId('emojiItem').children().should('have.length', 1);
            cy.findAllByTestId('emojiItem').children('img').first().should('have.class', 'emoji-category--custom');

            // # Select the custom emoji to add as the reaction to the last post
            cy.findAllByTestId('emojiItem').children().click();
        });

        // * Verify that the custom emoji is added as a reaction to the last post
        cy.getLastPostId().then((lastPostId) => {
            checkReactionFromPost(lastPostId, customEmoji);
        });

        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Search for the custom emoji
        cy.findByPlaceholderText('Search Custom Emoji').should('be.visible').type(customEmoji).wait(TIMEOUTS.HALF_SEC);

        cy.get('.emoji-list__table').should('be.visible').within(() => {
            // * Since we are searching exactly for that custom emoji, we should get only one result
            cy.findAllByText(customEmojiWithColons).should('have.length', 1);

            // # Delete the custom emoji
            cy.findAllByText('Delete').should('have.length', 1).click();
        });

        // # Confirm deletion
        cy.get('#confirmModalButton').should('be.visible').click();

        // # Go back to home channel
        cy.visit(townsquareLink);

        cy.reload();

        // * Show emoji list
        cy.uiOpenEmojiPicker();

        // # Search emoji name text in emoji searching input
        cy.findByPlaceholderText('Search emojis').should('be.visible').type(customEmojiWithColons, {delay: TIMEOUTS.HALF_SEC});

        // * Get list of emojis based on search text
        cy.get('.no-results__title').should('be.visible').and('have.text', 'No results for "' + customEmoji + '"');

        // # Navigate to a channel
        cy.visit(townsquareLink);

        cy.getLastPost().within(() => {
            // * Verify that the custom emoji as reaction is not present to last post
            cy.findByLabelText('reactions').should('not.exist');
            cy.findByLabelText(`remove reaction ${customEmoji}}`).should('not.exist');
        });
    });
});
