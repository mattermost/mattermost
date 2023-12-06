// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @custom_status

describe('Custom Status - Setting a Custom Status', () => {
    const defaultCustomStatuses = ['In a meeting', 'Out for lunch', 'Out sick', 'Working from home', 'On a vacation'];
    const customStatus = {
        emoji: 'calendar',
        text: 'In a meeting',
    };

    before(() => {
        cy.apiUpdateConfig({TeamSettings: {EnableCustomUserStatuses: true}});

        // # Login as test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            cy.visit(channelUrl);
        });
    });

    it('MM-T3836_1 should open status dropdown', () => {
        // # Click on the sidebar header to open status dropdown
        cy.get('.MenuWrapper .status-wrapper').click();

        // * Check if the status dropdown opens
        cy.get('#statusDropdownMenu').should('exist');
    });

    it('MM-T3836_2 Custom status modal opens with 5 default statuses listed', () => {
        // # Open custom status modal
        cy.get('#statusDropdownMenu li#status-menu-custom-status').click();
        cy.get('#custom_status_modal').should('exist');

        // * Check if all the default suggestions exist
        defaultCustomStatuses.map((statusText) => cy.get('#custom_status_modal .statusSuggestion__content').contains('span', statusText));
    });

    it('MM-T3836_3 "In a meeting" is selected with the calendar emoji', () => {
        // * Default emoji is currently visible in the custom status input
        cy.get('#custom_status_modal .StatusModal__emoji-button span').should('have.class', 'icon--emoji');

        // * Input should be empty
        cy.get('#custom_status_modal input.form-control').should('have.value', '');

        // # Select a custom status from the suggestions
        cy.get('#custom_status_modal .statusSuggestion__content').contains('span', customStatus.text).click();

        // * Emoji in the custom status input should be changed
        cy.get('#custom_status_modal .StatusModal__emoji-button span').invoke('attr', 'data-emoticon').should('contain', customStatus.emoji);

        // * Selected custom status text should be in the input
        cy.get('#custom_status_modal input.form-control').should('have.value', customStatus.text);
    });

    it('MM-T3836_4 In a meeting is cleared when clicked on "x" in the input', () => {
        // * Suggestions should not be visible
        cy.get('#custom_status_modal .statusSuggestion').should('not.exist');

        // # Click on the clear button
        cy.get('#custom_status_modal .StatusModal__clear-container').click();

        // * Input should be empty
        cy.get('#custom_status_modal input.form-control').should('have.value', '');

        // * All the suggestions should be visible again
        defaultCustomStatuses.map((statusText) => cy.get('#custom_status_modal .statusSuggestion__content').contains('span', statusText));
    });

    it('MM-T3836_5 "In a meeting" is selected with the calendar emoji', () => {
        // * Default emoji is currently visible in the custom status input
        cy.get('#custom_status_modal .StatusModal__emoji-button span').should('have.class', 'icon--emoji');

        // * Input should be empty
        cy.get('#custom_status_modal input.form-control').should('have.value', '');

        // # Select a custom status from the suggestions
        cy.get('#custom_status_modal .statusSuggestion__content').contains('span', customStatus.text).click();

        // * Emoji in the custom status input should be changed
        cy.get('#custom_status_modal .StatusModal__emoji-button span').invoke('attr', 'data-emoticon').should('contain', customStatus.emoji);

        // * Selected custom status text should be in the input
        cy.get('#custom_status_modal input.form-control').should('have.value', customStatus.text);
    });

    it('MM-T3836_6 should set custom status when click on Set Status', () => {
        // # Click on the Set Status button
        cy.get('#custom_status_modal .GenericModal__button.confirm').click();

        // * Modal should be closed
        cy.get('#custom_status_modal').should('not.exist');

        // * Status should be set and the emoji should be visible in the sidebar header
        cy.uiGetProfileHeader().
            find('.emoticon').
            should('have.attr', 'data-emoticon', customStatus.emoji);
    });

    it('MM-T3836_7 should display the custom status tooltip when hover on the emoji in LHS header', () => {
        // # Hover on the custom status emoji in the sidebar header
        cy.uiGetProfileHeader().
            find('.emoticon').
            trigger('mouseover');

        // * Custom status tooltip should be visible
        cy.get('#custom-status-tooltip').should('exist');

        // * Tooltip should contain the correct custom status emoji
        cy.get('#custom-status-tooltip .custom-status span.emoticon').invoke('attr', 'data-emoticon').should('contain', customStatus.emoji);

        // * Tooltip should contain the correct custom status text
        cy.get('#custom-status-tooltip .custom-status span.custom-status-text').should('have.text', customStatus.text);
    });

    it('MM-T3836_8 should open custom status modal when emoji in LHS header is clicked', () => {
        // * Check that the custom status modal is not open
        cy.get('#custom_status_modal').should('not.exist');

        // # Click on the custom status emoji in the sidebar header
        cy.uiGetProfileHeader().
            find('.emoticon').
            click();

        // * Check that the custom status modal should be open
        cy.get('#custom_status_modal').should('exist');
    });
});
