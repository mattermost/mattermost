// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @custom_status

import dayjs from 'dayjs';

describe('MM-T4064 Status expiry visibility', () => {
    before(() => {
        cy.apiUpdateConfig({TeamSettings: {EnableCustomUserStatuses: true}});

        // # Login as test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            cy.visit(channelUrl);
        });
    });

    const defaultCustomStatuses = ['In a meeting', 'Out for lunch', 'Out sick', 'Working from home', 'On a vacation'];
    const customStatus = {
        emoji: 'calendar',
        text: 'In a meeting',
        duration: '1 hour',
    };

    const waitingTime = 60; //minutes
    let expiresAt = dayjs();
    const expiryTimeFormat = 'h:mm A';
    it('MM-T4064_1 should open status dropdown', () => {
        // # Click on the sidebar header to open status dropdown
        cy.get('.MenuWrapper .status-wrapper').click();

        // * Check if the status dropdown opens
        cy.get('#statusDropdownMenu').should('exist');
    });

    it('MM-T4064_2 Custom status modal opens with 5 default statuses listed', () => {
        // # Open custom status modal
        cy.get('#statusDropdownMenu li#status-menu-custom-status').click();
        cy.get('#custom_status_modal').should('exist');

        // * Check if all the default suggestions exist
        defaultCustomStatuses.map((statusText) => cy.get('#custom_status_modal .statusSuggestion__content').contains('span', statusText));
    });

    it('MM-T4064_3 Correct custom status is selected with the correct emoji and correct duration', () => {
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

    it('MM-T4064_4 should set custom status when click on Set Status', () => {
        // # Click on the Set Status button
        cy.get('#custom_status_modal .GenericModal__button.confirm').click();

        // * Modal should be closed
        cy.get('#custom_status_modal').should('not.exist');

        // # Setting the time at which the custom status should be expired
        expiresAt = dayjs().add(waitingTime, 'minute');

        // * Status should be set and the emoji should be visible in the sidebar header
        cy.uiGetProfileHeader().
            find('.emoticon').
            should('have.attr', 'data-emoticon', customStatus.emoji);
    });

    it('MM-T4064_5 should show the set custom status with expiry when status dropdown is opened', () => {
        // # Click on the sidebar header to open status dropdown
        cy.get('.MenuWrapper .status-wrapper').click();

        // * Check if the status dropdown opens
        cy.get('#statusDropdownMenu').should('exist');

        // * Correct custom status text and emoji should be displayed in the status dropdown
        cy.get('.status-dropdown-menu .custom_status__container').should('have.text', customStatus.text);
        cy.get('.status-dropdown-menu .custom_status__row span.emoticon').invoke('attr', 'data-emoticon').should('contain', customStatus.emoji);

        // * Correct clear time should be displayed in the status dropdown
        cy.get('.status-dropdown-menu .custom_status__expiry time').should('have.text', expiresAt.format(expiryTimeFormat));
    });

    it('MM-T4064_6 should show expiry time in the tooltip of custom status emoji in the post header', () => {
        // # Post a message in the channel
        cy.postMessage('Hello World!');

        // # Hover on the custom status emoji present in the post header
        cy.get('.post.current--user .post__header span.emoticon').trigger('mouseover');

        // * Custom status tooltip should be visible
        cy.get('#custom-status-tooltip').should('exist');

        // * Tooltip should contain the correct custom status expiry time
        cy.get('#custom-status-tooltip .custom-status-expiry time').should('have.text', expiresAt.format(expiryTimeFormat));
    });

    it('MM-T4064_7 should show custom status expiry time in the user popover', () => {
        // # Click on the post header of the last post by the current user and open profile popover
        cy.get('.post.current--user .post__header .user-popover').first().click();
        cy.get('#user-profile-popover').should('exist');

        // * Check if the profile popover contains custom status expiry time in the Status heading
        cy.get('#user-profile-popover #user-popover-status .user-popover__subtitle time').should('have.text', expiresAt.format(expiryTimeFormat));
    });
});
