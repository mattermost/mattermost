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
    let testUser;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testUser = user;

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

    it('MM-T1273 - @[character]+TAB', () => {
        const userName = `${testUser.username}`;

        // # Enter the first characters of a user name
        cy.uiGetPostTextBox().clear().type('@' + userName.substring(0, 5)).wait(TIMEOUTS.HALF_SEC);

        // # Select the focused on user from the list using TAB
        cy.get('#suggestionList').should('be.visible').focused().tab();

        // # Verify that the correct user name has been selected
        cy.uiGetPostTextBox().should('contain', userName);

        // # Clear the message box
        cy.uiGetPostTextBox().clear();
    });

    it('MM-T1274 - :[character]+TAB', () => {
        const emojiName = ':tomato';

        // # Enter the first characters of an emoji name
        cy.uiGetPostTextBox().clear().type(emojiName.substring(0, 3)).wait(TIMEOUTS.HALF_SEC);

        // # Go down the list of emojis
        cy.get('body').type('{downarrow}').wait(TIMEOUTS.HALF_SEC);
        cy.get('body').type('{downarrow}').wait(TIMEOUTS.HALF_SEC);
        cy.get('body').type('{downarrow}').wait(TIMEOUTS.HALF_SEC);
        cy.get('body').type('{downarrow}').wait(TIMEOUTS.HALF_SEC);

        // # Select the fourth emoji from the top using TAB
        cy.get('#suggestionList').should('be.visible').focused().tab();

        // # Verify that the correct selection has been made
        cy.uiGetPostTextBox().should('contain', emojiName);
    });

    it('MM-T1275 - SHIFT+UP', () => {
        const message = `hello${Date.now()}`;

        // # Post message to center channel
        cy.postMessage(message);

        // # Press SHIFT+UP
        cy.uiGetPostTextBox().type('{shift}{uparrow}');

        // # Verify that the RHS reply box is focused
        cy.uiGetReplyTextBox().should('be.focused');

        // * Verify that the recently posted message is shown in the RHS
        cy.getLastPostId().then((postId) => {
            cy.get(`#rhsPostMessageText_${postId}`).should('exist');
        });
    });

    it('MM-T1279 - Keyboard shortcuts menu item', () => {
        // # Click "Keyboard shortcuts" at help menu
        cy.uiOpenHelpMenu('Keyboard shortcuts');

        modalShouldOpen();
    });
});

function modalShouldOpen() {
    const name = isMac() ? /Keyboard shortcuts ⌘ \// : /Keyboard shortcuts Ctrl \//;
    cy.findByRole('dialog', {name}).should('be.visible');
}
