// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../../fixtures/timeouts';

/**
 * Fires off keyboard shortcut for "React to last message"
 * @param {String} from CENTER, RHS or body if not provided.
 */
export function doReactToLastMessageShortcut(from) {
    if (from === 'CENTER') {
        cy.uiGetPostTextBox().
            focus().
            clear().
            cmdOrCtrlShortcut('{shift}\\');
    } else if (from === 'RHS') {
        cy.uiGetReplyTextBox().
            focus().
            clear().
            cmdOrCtrlShortcut('{shift}\\');
    } else {
        cy.get('body').cmdOrCtrlShortcut('{shift}\\');
    }
    cy.wait(TIMEOUTS.HALF_SEC);
}

/**
 * Check if an emoji reaction was added to a post, defaults check for 'smile' emoji
 * @param {String} postId Post ID of the message
 * @param {String} emoji (Optional) Emoji name
 */
export function checkReactionFromPost(postId, emoji = 'smile') {
    if (postId) {
        cy.get(`#${postId}_message`).within(() => {
            cy.findByLabelText('reactions').should('exist');
            cy.findByLabelText(`remove reaction ${emoji}`).should('exist');
        });
    } else {
        cy.findByLabelText('reactions').should('exist');
        cy.findByLabelText(`remove reaction ${emoji}}`).should('exist');
    }
}

export function pressEscapeKey() {
    cy.get('body').type('{esc}');
}
