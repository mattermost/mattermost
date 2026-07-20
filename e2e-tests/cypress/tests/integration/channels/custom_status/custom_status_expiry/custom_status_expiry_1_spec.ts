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

describe('MM-T4063 Custom status expiry', () => {
    before(() => {
        cy.apiUpdateConfig({TeamSettings: {EnableCustomUserStatuses: true}});

        // # Login as test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            cy.visit(channelUrl);
        });
    });

    const defaultCustomStatuses = ['In a meeting', 'Out for lunch', 'Out sick', 'Working from home', 'On a vacation'];
    const customStatus = {
        emoji: 'hamburger',
        emojiAriaLabel: ':hamburger:',
        text: 'Out for lunch',
        duration: '30 minutes',
    };

    const waitingTime = 30; //minutes
    let expiresAt = dayjs();
    let expiresAtAcceptableValues = [''];
    let expiresAtRegexp: RegExp;
    const expiryTimeFormat = 'h:mm A';
    it('MM-T4063_1 should open status dropdown', () => {
        // # Click on the sidebar header to open status dropdown
        cy.uiGetSetStatusButton().click();

        // * Check if the status dropdown opens
        cy.uiGetStatusMenu();

        // # Close the status dropdown
        cy.get('body').click();
    });

    it('MM-T4063_2 Custom status modal opens with 5 default statuses listed', () => {
        // # Open custom status modal
        cy.uiOpenUserMenu('Set custom status');

        cy.findByRole('dialog', {name: 'Set a status'}).should('exist').within(() => {
            // * Check if all the default suggestions exist
            defaultCustomStatuses.forEach((statusText) => {
                cy.findByText(statusText).should('exist');
            });
        });
    });

    it('MM-T4063_3 Correct custom status is selected with the correct emoji and correct duration', () => {
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

    it('MM-T4063_4 should set custom status when click on Set Status', () => {
        // # Click on the Set Status button
        cy.get('#custom_status_modal .GenericModal__button.confirm').click();

        // * Modal should be closed
        cy.get('#custom_status_modal').should('not.exist');

        // # Setting the time at which the custom status should be expired
        // # Note that we need to be flexible around accepted values, as this calculation and the server-side one may differ slightly
        expiresAt = dayjs().add(waitingTime, 'minute');
        expiresAtAcceptableValues = [-1, 0, 1].map((el) =>
            expiresAt.add(el, 'minute').format(expiryTimeFormat),
        );
        expiresAtRegexp = new RegExp(`(${expiresAtAcceptableValues.join('|')})`);

        // * Status should be set and the emoji should be visible in the sidebar header
        cy.uiGetProfileHeader().
            find('.emoticon').
            should('have.attr', 'data-emoticon', customStatus.emoji);
    });

    it('MM-T4063_5 should show the set custom status with expiry when status dropdown is opened', () => {
        // # Click on the sidebar header to open status dropdown
        cy.uiGetSetStatusButton().click();

        // * Check if the status dropdown opens
        cy.uiGetStatusMenu().within(() => {
            // * Correct custom status text and emoji should be displayed in the status dropdown
            cy.findByText(customStatus.text).should('exist');
            cy.findByLabelText(customStatus.emojiAriaLabel).should('exist');

            // * Correct clear time should be displayed in the status dropdown
            cy.findByText(expiresAtRegexp).should('exist');
        });
    });

    it('MM-T4063_6 custom status should be cleared after duration of set custom status', () => {
        // # Forwarding the time by the duration of custom status
        cy.clock(Date.now());
        cy.tick(waitingTime * 60 * 1000);

        // * Correct clear time should be displayed in the status dropdown
        cy.get('.status-dropdown-menu .custom_status__expiry', {timeout: 40000}).should('not.exist');
    });

    it('MM-T4063_7 current custom status should display expiry time in custom status modal', () => {
        // # Open custom status modal
        cy.get('.userAccountMenu_customStatusMenuItem').should('be.visible').click();

        // * Should show expiry time of status when current status is selected
        cy.get('#custom_status_modal .statusSuggestion__content').contains('span', customStatus.text).click();
        cy.get('#custom_status_modal .expiry-value').invoke('text').should('match', expiresAtRegexp);

        // # Close custom status modal
        cy.get('#custom_status_modal .modal-header .close').click();
    });

    it('MM-T4063_8 previous custom status duration should be reset if custom status is expired', () => {
        // # Forwarding the time by the duration of custom status
        cy.clock(Date.now());
        cy.tick(waitingTime * 60 * 1000).then(() => {
            // # Open custom status modal
            cy.uiOpenUserMenu().within(() => {
                // * Verify that there is no custom status in the dropdown
                cy.findByText('Set custom status').should('exist').and('be.visible');
            });
        });
    });
});
