// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @keyboard_shortcuts

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Keyboard Shortcuts', () => {
    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            // # Visit a test channel
            cy.visit(channelUrl);
        });
    });

    it('MM-T1243 CTRL/CMD+K - Open public channel using arrow keys and Enter, click out of current channel message box first', () => {
        // # To remove focus from message text box
        cy.get('#postListContent').click();
        cy.uiGetPostTextBox().should('not.be.focused');

        // # Press CTRL/CMD+K
        cy.get('body').cmdOrCtrlShortcut('K');
        cy.get('#quickSwitchInput').type('T');

        // # Press down arrow
        cy.wait(TIMEOUTS.HALF_SEC);
        cy.get('body').type('{downarrow}');
        cy.get('body').type('{downarrow}');

        // * Confirm the offtopic channel is selected in the suggestion list
        cy.get('#suggestionList').findByTestId('off-topic').should('be.visible').and('have.class', 'suggestion--selected');

        // # Press ENTER
        cy.get('body').type('{enter}');

        // * Confirm that channel is open, and post text box has focus
        cy.contains('#channelHeaderTitle', 'Off-Topic');
        cy.uiGetPostTextBox().should('be.focused');
    });
});
