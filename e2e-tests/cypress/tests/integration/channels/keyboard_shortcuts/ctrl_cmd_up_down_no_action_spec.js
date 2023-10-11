// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @keyboard_shortcuts

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Keyboard Shortcuts', () => {
    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            // # Visit test channel
            cy.visit(channelUrl);
        });
    });

    it('MM-T1255 CTRL/CMD+UP or DOWN no action on draft post', () => {
        const message = 'Test message from User 1';

        // # Type a message in the input box but do not post it
        cy.uiGetPostTextBox().type(message).wait(TIMEOUTS.ONE_SEC);

        // # Press CMD/CTRL+DOWN arrow
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('{downarrow}');

        // * Check the focus after pressing CTRL/CMD + DOWN then check match the text and the cursor position respectively
        cy.uiGetPostTextBox().
            should('be.focused').
            and('have.text', message).
            and('have.prop', 'selectionStart', message.length).
            and('have.prop', 'selectionEnd', message.length);

        // # Press CMD/CTRL+UP arrow
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('{uparrow}');

        // * Check the focus after pressing CTRL/CMD + UP then check match the text and the cursor position respectively
        cy.uiGetPostTextBox().
            should('be.focused').
            and('have.text', message).
            and('have.prop', 'selectionStart', 0).
            and('have.prop', 'selectionEnd', 0);
    });
});
