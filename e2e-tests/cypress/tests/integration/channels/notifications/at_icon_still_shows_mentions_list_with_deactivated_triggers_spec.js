// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notifications

describe('Notifications', () => {
    let testTeam;
    let otherUser;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team, user}) => {
            testTeam = team;
            otherUser = user;

            cy.visit(`/${testTeam.name}`);

            // # Open 'Settings' modal
            cy.uiOpenSettingsModal().within(() => {
                // # Open 'Keywords that trigger Notifications' setting and uncheck all the checkboxes
                cy.findByRole('heading', {name: 'Keywords that trigger Notifications'}).should('be.visible').click();
                cy.findByRole('checkbox', {name: `Your case-sensitive first name "${otherUser.first_name}"`}).should('not.be.checked');
                cy.findByRole('checkbox', {name: `Your non case-sensitive username "${otherUser.username}"`}).should('not.be.checked');
                cy.findByRole('checkbox', {name: 'Channel-wide mentions "@channel", "@all", "@here"'}).click().should('not.be.checked');
                cy.findByRole('checkbox', {name: 'Other non case-sensitive words, press Tab or use commas to separate keywords:'}).should('not.be.checked');

                // # Save then close the modal
                cy.uiSaveAndClose();
            });

            cy.apiLogout();

            // # Login as sysadmin
            cy.apiAdminLogin();
            cy.visit(`/${testTeam.name}`);
        });
    });

    it('MM-T550 Words that trigger mentions - @-icon still shows mentions list if all triggers deselected', () => {
        const text = `${otherUser.username} test message!`;

        // # Type @ in the input box
        cy.focused().type('@');

        // * Make sure that the suggestion list is visible and that otherUser's username is visible
        cy.get('#suggestionList').should('be.visible').within(() => {
            cy.findByText(`@${otherUser.username}`).should('be.visible');
        });

        // # Post the text that was declared earlier and logout from sysadmin account
        cy.focused().type(`${text}{enter}{enter}`);
        cy.apiLogout();

        // # Login as otherUser and visit the team
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}`);

        // # Click on the @ button
        cy.uiGetRecentMentionButton().click();

        cy.get('#search-items-container').should('be.visible').within(() => {
            // * Ensure that the mentions are visible in the RHS
            cy.findByText(`@${otherUser.username}`).should('be.visible');
            cy.findByText('test message!').should('be.visible');
        });
    });
});

