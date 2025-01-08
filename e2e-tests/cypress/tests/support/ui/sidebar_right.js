// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('uiGetRHS', (options = {visible: true}) => {
    if (options.visible) {
        return cy.get('#sidebar-right').should('be.visible');
    }

    return cy.get('#sidebar-right').should('not.be.exist');
});

Cypress.Commands.add('uiCloseRHS', () => {
    // here is the try to find all the possible "Close Sidebar Icon" elements
    // Use of the findAllByLabelText to avoid failure if the element doesn't exist in the screen yet
    // or RHS is closed with a timeout to guarantee its not a timing problem
    cy.findAllByLabelText('Close Sidebar Icon', {timeout: 1000}).then(($icons) => {
        if ($icons.length > 0) {
            // If it is found, click on the first one
            cy.wrap($icons[0]).click();
        }

        // If the icon is not found, the we do nothing (RHS is most already probably closed)
    });
});

Cypress.Commands.add('uiExpandRHS', () => {
    cy.findByLabelText('Expand').click();
});

Cypress.Commands.add('isExpanded', {prevSubject: true}, (subject) => {
    return cy.get(subject).should('have.class', 'sidebar--right--expanded');
});

Cypress.Commands.add('uiGetReply', () => {
    return cy.get('#sidebar-right').findByTestId('SendMessageButton');
});

Cypress.Commands.add('uiReply', () => {
    cy.uiGetReply().click();
});

// Sidebar search container

Cypress.Commands.add('uiGetRHSSearchContainer', (options = {visible: true}) => {
    if (options.visible) {
        return cy.get('#searchContainer').should('be.visible');
    }

    return cy.get('#searchContainer').should('not.exist');
});

// Sidebar files search

Cypress.Commands.add('uiGetFileFilterButton', () => {
    return cy.get('.FilesFilterMenu').should('be.visible');
});

Cypress.Commands.add('uiGetFileFilterMenu', (option = {exist: true}) => {
    if (option.exist) {
        return cy.get('.FilesFilterMenu').
            find('.dropdown-menu').
            should('be.visible');
    }

    return cy.get('.FilesFilterMenu').
        find('.dropdown-menu').
        should('not.exist');
});

Cypress.Commands.add('uiOpenFileFilterMenu', (item = '') => {
    // # Click on file filter button
    cy.uiGetFileFilterButton().click();

    if (!item) {
        // # Return the menu if no item is passed
        return cy.uiGetFileFilterMenu();
    }

    // # Click on a particular item
    return cy.uiGetFileFilterMenu().
        findByText(item).
        should('be.visible').
        click();
});
