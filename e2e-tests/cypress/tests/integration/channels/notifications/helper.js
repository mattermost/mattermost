// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function changeDesktopNotificationAs(category) {
    // # Open settings modal
    cy.uiOpenSettingsModal().within(() => {
        // # Click "Desktop Notifications"
        cy.findByText('Desktop Notifications').should('be.visible').click();

        // # Select category.
        cy.get(category).check();

        // # Click "Save" and close the modal
        cy.uiSaveAndClose();
    });
}

export function changeTeammateNameDisplayAs(category) {
    // # Open settings modal
    cy.uiOpenSettingsModal('Display').within(() => {
        // # Click "Desktop"
        cy.findByText('Teammate Name Display').click();

        // # Select category.
        cy.get(category).check();

        // # Click "Save" and close the modal
        cy.uiSaveAndClose();
    });
}
