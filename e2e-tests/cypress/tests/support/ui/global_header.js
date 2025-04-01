// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('uiGetProductMenuButton', () => {
    return cy.findByRole('button', {name: 'Product switch menu'}).should('be.visible');
});

Cypress.Commands.add('uiGetProductMenu', () => {
    return cy.get('.product-switcher-menu').should('be.visible');
});

Cypress.Commands.add('uiOpenProductMenu', (item = '') => {
    // # Click on product switch button
    cy.uiGetProductMenuButton().click();

    if (!item) {
        // # Return the menu if no item is passed
        return cy.uiGetProductMenu();
    }

    // # Click on a particular item
    return cy.uiGetProductMenu().
        findByText(item).
        scrollIntoView().
        should('be.visible').
        click();
});

Cypress.Commands.add('uiGetSetStatusButton', () => {
    // # Get set status button
    return cy.get('#userAccountMenuButton').should('be.visible');
});

Cypress.Commands.add('uiGetProfileHeader', () => {
    return cy.uiGetSetStatusButton().parent();
});

Cypress.Commands.add('uiGetStatusMenuContainer', (options = {exist: true}) => {
    if (options.exist) {
        return cy.get('#userAccountMenu').should('exist').and('be.visible');
    }

    return cy.get('#userAccountMenu').should('not.exist');
});

Cypress.Commands.add('uiGetStatusMenu', (options = {visible: true}) => {
    if (options.visible) {
        return cy.get('#userAccountMenu').should('exist').and('be.visible');
    }

    return cy.get('#userAccountMenu').should('not.exist');
});

Cypress.Commands.add('uiOpenHelpMenu', (item = '') => {
    // # Click on help status button
    cy.uiGetHelpButton().click();

    if (!item) {
        // # Return the menu if no item is passed
        return cy.uiGetHelpMenu();
    }

    // # Click on a particular item
    return cy.uiGetHelpMenu().
        findByText(item).
        scrollIntoView().
        should('be.visible').
        click();
});

Cypress.Commands.add('uiGetHelpButton', () => {
    return cy.findByRole('button', {name: 'Help'}).should('be.visible');
});

Cypress.Commands.add('uiGetHelpMenu', (options = {visible: true}) => {
    const dropdown = () => cy.get('#helpMenuPortal').find('.dropdown-menu');

    if (options.visible) {
        return dropdown().should('be.visible');
    }

    return dropdown().should('not.be.visible');
});

Cypress.Commands.add('uiOpenUserMenu', (item = '') => {
    // # Click on user status button
    cy.uiGetSetStatusButton().click();

    if (!item) {
        // # Return the menu if no item is passed
        return cy.uiGetStatusMenu();
    }

    // # Click on a particular item
    return cy.uiGetStatusMenu().
        findByText(item).
        scrollIntoView().
        should('be.visible').
        click();
});

Cypress.Commands.add('uiGetSearchContainer', () => {
    return cy.get('#searchFormContainer').should('be.visible');
});

Cypress.Commands.add('uiGetSearchBox', () => {
    return cy.get('.search-bar').should('be.visible');
});

Cypress.Commands.add('uiGetRecentMentionButton', () => {
    return cy.findByRole('button', {name: 'Recent mentions'}).should('be.visible');
});

Cypress.Commands.add('uiGetSavedPostButton', () => {
    return cy.findByRole('button', {name: 'Saved messages'}).should('be.visible');
});

Cypress.Commands.add('uiGetSettingsButton', () => {
    return cy.findByRole('button', {name: 'Settings'}).should('be.visible');
});

Cypress.Commands.add('uiGetChannelInfoButton', () => {
    return cy.findByRole('button', {name: 'View Info'}).should('be.visible');
});

Cypress.Commands.add('uiGetSettingsModal', () => {
    // # Get settings modal
    return cy.findByRole('dialog', {name: 'Settings'});
});

Cypress.Commands.add('uiOpenSettingsModal', (section = '') => {
    // # Open settings modal
    cy.uiGetSettingsButton().click();

    if (!section) {
        return cy.uiGetSettingsModal();
    }

    // # Click on a particular section
    cy.findByRoleExtended('tab', {name: section}).should('be.visible').click();

    return cy.uiGetSettingsModal();
});

Cypress.Commands.add('uiLogout', () => {
    // # Click logout via user menu
    cy.uiOpenUserMenu('Log out');

    cy.url().should('include', '/login');
    cy.get('.login-body-message').should('be.visible');
    cy.get('.login-body-card').should('be.visible');
});
