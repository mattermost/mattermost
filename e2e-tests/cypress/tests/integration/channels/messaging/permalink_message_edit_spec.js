// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Permalink message edit', () => {
    let testTeam;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            });
        });
    });

    it('MM-T180 Edit a message in permalink view', () => {
        // # Login as test user and visit town-square
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/town-square`);

        const searchWord = `searchtest ${Date.now()}`;

        // # Post message
        cy.postMessage(searchWord);

        // # Search for searchWord
        cy.uiGetSearchContainer().click();
        cy.uiGetSearchBox().type(searchWord).type('{enter}');

        // # Jump to permalink view
        cy.get('.search-item__jump').first().click();

        cy.getLastPostId().then((postId) => {
            // # Check if url include the permalink
            cy.url().should('include', `/${testTeam.name}/channels/town-square/${postId}`);

            // # Click on ... button of last post matching the searchWord
            cy.clickPostDotMenu(postId);

            // # Click on edit post
            cy.get(`#edit_post_${postId}`).click();

            const editedText = `edited - ${searchWord}`;

            // # Add new text in edit box and finish by hitting enter
            cy.get('#edit_textbox').should('be.visible').type('any').click().focused().clear({force: true}).type(editedText).type('{enter}');

            // # Check edited post
            verifyEditedPermalink(postId, editedText, testTeam);

            // # Login as other user, visit town-square and post any message
            cy.apiLogin(otherUser);
            cy.visit(`/${testTeam.name}/channels/town-square`);
            cy.postMessage('hello');

            // # Find searchWord and verify edited post
            cy.uiGetSearchContainer().click();
            cy.uiGetSearchBox().should('be.visible').first().type(searchWord).type('{enter}');
            cy.get('.search-item__jump').first().click();

            // # Check if url include the permalink
            cy.url().should('include', `/${testTeam.name}/channels/town-square/${postId}`);

            verifyEditedPermalink(postId, editedText, testTeam);
        });
    });

    function verifyEditedPermalink(permalinkId, text, team) {
        // * Check if url redirects back to parent path eventually
        cy.wait(TIMEOUTS.FIVE_SEC).url().should('include', `/${team.name}/channels/town-square`).and('not.include', `/${permalinkId}`);

        // * Verify edited post
        cy.get(`#postMessageText_${permalinkId}`).should('have.text', `${text} Edited`);
        cy.get(`#postEdited_${permalinkId}`).should('have.text', 'Edited');
    }
});
