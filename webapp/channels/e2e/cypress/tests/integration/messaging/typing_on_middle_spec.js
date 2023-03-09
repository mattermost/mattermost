// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit Off-Topic
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);
        });
    });

    it('MM-T96 Trying to type in middle of text should not send the cursor to end of textbox', () => {
        // # Type message to use
        cy.uiGetPostTextBox().clear().type('aa');

        // # Move the cursor and keep typing
        cy.uiGetPostTextBox().click().type('{leftarrow}b');

        // # Wait for the cursor to move in failing case
        cy.wait(TIMEOUTS.FIVE_SEC);

        // # Write another letter
        cy.uiGetPostTextBox().type('c');

        // * Should contain abca instead of aabc or abac
        cy.uiGetPostTextBox().should('contain', 'abca');
    });
});
