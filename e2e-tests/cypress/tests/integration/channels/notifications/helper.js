// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function changeDesktopNotificationAs(category) {
    // # Open settings modal
    cy.uiOpenSettingsModal().within(() => {
        // # Click "Desktop and mobile notifications"
        cy.findByText('Desktop and mobile notifications').should('be.visible').click();

        cy.get('#sendDesktopNotificationsSection').should('exist').within(() => {
            if (category === 'all') {
                // # Click "For all All new messages"
                cy.findByText('All new messages').should('be.visible').click({force: true});
            } else if (category === 'mentions') {
                // # Click "For mentions"
                cy.findByText('Mentions, direct messages, and group messages').should('be.visible').click({force: true});
            } else if (category === 'nothing') {
                // # Click "For nothing"
                cy.findByText('Nothing').should('be.visible').click({force: true});
            }
        });

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
