// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @custom_status

describe('Custom Status - Recent Statuses', () => {
    const customStatus = {
        emoji: 'grinning',
        text: 'Busy',
    };

    const defaultStatus = {
        emoji: 'calendar',
        text: 'In a meeting',
    };

    before(() => {
        cy.apiUpdateConfig({TeamSettings: {EnableCustomUserStatuses: true}});

        // # Login as test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T3847_1 set a status', () => {
        // # Open the custom status modal
        cy.uiOpenUserMenu('Set a Custom Status');

        // # Type the custom status text in the custom status modal input
        cy.get('#custom_status_modal .StatusModal__input input').typeWithForce(customStatus.text);

        // # Select an emoji from the emoji picker and set the status
        cy.get('#custom_status_modal .StatusModal__emoji-button').click();

        // # Select the emoji from the emoji picker overlay
        cy.clickEmojiInEmojiPicker(customStatus.emoji);

        cy.get('#custom_status_modal .GenericModal__button.confirm').click();

        // * Custom status emoji should be visible in the sidebar header
        cy.uiGetProfileHeader().
            find('.emoticon').
            should('have.attr', 'data-emoticon', customStatus.emoji);
    });

    it('MM-T3847_2 should show status in the top in the Recents list', () => {
        // # Open the custom status modal
        cy.uiOpenUserMenu(customStatus.text);

        // # Click on the clear button in the custom status modal
        cy.get('#custom_status_modal .StatusModal__clear-container').click();

        // * Custom status modal input should be empty
        cy.get('#custom_status_modal input.form-control').should('have.value', '');

        // * Set status should be the first in the Recents list
        cy.get('#custom_status_modal #statusSuggestion__recents .statusSuggestion__row').first().find('.statusSuggestion__text').should('have.text', customStatus.text);
    });

    it('MM-T3847_3 should remove the status from Recents list when corresponding clear button is clicked', () => {
        // # Hover on the first suggestion in the Recents list and the clear button should be visible
        cy.get('#custom_status_modal #statusSuggestion__recents .statusSuggestion__row').first().trigger('mouseover');
        cy.get('#custom_status_modal #statusSuggestion__recents .statusSuggestion__row').first().get('.suggestion-clear').should('be.visible');

        // # Click on the clear button of the suggestion to remove the suggestion from the Recents list
        cy.get('#custom_status_modal #statusSuggestion__recents .statusSuggestion__row').first().get('.suggestion-clear').click();

        // * The custom status should be removed from the Recents
        cy.get('#custom_status_modal .statusSuggestion__content').should('not.contain', customStatus.text);
    });

    it('MM-T3847_4 should set default status when clicked on the status', () => {
        // # Set a custom status from the Suggestions by clicking on it and then clicking "Set Status" button
        cy.get('#custom_status_modal .statusSuggestion__content').contains('span', defaultStatus.text).click();
        cy.get('#custom_status_modal .GenericModal__button.confirm').click();

        // * Check if custom status is successfully set by checking the emoji in the sidebar header
        cy.uiGetProfileHeader().
            find('.emoticon').
            should('have.attr', 'data-emoticon', defaultStatus.emoji);
    });

    it('MM-T3847_5 should show status set in step 4 in the top in the Recents list', () => {
        // # Open the custom status modal
        cy.uiOpenUserMenu(defaultStatus.text);

        // # Click on the clear button in the custom status modal input
        cy.get('#custom_status_modal .StatusModal__clear-container').click();

        // * Custom status modal input should be empty
        cy.get('#custom_status_modal input.form-control').should('have.value', '');

        // * The set status should be present at the top of the Recents list
        cy.get('#custom_status_modal #statusSuggestion__recents .statusSuggestion__row').first().find('.statusSuggestion__text').should('have.text', defaultStatus.text);
    });

    it('MM-T3847_6 should remove the default status from Recents and show in the Suggestions', () => {
        cy.get('#custom_status_modal #statusSuggestion__recents .statusSuggestion__row').first().trigger('mouseover');
        cy.get('#custom_status_modal #statusSuggestion__recents .statusSuggestion__row').first().get('.suggestion-clear').should('be.visible');

        // * The set status should be present in Recents list and not in the Suggestions list
        cy.get('#custom_status_modal #statusSuggestion__recents').should('contain', defaultStatus.text);
        cy.get('#custom_status_modal #statusSuggestion__suggestions').should('not.contain', defaultStatus.text);

        // # Click on the clear button of the topmost suggestion
        cy.get('#custom_status_modal #statusSuggestion__recents .statusSuggestion__row').first().get('.suggestion-clear').click();

        // * The status should be moved from the Recents list to the Suggestions list
        cy.get('#custom_status_modal #statusSuggestion__recents').should('not.exist');
        cy.get('#custom_status_modal #statusSuggestion__suggestions').should('contain', defaultStatus.text);
    });
});
