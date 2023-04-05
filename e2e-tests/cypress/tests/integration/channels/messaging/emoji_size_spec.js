// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T164 Whitespace with emojis does not affect size', () => {
        const emojis = [':book:', ':key:', ':gem:'];

        // # Post a message beginning with a new line and followed by emojis
        cy.postMessage('hello');
        cy.uiGetPostTextBox().type('\n' + emojis.join(' ')).type('{enter}');

        // # Get last post message text
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).as('newLineMessage');
        });

        // * Verify message is visible and does not have a new line
        cy.get('@newLineMessage').
            should('be.visible').
            and('not.contain', '\n');

        // * Verify emoji size
        checkEmojiSize('@newLineMessage', emojis, true);

        // # Post a message beginning with three spaces and followed by emojis
        cy.postMessage('   ' + emojis.join(' '));

        // # Get last post message text
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).as('spacesMessage');
        });

        // * Verify message is visible and starts with three spaces
        cy.get('@spacesMessage').
            should('be.visible');
        cy.get('@spacesMessage').
            should((message) => {
                expect(message.find('span.all-emoji p').html()).to.match(/^[ ]{3}/);
            });

        // * Verify emoji size
        checkEmojiSize('@spacesMessage', emojis, true);
    });

    it('MM-T163 Emojis are not jumbo when accompanied by text', () => {
        const emojis = [':book:', ':key:', ':gem:'];

        // # Post a message
        const messageText = 'This is a message from the future';
        cy.postMessage(messageText + ' ' + emojis.join(' '));

        // # Get last post message text
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).as('newLineMessage');
        });

        // # Making sure Emojis from last post message are 21px size
        checkEmojiSize('@newLineMessage', emojis, false);
    });

    it('MM-T160 Emojis show as jumbo in main thread - Multi emoji, no text, including unicode and emoticon', () => {
        // # Create list of emojis we want to post
        const emojis = [':smiley:', ':thumbsup:', '🤟'];

        // # Post Emojis list
        cy.postMessage(emojis.join(''));

        // # Get last post message
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).as('lastMessage');

            // * Expect emoji list to have emoji jumbo size
            checkEmojiSize('@lastMessage', emojis, true);
        });
    });
});

/**
 * [checkEmojiSizeInPost: this function is going to check the correct size of emojis when they're inside messages]
 * @param  message {string[]} [this is the message we send along with some emojis attached to it ]
 * @param  emojis  {string[]} [array of emojis]
 * @param  isJumbo {boolean}  [This parameter is used to verify what kind of matcher and size we need to compare in the emojis]
 */
function checkEmojiSize(message, emojis, isJumbo) {
    const [height, width, size] = isJumbo ? ['min-Height', 'min-Width', '32px'] : ['height', 'width', '21px'];

    emojis.forEach((emoji) => {
        cy.get(message).
            find('span[alt="' + (emoji === '🤟' ? ':i_love_you_hand_sign:' : emoji) + '"]').
            and('have.css', height, size).
            and('have.css', width, size);
    });
}
