// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @keyboard_shortcuts

import * as TIMEOUTS from '@/fixtures/timeouts';
import {isMac} from '@/utils';

describe('Keyboard Shortcuts', () => {
    let testTeam;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, otherUser.id);
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as admin and visit town-square
        cy.apiAdminLogin();
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T1239 - CTRL+/ and CMD+/ and /shortcuts', () => {
        // # Type CTRL/CMD+/
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('/');

        // # Verify that the 'Keyboard Shortcuts' modal is open
        modalShouldOpen();

        // # Verify that the 'Keyboard Shortcuts' modal displays the CTRL/CMD+U shortcut
        cy.get('.section').eq(2).within(() => {
            cy.findByText('Files').should('be.visible');
            cy.get('.shortcut-line').should('be.visible').as('shortcutLine');
            if (isMac()) {
                cy.get('@shortcutLine').findByText('⌘').should('be.visible');
            } else {
                cy.get('@shortcutLine').findByText('Ctrl').should('be.visible');
            }
            cy.get('@shortcutLine').findByText('U').should('be.visible');
        });

        // # Type CTRL/CMD+/ to close the 'Keyboard Shortcuts' modal
        cy.get('body').cmdOrCtrlShortcut('/');
        cy.get('#shortcutsModalLabel').should('not.exist');

        // # Type /shortcuts
        cy.uiGetPostTextBox().clear().type('/shortcuts{enter}');
        modalShouldOpen();

        // # Close the 'Keyboard Shortcuts' modal using the x button
        cy.get('.modal-header button.close').should('have.attr', 'aria-label', 'Close').click();
        cy.get('#shortcutsModalLabel').should('not.exist');

        // # Type /shortcuts
        cy.uiGetPostTextBox().clear().type('/shortcuts{enter}');

        // # Close the 'Keyboard Shortcuts' modal by pressing ESC key
        cy.get('body').type('{esc}');
        cy.get('#shortcutsModalLabel').should('not.exist');
    });

    it('MM-T1254 - CTRL/CMD+UP; CTRL/CMD+DOWN', () => {
        const messagePrefix = 'hello from current user: ';
        let message;
        const count = 5;

        // # Post messages to the center channel
        for (let index = 0; index < count; index++) {
            message = messagePrefix + index;
            cy.postMessage(message);
        }

        for (let index = 0; index < count; index++) {
            // # Type CTRL/CMD+UP
            cy.uiGetPostTextBox().cmdOrCtrlShortcut('{uparrow}');

            // # Verify that the previous message is displayed
            message = messagePrefix + (4 - index);
            cy.uiGetPostTextBox().contains(message);
        }

        // # One extra CTRL/CMD+UP does not change the displayed message
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('{uparrow}');
        message = messagePrefix + '0';
        cy.uiGetPostTextBox().contains(message);

        for (let index = 1; index < count; index++) {
            // # Type CTRL/CMD+DOWN
            cy.uiGetPostTextBox().cmdOrCtrlShortcut('{downarrow}');

            // # Verify that the next message is displayed
            message = messagePrefix + index;
            cy.uiGetPostTextBox().contains(message);
        }
    });

    it('MM-T1260 - UP arrow', () => {
        const message = 'Test';
        const editMessage = 'Edit Test';

        // # Post message text
        cy.uiGetPostTextBox().clear().type(message).type('{enter}').wait(TIMEOUTS.HALF_SEC);

        // # Edit previous post
        cy.getLastPostId().then(() => {
            cy.uiGetPostTextBox().type('{uparrow}');

            // * Edit Post Input should appear
            cy.get('#edit_textbox').should('be.visible');

            // * Edit to the post message and type ENTER
            cy.get('#edit_textbox').invoke('val', '').clear().type(editMessage).type('{enter}').wait(TIMEOUTS.HALF_SEC);
        });

        cy.getLastPostId().then((postId) => {
            // * Post should have "Edited"
            cy.get(`#postEdited_${postId}`).
                should('be.visible').
                should('contain', 'Edited');
        });
    });
});

function modalShouldOpen() {
    const name = isMac() ? /Keyboard shortcuts ⌘ \// : /Keyboard shortcuts Ctrl \//;
    cy.findByRole('dialog', {name}).should('be.visible');
}
