// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import {stubClipboard} from '../../utils';

describe('Permalink message edit', () => {
    before(() => {
        cy.apiInitSetup().then(({channelUrl}) => {
            // # Go to test channel
            cy.visit(channelUrl);
        });
    });

    it('MM-T4688 Copy Text menu item should copy post message to clipboard', () => {
        stubClipboard().as('clipboard');

        // # Post a message
        const message = Date.now().toString();
        cy.postMessage(message);
        cy.getLastPostId().as('postId1');

        // # Post another message
        const message2 = Date.now().toString();
        cy.postMessage(message2);
        cy.getLastPostId().as('postId2');

        // # Post several messages so that dropdown menu can be seen when rendered at the bottom (Cypress limitation)
        Cypress._.times(10, (n) => {
            cy.uiPostMessageQuickly(n);
        });

        cy.get('@postId1').then((postId) => {
            // # Copy message by clicking
            cy.uiClickPostDropdownMenu(postId, 'Copy Text');

            // * Ensure that the clipboard contents are correct
            verifyClipboard(message);
        });

        cy.get('@postId2').then((postId) => {
            // # Copy by keyboard shortcut
            cy.clickPostDotMenu(postId, 'CENTER');
            cy.get('body').type('c');

            // * Ensure that the clipboard contents are correct
            verifyClipboard(message2);
        });
    });

    // Instead of external Apps we are testing the clipboard directly, to ensure the copied text is correct
    it('MM-T1615 Pasting code block text into external apps does not include line numbers', () => {
        stubClipboard().as('clipboard');
        const postCodeBlock = '```javascript\nvar foo = "bar"\nfunction doSomething()\nreturn 7;\n}\n```';
        const copiedCodeBlockText = 'var foo = "bar"\nfunction doSomething()\nreturn 7;\n}\n';

        // # Post the code block
        cy.postMessage(postCodeBlock);
        cy.getLastPostId().as('postId1');

        // # Copy message by clicking 'Copy code Block' icon
        cy.get('@postId1').then((postId) => {
            cy.get(`#postMessageText_${postId}`).click();
            cy.get('i.icon.icon-content-copy').invoke('show').click();
            cy.get('@clipboard').its('contents').then((contents) => {
                // * Verify clipboard content does not have extra quotes
                expect(contents.trim()).to.equal(copiedCodeBlockText.trim());
            });
        });
    });
});

function verifyClipboard(message) {
    cy.get('@clipboard').its('wasCalled').should('eq', true);
    cy.get('@clipboard').its('contents').should('eq', message);
}
