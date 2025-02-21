// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @custom_status

import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';

describe('MM-T4066 Setting manual status clear time more than 7 days away', () => {
    before(() => {
        cy.apiUpdateConfig({TeamSettings: {EnableCustomUserStatuses: true}});

        // # Login as test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            cy.visit(channelUrl);
        });
    });

    const defaultCustomStatuses = ['In a meeting', 'Out for lunch', 'Out sick', 'Working from home', 'On a vacation'];
    const defaultDurations = ["Don't clear", '30 minutes', '1 hour', '4 hours', 'Today', 'This week', 'Choose date and time'];

    const customStatus = {
        emoji: 'hamburger',
        text: 'Out for lunch',
        duration: '30 minutes',
    };

    dayjs.extend(advancedFormat);
    const today = dayjs();
    const dateToBeSelected = today.add(8, 'd');
    const months = dateToBeSelected.get('month') - today.get('month');
    it('MM-T4066_1 should open status dropdown', () => {
        // # Click on the sidebar header to open status dropdown
        cy.uiGetSetStatusButton().click();

        // * Check if the status dropdown opens
        cy.get('#userAccountMenu').should('exist');
    });

    it('MM-T4066_2 Custom status modal opens with 5 default statuses listed', () => {
        // # Open custom status modal
        cy.get('.userAccountMenu_setCustomStatusMenuItem').click();
        cy.get('#custom_status_modal').should('exist');

        // * Check if all the default suggestions exist
        defaultCustomStatuses.map((statusText) => cy.get('#custom_status_modal .statusSuggestion__content').contains('span', statusText));
    });

    it('MM-T4066_3 Correct custom status is selected with the correct emoji and correct duration', () => {
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

        // * Selected custom status duration should be displayed in the Clear after section
        cy.get('#custom_status_modal .expiry-wrapper .expiry-value').should('have.text', customStatus.duration);
    });

    it('MM-T4066_4 Clear after dropdown opens with all default durations listed', () => {
        // * Check that the expiry menu is not openclick on the menu to open it
        cy.get('#custom_status_modal .statusExpiry__menu #statusExpiryMenu').should('not.exist');

        // # Click on the expiry menu
        cy.get('#custom_status_modal .statusExpiry__menu').click();

        // * Check that the expiry menu opens
        cy.get('#custom_status_modal .statusExpiry__menu #statusExpiryMenu').should('exist');

        // * Check if all default durations exist in the menu
        defaultDurations.map((duration, index) => cy.get(`#custom_status_modal #statusExpiryMenu li#expiry_menu_item_${index}`).should('have.text', duration));
    });

    it.skip('MM-T4066_5 should show date/time input on selecting Choose date and time', () => {
        // * Check that the date and time input are not present
        cy.get('#custom_status_modal .dateTime').should('not.exist');

        // # Click the Choose Date and Time option from the menu
        cy.get('#custom_status_modal #statusExpiryMenu li').last().click();

        // * Check that the date and time input should be present
        cy.get('#custom_status_modal .dateTime').should('exist');
    });

    it.skip('MM-T4066_6 should show selected date in the date input field', () => {
        // # Click on DayPicker input field
        cy.get('.dateTime__calendar-icon').click();

        // * Verify that DayPicker overlay is visible
        cy.get('.date-picker__popper').should('be.visible');

        // # Click on the date which is dateToBeSelected
        for (let i = 0; i < months; i++) {
            cy.get('i.icon.icon-chevron-right').click();
        }
        cy.get('.date-picker__popper').find(`.rdp-month button[aria-label="${dateToBeSelected.format('Do MMMM (dddd)')}"]`).click();

        // * Check that the date input should have the correct value
        cy.get('input#customStatus__calendar-input').should('have.value', dateToBeSelected.format('YYYY-MM-DD'));
    });

    it('MM-T4066_7 should set custom status when click on Set Status', () => {
        // # Click on the Set Status button
        cy.get('#custom_status_modal .GenericModal__button.confirm').click();

        // * Modal should be closed
        cy.get('#custom_status_modal').should('not.exist');

        // * Status should be set and the emoji should be visible in the sidebar header
        cy.uiGetProfileHeader().
            find('.emoticon').
            should('have.attr', 'data-emoticon', customStatus.emoji);
    });

    it.skip('MM-T4066_8 should show the set custom status with expiry when status dropdown is opened', () => {
        // # Click on the sidebar header to open status dropdown
        cy.get('.MenuWrapper .status-wrapper').click();

        // * Check if the status dropdown opens
        cy.get('#statusDropdownMenu').should('exist');

        // * Correct custom status text and emoji should be displayed in the status dropdown
        cy.get('.status-dropdown-menu .custom_status__container').should('have.text', customStatus.text);
        cy.get('.status-dropdown-menu .custom_status__row span.emoticon').invoke('attr', 'data-emoticon').should('contain', customStatus.emoji);

        // * Correct clear time should be displayed in the status dropdown
        cy.get('.status-dropdown-menu .custom_status__expiry time').should('have.text', dateToBeSelected.format('MMM DD'));
    });

    it.skip('MM-52881 should show the selected date when reopening the date picker', () => {
        // # clear the status
        cy.get('.input-clear-x').click();

        // # open the status modal
        cy.get('.custom_status__row').click();

        // # select the first option
        cy.get('.statusSuggestion__row').first().click();

        // # open the date picker
        cy.get('.dateTime__calendar-icon').click();

        // * Verify that DayPicker overlay is visible
        cy.get('.date-picker__popper').should('be.visible');

        // # Click on the date which is dateToBeSelected
        for (let i = 0; i < months; i++) {
            cy.get('i.icon.icon-chevron-right').click();
        }
        cy.get('.date-picker__popper').find(`.rdp-month button[aria-label="${dateToBeSelected.format('Do MMMM (dddd)')}"]`).click();

        // # reopen the date picker
        cy.get('.dateTime__calendar-icon').click();

        // * Verify that date selected is still selected
        cy.get('.date-picker__popper').find(`.rdp-month button[aria-label="${dateToBeSelected.format('Do MMMM (dddd)')}"]`).should('have.class', 'rdp-day_selected');
    });
});
