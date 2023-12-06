// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('uiGetPaymentCardInput', () => {
    return cy.
        get('.__PrivateStripeElement > iframe').
        its('0.contentDocument.body').should('not.be.empty').
        then(cy.wrap);
});
