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

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit off-topic channel
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T98 - Typing should show up right away when editing a message using the up arrow', () => {
        // # Post a message in the channel
        cy.postMessage('test post 1');

        // # Press the up arrow to open the edit modal
        cy.uiGetPostTextBox().type('{uparrow}');

        // # Immediately after opening the edit modal, type more text and assert that the text has been inputted
        cy.get('#edit_textbox').type(' and test post 2').should('have.text', 'test post 1 and test post 2');

        // # finish editing
        cy.get('#edit_textbox').wait(TIMEOUTS.HALF_SEC).type('{enter}');

        // # Get the last post and check that none of the text was cut off after being edited
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('have.text', 'test post 1 and test post 2 Edited');
        });
    });
});
