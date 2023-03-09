// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @account_setting

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Settings > Display > Message Display', () => {
    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T103_1 Compact view: Line breaks remain intact after editing', () => {
        // * Verify line breaks do not change and blank line is still there in compact view.
        verifyLineBreaksRemainIntact('COMPACT');
    });

    it('MM-T103_2 Standard view: Line breaks remain intact after editing', () => {
        // * Verify line breaks do not change and blank line is still there in standard view.
        verifyLineBreaksRemainIntact('STANDARD');
    });
});

function verifyLineBreaksRemainIntact(display) {
    cy.uiChangeMessageDisplaySetting(display);

    const firstLine = 'First line';
    const secondLine = 'Second line';

    // # Enter in text
    cy.uiGetPostTextBox().
        clear().
        type(firstLine).
        type('{shift}{enter}{enter}').
        type(`${secondLine}{enter}`);

    // # Get last postId
    cy.getLastPostId().then((postId) => {
        const postMessageTextId = `#postMessageText_${postId}`;

        // * Verify text still includes new line
        cy.get(postMessageTextId).should('have.text', `${firstLine}\n${secondLine}`);

        // # click dot menu button
        cy.clickPostDotMenu(postId);

        // # click edit post
        cy.get(`#edit_post_${postId}`).scrollIntoView().should('be.visible').click();

        // # Add ",edited" to the text
        const editMessage = ',edited';
        cy.get('#edit_textbox').type(editMessage);

        // # finish editing
        cy.get('#edit_textbox').wait(TIMEOUTS.HALF_SEC).type('{enter}');

        // * Verify posted message includes newline, edit message and "Edited" indicator
        cy.get(postMessageTextId).should('have.text', `${firstLine}\n${secondLine}${editMessage} Edited`);

        // * Post should have "Edited"
        cy.get(`#postEdited_${postId}`).
            should('be.visible').
            should('contain', 'Edited');
    });
}
