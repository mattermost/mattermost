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
    cy.intercept('POST', '**/api/v4/posts').as('createPost');
    cy.findByTestId('SendMessageButton').should('be.enabled').click();
    cy.wait('@createPost').its('response.statusCode').should('eq', 201);

    // Pin to the posted text so a later join system message is not treated as last.
    cy.contains('[data-testid="postView"]', firstLine).should('be.visible').invoke('attr', 'id').then((rawId) => {
        const postId = (rawId || '').replace(/^post_/, '');
        const postMessageTextId = `#postMessageText_${postId}`;

        // * Verify text still includes new line
        cy.get(postMessageTextId).should('have.text', `${firstLine}\n${secondLine}`);

        // # click dot menu button
        cy.clickPostDotMenu(postId);

        // Menu items remount when the post list updates; click the edit action by id.
        cy.get(`#edit_post_${postId}`).should('exist').click({force: true});

        // # Add ",edited" to the text and save
        const editMessage = ',edited';
        cy.get('#edit_textbox').should('be.visible').type(editMessage);
        cy.get('#edit_textbox').should('contain.value', editMessage);
        cy.get('[data-testid="post-edit-container"] button.save').should('be.visible').click();

        // * Verify posted message includes newline, edit message and "Edited" indicator
        cy.get(postMessageTextId).should('have.text', `${firstLine}\n${secondLine}${editMessage} Edited`);

        // Compact view can clip the indicator; assert it is mounted with the Edited label.
        cy.get(`#post_${postId}`).scrollIntoView();
        cy.get(`#postEdited_${postId}`).should('exist').and('contain', 'Edited');
    });
}
