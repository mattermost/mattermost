// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {stubClipboard} from '../../utils';

Cypress.Commands.add('uiClickCopyLink', (permalink, postId) => {
    stubClipboard().as('clipboard');

    // * Verify initial state
    cy.get('@clipboard').its('contents').should('eq', '');

    // # Click on "Copy Link"
    cy.get(`#CENTER_dropdown_${postId}`).should('be.visible').within(() => {
        cy.findByText('Copy Link').scrollIntoView().should('be.visible').click();

        // * Verify if it's called with correct link value
        cy.get('@clipboard').its('wasCalled').should('eq', true);
        cy.get('@clipboard').its('contents').should('eq', permalink);
    });
});

Cypress.Commands.add('uiClickPostDropdownMenu', (postId, menuItem, location = 'CENTER') => {
    cy.clickPostDotMenu(postId, location);
    cy.findAllByTestId(`unread_post_${postId}`).eq(0).should('be.visible');
    cy.findByText(menuItem).scrollIntoView().should('be.visible').click({force: true});
});

Cypress.Commands.add('uiPostDropdownMenuShortcut', (postId, menuText, shortcutKey, location = 'CENTER') => {
    cy.clickPostDotMenu(postId, location);
    cy.findByText(menuText).scrollIntoView().should('be.visible');
    cy.get('body').type(shortcutKey);
});
