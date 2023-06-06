// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('uiVerifyAtMentionInSuggestionList', (user, isSelected = false, sectionDividerName = null) => {
    // * Verify that the suggestion list is open and visible
    return cy.get('#suggestionList').should('be.visible').within(() => {
        if (sectionDividerName) {
            // * Verify the section name is as expected
            cy.get('.suggestion-list__divider').findByText(sectionDividerName).should('be.visible');
            cy.get('.suggestion-list__divider').next().findByTestId(`mentionSuggestion_${user.username}`).should('be.visible');
        }

        // * Verify that the user is selected
        return cy.uiVerifyAtMentionSuggestion(user, isSelected);
    });
});

Cypress.Commands.add('uiVerifyAtMentionSuggestion', (user, isSelected = false) => {
    const {
        username,
        first_name: firstName,
        last_name: lastName,
        nickname,
    } = user;

    // * Verify that the user is selected
    cy.findByTestId(`mentionSuggestion_${username}`).as('selectedMentionSuggestion').should('be.visible');
    if (isSelected) {
        cy.get('@selectedMentionSuggestion').should('have.class', 'suggestion--selected');
    }

    cy.get('@selectedMentionSuggestion').findByText(`@${username}`).should('be.visible');
    cy.get('@selectedMentionSuggestion').findByText(`${firstName} ${lastName} (${nickname})`).should('be.visible');

    return cy.findByTestId(`mentionSuggestion_${username}`);
});
