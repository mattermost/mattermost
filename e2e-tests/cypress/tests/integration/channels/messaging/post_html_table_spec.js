// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Post HTML', () => {
    before(() => {
        // # Create new team and new user and visit Town Square channel
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('Pasting HTML table in message box should not trigger CSP violation', () => {
        cy.document().then(($document) => {
            $document.addEventListener('securitypolicyviolation', () => {
                throw new Error('should not have triggered violation');
            });
        });

        // # Paste HTML data from clipboard to the message box.
        cy.uiGetPostTextBox().trigger('paste', {clipboardData: {
            items: [1],
            types: ['text/html'],
            getData: () => '<table><img src="null" onerror="alert(\'xss\')" /></table>',
        }}).wait(TIMEOUTS.TEN_SEC);
    });
});
