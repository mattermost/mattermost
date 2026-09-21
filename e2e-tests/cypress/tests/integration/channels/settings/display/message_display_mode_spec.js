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

    const firstLine = `First line ${Date.now()}`;
    const secondLine = 'Second line';

    // # Enter in text
    cy.uiGetPostTextBox().clear();
    cy.uiGetPostTextBox().type(firstLine);
    cy.uiGetPostTextBox().type('{shift}{enter}{enter}');
    cy.uiGetPostTextBox().type(secondLine);
    cy.uiGetPostTextBox().should('contain.value', firstLine).and('contain.value', secondLine);

    // # Send the message
    cy.intercept('POST', '**/api/v4/posts').as('createPost');
    cy.findByTestId('SendMessageButton').should('be.enabled').click();
    cy.wait('@createPost').its('response.statusCode').should('eq', 201);

    // # Get last postId
    cy.contains('[data-testid="postView"]', firstLine).should('be.visible').invoke('attr', 'id').then((rawId) => {
        const postId = (rawId || '').replace(/^post_/, '');
        const postMessageTextId = `#postMessageText_${postId}`;

        // * Verify text still includes new line
        cy.get(postMessageTextId).should('have.text', `${firstLine}\n${secondLine}`);

        // # click dot menu button
        cy.clickPostDotMenu(postId);

        // # click edit post
        cy.get(`#edit_post_${postId}`).should('exist').click({force: true});

        // # Add ",edited" to the text
        const editMessage = ',edited';
        cy.get('#edit_textbox').should('be.visible').type(editMessage);
        cy.get('#edit_textbox').should('contain.value', editMessage);

        // # finish editing
        cy.get('[data-testid="post-edit-container"] button.save').should('be.visible').click();

        // * Verify posted message includes newline, edit message and "Edited" indicator
        cy.get(postMessageTextId).should('have.text', `${firstLine}\n${secondLine}${editMessage} Edited`);

        // * Post should have "Edited"
        cy.get(`#post_${postId}`).scrollIntoView();
        cy.get(`#postEdited_${postId}`).should('exist').and('contain', 'Edited');
    });
}
