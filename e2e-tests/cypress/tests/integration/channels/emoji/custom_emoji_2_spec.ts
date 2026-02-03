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
    let townsquareLink;

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

    it('MM-T2184 Custom emoji - filter list', () => {
        const {customEmojiWithColons} = getCustomEmoji();

        const emojiNameForSearch1 = 'alabala';
        const emojiNameForSearch2 = customEmojiWithColons;

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

        // # Open emoji picker
        cy.uiOpenEmojiPicker();

        // # Search for a missing emoji in emoji picker
        cy.findByPlaceholderText('Search emojis').should('be.visible').type(emojiNameForSearch1, {delay: TIMEOUTS.QUARTER_SEC});

        // * Get list of emojis based on search text
        cy.get('.no-results__title').should('be.visible').and('have.text', 'No results for “' + emojiNameForSearch1 + '”');

        // # Search for an existing emoji
        cy.findByPlaceholderText('Search emojis').should('be.visible').clear().type(emojiNameForSearch2, {delay: TIMEOUTS.QUARTER_SEC});

        // * Get list of emojis based on search text
        cy.findAllByTestId('emojiItem').children().should('have.length', 1);
        cy.findAllByTestId('emojiItem').children('img').first().should('have.class', 'emoji-category--custom');
    });

    it('MM-T4436 Emoji picker should show all custom emojis without overlaps', () => {
        const {customEmojiWithColons: firstEmojiWithColon} = getCustomEmoji();
        const {customEmojiWithColons: secondEmojiWithColon} = getCustomEmoji();

        // # Open custom emoji
        cy.uiOpenCustomEmoji();

        // # Add two custom emojis
        [firstEmojiWithColon, secondEmojiWithColon].forEach((emojiWithColon) => {
            // # Click on add new emoji for adding a custom emoji
            cy.findByText('Add Custom Emoji').should('be.visible').click();

            // # Type emoji name
            cy.get('#name').type(emojiWithColon);

            // # Select emoji image
            cy.get('input#select-emoji').attachFile(largeEmojiFile).wait(TIMEOUTS.THREE_SEC);

            // # Click on Save
            cy.uiSave().wait(TIMEOUTS.THREE_SEC);
        });

        // # Go back to home channel
        cy.visit(townsquareLink);

        cy.reload().wait(TIMEOUTS.FIVE_SEC);

        // # Open emoji picker
        cy.uiOpenEmojiPicker();

        cy.get('#emojiPicker').should('be.visible').within(() => {
            // # Scroll to start of custom category section
            cy.get('i.icon-emoticon-custom-outline').as('customSection');
            cy.get('@customSection').click().wait(TIMEOUTS.FIVE_SEC);
            cy.get('@customSection').click().wait(TIMEOUTS.FIVE_SEC);

            // * Verify custom category header is visible
            cy.findByText('Custom').should('exist').and('is.visible');

            // * Verify that first custom emoji exists and is visible to user
            cy.findAllByAltText('custom emoji').should('exist').eq(0).and('is.visible');

            // * Verify second custom emoji exists and is visible to user,
            // if both custom emojis are visible we can conclude that they are not overlapping
            cy.findAllByAltText('custom emoji').should('exist').eq(1).and('is.visible');
        });
    });
});
