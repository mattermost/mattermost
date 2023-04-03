// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @emoji

import * as TIMEOUTS from '../../../fixtures/timeouts';

import {getCustomEmoji} from './helpers';

describe('Custom emojis', () => {
    let testTeam;
    let testUser;
    let otherUser;
    let offTopicUrl;

    const tooLargeEmojiFile = 'huge-image.jpg';

    const animatedGifEmojiFile = 'animated-gif-image-file.gif';

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
            offTopicUrl = `/${team.name}/channels/off-topic`;
        });

        cy.apiCreateUser().then(({user: user1}) => {
            otherUser = user1;
            cy.apiAddUserToTeam(testTeam.id, otherUser.id);
        }).then(() => {
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T3668 User cant add custom emoji with the same name as a system one', () => {
        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Click on add new emoji
        cy.findByText('Add Custom Emoji').should('be.visible').click();

        // # Type emoji name and click on save
        cy.get('#name').type('croissant');
        cy.get('.backstage-form__footer').within(($form) => {
            cy.uiSave().wait(TIMEOUTS.FIVE_SEC);

            // * Check for error saying that the emoji icon is a system one
            cy.wrap($form).find('.has-error').should('be.visible').and('have.text', 'This name is already in use by a system emoji. Please choose another name.');
        });
    });

    it('MM-T2180 Custom emoji - cancel out of add', () => {
        const {customEmoji} = getCustomEmoji();

        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Click on add new emoji
        cy.findByText('Add Custom Emoji').should('be.visible').click();

        // # Type emoji name
        cy.get('#name').type(customEmoji);

        // # Select emoji image
        cy.get('input#select-emoji').attachFile('mattermost-icon.png');

        // # Click on Cancel
        cy.get('.backstage-form__footer').findByText('Cancel').click().wait(TIMEOUTS.FIVE_SEC);

        // # Go back to home channel
        cy.visit(offTopicUrl);

        // # Open emoji picker
        cy.uiOpenEmojiPicker();

        // # Search emoji name text in emoji searching input
        cy.findByPlaceholderText('Search emojis').should('be.visible').type(customEmoji, {delay: TIMEOUTS.QUARTER_SEC});

        // * Validate that we cannot find the emoji name in the search result list
        cy.get('.no-results__title').should('be.visible').and('have.text', 'No results for "' + customEmoji + '"');
    });

    it('MM-T2182 Custom emoji - animated gif', () => {
        const {customEmojiWithColons} = getCustomEmoji();

        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Click on add custom emoji
        cy.findByRole('button', {name: 'Add Custom Emoji'}).should('be.visible').click();

        // # Type emoji name
        cy.get('#name').should('be.visible').type(customEmojiWithColons);

        // # Attached image file and wait to be loaded
        cy.get('input#select-emoji').attachFile(animatedGifEmojiFile);
        cy.wait(TIMEOUTS.FIVE_SEC);

        // # Save custom emoji
        saveCustomEmoji(testTeam.name);

        // # Go back to home channel
        cy.visit(offTopicUrl);

        // # Post a message with the emoji
        cy.postMessage(customEmojiWithColons);

        // # Open emoji picker
        cy.uiOpenEmojiPicker();

        // # Search emoji name text in emoji searching input
        cy.findByPlaceholderText('Search emojis').should('be.visible').type(customEmojiWithColons, {delay: TIMEOUTS.QUARTER_SEC});

        // * Get list of emojis based on search text
        cy.findAllByTestId('emojiItem').children().should('have.length', 1);
        cy.findAllByTestId('emojiItem').children('img').first().should('have.class', 'emoji-category--custom');
    });

    it('MM-T2183 Custom emoji - try to add too large', () => {
        const {customEmojiWithColons} = getCustomEmoji();

        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Click on add new emoji
        cy.findByText('Add Custom Emoji').should('be.visible').click();

        // # Type emoji name
        cy.get('#name').type(customEmojiWithColons);

        // # Select emoji image
        cy.get('input#select-emoji').attachFile(tooLargeEmojiFile);

        // * Is the image loaded?
        cy.get('.add-emoji__filename').should('have.text', tooLargeEmojiFile);
        cy.get('.backstage-form__footer').within(($form) => {
            // # Click on Save
            cy.uiSave().wait(TIMEOUTS.FIVE_SEC);

            // * Check for error
            cy.wrap($form).find('.has-error').should('be.visible').and('have.text', 'Unable to create emoji. Image must be less than 512 KiB in size.');
        });
    });
});

function saveCustomEmoji(teamName) {
    // # Click on Save
    cy.findByText('Save').click();

    // # Wait until new custom emoji has been added
    const checkFn = () => {
        return cy.url().then((url) => {
            return !url.includes('/emoji/add');
        });
    };
    const options = {
        timeout: TIMEOUTS.ONE_MIN,
        interval: TIMEOUTS.FIVE_SEC,
        errorMsg: 'Timeout error waiting for custom emoji to be saved',
    };
    cy.waitUntil(checkFn, options);

    // * Should return to list of custom emojis
    cy.url().should('include', `${teamName}/emoji`);
    cy.findByRole('button', {name: 'Add Custom Emoji'}).should('be.visible');
}
