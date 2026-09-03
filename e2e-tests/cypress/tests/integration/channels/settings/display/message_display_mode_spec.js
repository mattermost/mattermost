// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

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

        // # Add ",edited" to the text and save
        const editMessage = ',edited';
        cy.get('#edit_textbox').should('be.visible').type(editMessage);
        cy.get('#edit_textbox').should('contain.value', editMessage);
        cy.get('#create_post').findByText('Save').should('be.enabled').click();

        // * Verify posted message includes newline, edit message and "Edited" indicator
        cy.get(postMessageTextId).should('have.text', `${firstLine}\n${secondLine}${editMessage} Edited`);

        // Compact view can clip the indicator; assert it is mounted with the Edited label.
        cy.get(`#post_${postId}`).scrollIntoView();
        cy.get(`#postEdited_${postId}`).should('exist').and('contain', 'Edited');
    });
}
