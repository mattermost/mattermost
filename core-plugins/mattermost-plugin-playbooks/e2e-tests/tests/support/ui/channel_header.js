// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Buttons

Cypress.Commands.add('uiGetChannelHeaderButton', () => {
    return cy.get('#channelHeaderDropdownButton').should('be.visible');
});

Cypress.Commands.add('uiGetChannelFavoriteButton', () => {
    return cy.get('#toggleFavorite').should('be.visible');
});

Cypress.Commands.add('uiGetMuteButton', () => {
    return cy.get('#toggleMute').should('be.visible');
});

Cypress.Commands.add('uiGetChannelMemberButton', () => {
    return cy.get('#member_rhs').should('be.visible');
});

Cypress.Commands.add('uiGetChannelPinButton', () => {
    return cy.get('#channelHeaderPinButton').should('be.visible');
});

Cypress.Commands.add('uiGetChannelFileButton', () => {
    return cy.get('#channelHeaderFilesButton').should('be.visible');
});

// Menus

Cypress.Commands.add('uiGetChannelMenu', (options = {exist: true}) => {
    if (options.exist) {
        return cy.get('#channelHeaderDropdownMenu').
            find('.dropdown-menu').
            should('be.visible');
    }

    return cy.get('#channelHeaderDropdownMenu').should('not.exist');
});

Cypress.Commands.add('uiOpenChannelMenu', (item = '') => {
    // # Click on channel header button
    cy.uiGetChannelHeaderButton().click();

    if (!item) {
        // # Return the menu if no item is passed
        return cy.uiGetChannelMenu();
    }

    // # Click on a particular item
    return cy.uiGetChannelMenu().
        findByText(item).
        scrollIntoView().
        should('be.visible').
        click();
});
