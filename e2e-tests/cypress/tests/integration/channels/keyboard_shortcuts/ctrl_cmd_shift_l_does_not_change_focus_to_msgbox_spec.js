// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @keyboard_shortcuts

describe('Keyboard Shortcuts', () => {
    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            // # Visit a test channel
            cy.visit(channelUrl);
        });
    });

    it('MM-T1251 CTRL/CMD+SHIFT+L - When not to set focus to center channel message box', () => {
        // # Open settings modal
        cy.uiOpenSettingsModal();

        // # Press ctrl/cmd+shift+l
        cy.get('body').cmdOrCtrlShortcut('{shift+l}');

        // * Verify channel message box is not focused
        cy.uiGetPostTextBox().should('not.be.focused');

        // # Close settings modal
        cy.uiClose();

        // # Open invite members full-page screen
        cy.findByLabelText('Invite Users').click();

        // # Press ctrl/cmd+shift+l
        cy.get('body').cmdOrCtrlShortcut('{shift+l}');

        // * Verify channel message box is not focused
        cy.uiGetPostTextBox().should('not.be.focused');

        // # Close invite members full-page screen
        cy.uiClose();
    });
});
