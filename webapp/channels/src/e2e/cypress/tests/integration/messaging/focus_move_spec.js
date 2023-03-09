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
    let offTopicUrl;
    let testChannelName;

    before(() => {
        // # Login as test user
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            offTopicUrl = out.offTopicUrl;
            testChannelName = out.channel.display_name;
        });
    });

    beforeEach(() => {
        cy.visit(offTopicUrl);
    });

    it('MM-T200 Focus move to main input box when a character key is selected', () => {
        // # Post a message
        cy.postMessage('Hello');

        // # Click the save icon to move focus out of the main input box
        cy.uiGetSavedPostButton().click();
        cy.uiGetPostTextBox().should('not.be.focused');

        // # Push a character key such as "A"
        // # Expect to have "A" value in main input
        cy.get('body').type('A');
        cy.uiGetPostTextBox().should('be.focused');

        // # Click the @-mention icon to move focus out of the main input box
        cy.uiGetRecentMentionButton().click();
        cy.uiGetPostTextBox().should('not.be.focused');

        // # Push a character key such as "B"
        // # Expect to have "B" value in main input
        cy.get('body').type('B');
        cy.uiGetPostTextBox().should('be.focused');
    });

    it('MM-T204 Focus will move to main input box after a new channel has been opened', () => {
        // # Post a new message
        cy.postMessage('new post');

        // # Open the reply thread on the most recent post
        cy.clickPostCommentIcon();

        // # Place the focus inside the RHS input box
        cy.uiGetReplyTextBox().focus().should('be.focused');

        // # Use CTRL+K or CMD+K to open the channel switcher depending on OS
        cy.typeCmdOrCtrl().type('K', {release: true});

        // * Verify channel switcher is visible
        cy.get('#quickSwitchHint').should('be.visible');

        // # Type channel name and select it
        cy.findByRole('textbox', {name: 'quick switch input'}).type(testChannelName).wait(TIMEOUTS.HALF_SEC).type('{enter}');

        // * Verify that it redirected into selected channel
        cy.get('#channelHeaderTitle').should('be.visible').should('contain', testChannelName);

        // * Verify focus is moved to main input box when the channel is opened
        cy.uiGetPostTextBox().should('be.focused');
    });

    it('MM-T205 Focus to remain in RHS textbox each time Reply arrow is clicked', () => {
        // # Post a new message
        cy.postMessage('new post');

        // # Open the reply thread on the most recent post
        cy.clickPostCommentIcon();

        // * Verify RHS textbox is focused the first time Reply arrow is clicked
        cy.uiGetReplyTextBox().should('be.focused');

        // # Focus away from RHS textbox
        cy.get('#rhsContainer .post-right__content').click();

        // # Click reply arrow on post in same thread
        cy.clickPostCommentIcon();

        // * Verify RHS textbox is again focused the second time, when already open
        cy.uiGetReplyTextBox().should('be.focused');
    });

    it('MM-T203 Focus does not move when it has already been set elsewhere', () => {
        // # Verify Focus in add channel member modal
        verifyFocusInAddChannelMemberModal();
    });

    it('MM-T202 Focus does not move for non-character keys', () => {
        // # Post a message
        cy.postMessage('Hello');

        // # Click the save icon to move focus out of the main input box
        cy.uiGetSavedPostButton().click();
        cy.uiGetPostTextBox().should('not.be.focused');

        // Keycodes for keys that don't have a special character sequence for cypress.type()
        const numLockKeycode = 144;
        const f7Keycode = 118;
        const windowsKeycode = 91;

        [numLockKeycode, f7Keycode, windowsKeycode].forEach((keycode) => {
            // # Trigger keydown event using keycode
            cy.get('body').trigger('keydown', {keyCode: keycode, which: keycode});

            // # Make sure main input is not focused
            cy.uiGetPostTextBox().should('not.be.focused');
        });

        // For other keys we can use cypress.type() with a special character sequence.
        ['{downarrow}', '{pagedown}', '{shift}', '{pageup}', '{enter}'].forEach((key) => {
            // # Type special character key using Cypress special character sequence
            cy.get('body').type(key);

            // # Make sure main input is not focused
            cy.uiGetPostTextBox().should('not.be.focused');
        });
    });
});

function verifyFocusInAddChannelMemberModal() {
    // # Click to access the Channel menu
    cy.get('#channelHeaderTitle').click();

    // * The dropdown menu of the channel header should be visible;
    cy.get('#channelLeaveChannel').should('be.visible');

    // # Click 'Add Members'
    cy.get('#channelAddMembers').click();

    // * Assert that modal appears
    cy.get('#addUsersToChannelModal').should('be.visible');

    // * Assert that the input box is in focus
    cy.get('#selectItems input').should('be.focused');

    // # Push a character key such as "A"
    cy.focused().typeWithForce('A');

    // * Check that input box has character A
    cy.get('#selectItems input').should('have.value', 'A');

    // # Click anywhere in the modal that is not on a field that can take focus
    cy.get('.channel-invite__header').click();

    // * Note the focus has been removed from the search box
    cy.get('#selectItems input').should('not.be.focused');

    // # Push a character key such as "A"
    cy.get('body').type('A');

    // * Focus is not moved anywhere. Neither the search box or main input box has the focus
    cy.get('#selectItems input').should('not.be.focused').and('have.value', 'A');
    cy.uiGetPostTextBox().should('not.be.focused');
}
