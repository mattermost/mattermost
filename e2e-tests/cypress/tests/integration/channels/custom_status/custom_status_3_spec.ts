// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @custom_status

describe('Custom Status - Setting Your Own Custom Status', () => {
    const customStatus = {
        emoji: 'grinning',
        text: 'Busy',
    };

    before(() => {
        cy.apiUpdateConfig({TeamSettings: {EnableCustomUserStatuses: true}});

        // # Login as test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T3846_1 should change the emoji to speech balloon when typed in the input', () => {
        // # Open the custom status modal
        cy.uiOpenUserMenu('Set a Custom Status');

        // * Default emoji is currently visible in the custom status input
        cy.get('#custom_status_modal .StatusModal__emoji-button span').should('have.class', 'icon--emoji');

        // # Type the status text in the input
        cy.get('#custom_status_modal .StatusModal__input input').typeWithForce(customStatus.text);

        // * Speech balloon emoji should now be visible in the custom status input
        cy.get('#custom_status_modal .StatusModal__emoji-button span').invoke('attr', 'data-emoticon').should('contain', 'speech_balloon');
    });

    it('MM-T3846_2 should display the emoji picker when clicked on the emoji button', () => {
        // # Click on the emoji button in the custom status input
        cy.get('#custom_status_modal .StatusModal__emoji-button').click();

        // * Emoji picker overlay should be opened
        cy.get('#emojiPicker').should('exist');
    });

    it('MM-T3846_3 should select the emoji from the emoji picker', () => {
        // * Check that the emoji picker is open
        cy.get('#emojiPicker').should('exist');

        // # Select the emoji from the emoji picker overlay
        cy.clickEmojiInEmojiPicker(customStatus.emoji);

        // * Emoji picker should be closed
        cy.get('#emojiPicker').should('not.exist');

        // * Selected emoji should be set in the custom status input emoji button
        cy.get('#custom_status_modal .StatusModal__emoji-button span').invoke('attr', 'data-emoticon').should('contain', customStatus.emoji);
    });

    it('MM-T3846_4 should set custom status when click on Set Status', () => {
        // # Click on the Set Status button
        cy.get('#custom_status_modal .GenericModal__button.confirm').click();

        // * Custom status modal should be closed
        cy.get('#custom_status_modal').should('not.exist');

        // * Correct custom status emoji should be displayed in the sidebar header
        cy.uiGetProfileHeader().
            find('.emoticon').
            should('have.attr', 'data-emoticon', customStatus.emoji);
    });

    it('MM-T3846_5 should show custom status with emoji in the status dropdown', () => {
        // # Open user menu
        cy.uiOpenUserMenu();

        // * Correct custom status text and emoji should be displayed in the status dropdown
        cy.get('.status-dropdown-menu .custom_status__container').should('have.text', customStatus.text);
        cy.get('.status-dropdown-menu .custom_status__row span.emoticon').invoke('attr', 'data-emoticon').should('contain', customStatus.emoji);
    });

    it('MM-T3846_6 should show previosly set status in the first position in Recents list', () => {
        // # Click on the "Set a Custom Status" option in the status dropdown
        cy.get('.status-dropdown-menu li#status-menu-custom-status').click();

        // * Custom status modal should open
        cy.get('#custom_status_modal').should('exist');

        // * Previously set status should be first in the recents list along with the correct emoji
        cy.get('#custom_status_modal .statusSuggestion__row').first().find('.statusSuggestion__text').should('have.text', customStatus.text);
        cy.get('#custom_status_modal .statusSuggestion__row').first().find('span.emoticon').invoke('attr', 'data-emoticon').should('contain', customStatus.emoji);
    });

    it('MM-T3846_7 should set the same status again when clicked on the Set status', () => {
        // # Select the first suggestion from the list and set the status
        cy.get('#custom_status_modal .statusSuggestion__row').first().click();
        cy.get('#custom_status_modal .GenericModal__button.confirm').click();

        // * Custom status modal should be closed
        cy.get('#custom_status_modal').should('not.exist');

        // * Correct custom status emoji should be displayed in the sidebar header
        cy.uiGetProfileHeader().
            find('.emoticon').
            should('have.attr', 'data-emoticon', customStatus.emoji);
    });

    it('MM-T3846_8 should clear the status when clicked on Clear status button', () => {
        // # Open user menu then custom status
        cy.uiOpenUserMenu(customStatus.text);

        // # Click on the Clear status button
        cy.findByRole('dialog', {name: 'Set a status'});
        cy.findByText('Clear Status').click();

        // # Open user menu
        cy.uiOpenUserMenu();

        // * Custom status text should not be displayed in the status dropdown
        cy.get('.status-dropdown-menu .custom_status__row').should('not.have.text', customStatus.text);
    });
});
