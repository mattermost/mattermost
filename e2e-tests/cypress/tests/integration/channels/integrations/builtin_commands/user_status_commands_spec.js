// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @integrations

describe('Integrations', () => {
    const testCases = [
        {command: '/away', badgeClassName: 'userAccountMenu_statusBadge--away', message: 'You are now away'},
        {command: '/dnd', badgeClassName: 'userAccountMenu_statusBadge--do-not-disturb', message: 'Do Not Disturb is enabled. You will not receive desktop or mobile push notifications until Do Not Disturb is turned off.'},
        {command: '/offline', badgeClassName: 'userAccountMenu_statusBadge--offline', message: 'You are now offline'},
        {command: '/online', badgeClassName: 'userAccountMenu_statusBadge--online', message: 'You are now online'},
    ];

    let offTopicUrl;

    before(() => {
        // # Login as test user
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl: url}) => {
            offTopicUrl = url;
        });
    });

    beforeEach(() => {
        // Ensure that the user is set to 'online' before starting each testcase
        cy.apiUpdateUserStatus('online');
    });

    it('I18456 Built-in slash commands: change user status via post', () => {
        cy.apiSaveMessageDisplayPreference('compact');
        cy.visit(offTopicUrl);

        testCases.forEach((testCase) => {
            cy.postMessage(testCase.command + ' ');

            verifyUserStatus(testCase, true);
        });
    });

    it('I18456 Built-in slash commands: change user status via suggestion list', () => {
        cy.apiSaveMessageDisplayPreference('clean');
        cy.visit(offTopicUrl);

        testCases.forEach((testCase) => {
            // # Type "/" on textbox
            cy.uiGetPostTextBox().clear().type('/');

            // # Verify that the suggestion list is visible
            cy.get('#suggestionList').should('be.visible').then((container) => {
                // # Find command and click
                cy.contains(new RegExp(testCase.command), {container}).click({force: true});
            });

            // # Hit enter and verify user status
            cy.uiGetPostTextBox().type(' {enter}');
            verifyUserStatus(testCase, false);
        });
    });
});

function verifyUserStatus(testCase, isCompactMode) {
    // * Verify that the user status is as indicated
    cy.uiGetProfileHeader().
        find(`.${testCase.badgeClassName}`).
        should('be.visible');

    cy.uiWaitUntilMessagePostedIncludes(testCase.message);

    // * Verify that ephemeral message is posted as expected
    cy.getLastPostId().then((postId) => {
        cy.get(`#post_${postId}`).find('.user-popover').should('have.text', 'System');

        if (isCompactMode) {
            cy.get(`#postMessageText_${postId}`).should('have.text', testCase.message + ' (Only visible to you)');
        } else {
            cy.get(`#postMessageText_${postId}`).should('have.text', testCase.message);
            cy.get('.post__visibility').last().should('be.visible').and('have.text', '(Only visible to you)');
        }
    });
}
