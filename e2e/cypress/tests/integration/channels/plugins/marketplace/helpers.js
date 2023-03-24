// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function verifyPluginMarketplaceVisibility(shouldBeVisible) {
    cy.uiOpenProductMenu().within(() => {
        if (shouldBeVisible) {
            // * Verify Marketplace button should exist
            cy.findByText('Marketplace').should('exist');
        } else {
            // * Verify Marketplace button should not exist
            cy.findByText('Marketplace').should('not.exist');
        }
    });
}
