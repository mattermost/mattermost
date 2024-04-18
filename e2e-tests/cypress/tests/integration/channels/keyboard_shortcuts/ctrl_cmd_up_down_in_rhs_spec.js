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
            // # Visit a test channel
            cy.visit(channelUrl);
        });
    });

    it('MM - T1257 CTRL / CMD + UP or DOWN in RHS', () => {
        const firstMessage = 'Hello World!';
        const messages = ['This', 'is', 'an', 'e2e test', '/shrug'];

        // # Post a message in the central textbox
        cy.postMessage(firstMessage);

        cy.getLastPostId().then((postId) => {
            // # Open RHS
            cy.clickPostDotMenu(postId);
            cy.findByText('Reply').click();

            // * Confirm that reply text box has focus
            cy.findByTestId('reply_textbox').should('be.focused');

            // * Verify RHS is opened
            cy.uiGetRHS().within(() => {
                for (let idx = 0; idx < messages.length; idx++) {
                    // # Post each message as a reply
                    cy.findByTestId('reply_textbox').
                        type(messages[idx]).
                        type('{enter}').
                        clear();
                }

                // * Confirm that reply textbox has focus
                cy.findByTestId('reply_textbox').should('be.focused').clear();

                // # Press CTRL/CMD + uparrow repeatedly
                let previousMessageIndex = messages.length - 1;
                for (let idx = 0; idx <= messages.length; idx++) {
                    if (idx === messages.length) {
                        // * Check if the last message is equal to the first message
                        cy.findByTestId('reply_textbox').cmdOrCtrlShortcut('{uparrow}');
                        cy.findByTestId('reply_textbox').should('have.text', firstMessage);
                        break;
                    }
                    if (messages[previousMessageIndex] === '/shrug') {
                        cy.findByTestId('reply_textbox').click();
                    }
                    cy.findByTestId('reply_textbox').cmdOrCtrlShortcut('{uparrow}');

                    // * Check if the message is equal to the last message
                    cy.findByTestId('reply_textbox').should('have.text', messages[previousMessageIndex]);

                    previousMessageIndex--;
                }

                // * Press CTRL/CMD + downarrow check if the current text is equal to the second message
                cy.findByTestId('reply_textbox').cmdOrCtrlShortcut('{downarrow}').should('have.text', messages[0]);

                // # Close the RHS
                cy.uiCloseRHS().wait(TIMEOUTS.HALF_SEC);
            });

            // * Press CTRL/CMD + uparrow in central textbox check if the text is equal to the last message
            cy.findByTestId('post_textbox').cmdOrCtrlShortcut('{uparrow}').should('have.text', messages[messages.length - 1]);
        });
    });
});
