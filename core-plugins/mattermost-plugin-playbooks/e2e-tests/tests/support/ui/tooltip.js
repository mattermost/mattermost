// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('uiGetToolTip', (text) => {
    cy.findByRole('tooltip').should('contain', text);
});
