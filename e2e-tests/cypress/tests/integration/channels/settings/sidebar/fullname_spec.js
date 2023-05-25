// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

import {getRandomId} from '../../../../utils';

describe('Settings > Sidebar > General', () => {
    const randomId = getRandomId();
    const newFirstName = `정트리나${randomId}/trina.jung/집단사무국(CO)`;

    let testUser;
    let otherUser;
    let offTopicUrl;

    before(() => {
        cy.apiInitSetup().then(({team, user, offTopicUrl: url}) => {
            testUser = user;
            offTopicUrl = url;

            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;
                cy.apiAddUserToTeam(team.id, otherUser.id);
            });

            // # Login as test user, visit off-topic and go to the Profile
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.uiOpenProfileModal('Profile Settings');

            // # Open Full Name section
            cy.get('#nameDesc').click();

            // # Set first name value
            cy.get('#firstName').clear().type(newFirstName);

            // # Save form
            cy.uiSave();
        });
    });

    it('MM-T183 Filtering by first name with Korean characters', () => {
        const {username} = testUser;

        cy.apiLogin(otherUser);
        cy.visit(offTopicUrl);

        // # Type in user's first name substring
        cy.uiGetPostTextBox().clear().type(`@${newFirstName.substring(0, 11)}`);

        // * Verify that the testUser is selected from mention autocomplete
        cy.uiVerifyAtMentionInSuggestionList({...testUser, first_name: newFirstName}, true);

        // # Press tab on text input
        cy.uiGetPostTextBox().tab();

        // * Verify that after enter user's username match
        cy.uiGetPostTextBox().should('have.value', `@${username} `);

        // # Click enter in post textbox
        cy.uiGetPostTextBox().type('{enter}');

        // * Verify that message has been post in chat
        cy.get(`[data-mention="${username}"]`).
            last().
            scrollIntoView().
            should('be.visible');
    });
});
