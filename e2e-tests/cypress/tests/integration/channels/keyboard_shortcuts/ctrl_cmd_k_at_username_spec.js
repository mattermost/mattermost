// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @keyboard_shortcuts

describe('Keyboard Shortcuts', () => {
    let testTeam;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team, user, offTopicUrl}) => {
            testTeam = team;
            testUser = user;
            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
                cy.apiLogin(testUser);
                cy.visit(offTopicUrl);
            });
        });
    });

    it('MM-T1246 CTRL/CMD+K - @ at beginning of username', () => {
        // # Type CTRL/CMD+K
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('k');

        // # Enter @ followed by the first 2 characters of username of the other user
        cy.get('#quickSwitchInput').type('@' + otherUser.username.slice(0, 3));

        // # Click on the username in the suggestion list
        // The testid uses a channel id; match the scoped row by its visible username.
        cy.findByTestId((testId, element) => {
            const visibleName = element?.querySelector('.suggestion-list__channel-name-text')?.textContent;
            const visibleUsername = element?.querySelector('.suggestion-list__desc')?.textContent;
            return testId.startsWith('quick_switch_modal.suggestions.suggestion:') &&
                (visibleUsername === `@${otherUser.username}` || (!visibleUsername &&
                    (visibleName === otherUser.username || Boolean(visibleName?.startsWith(`${otherUser.username} (`)))));
        }).click();

        // * The direct message channel for the user opens
        cy.url().should('include', `/${testTeam.name}/messages/@${otherUser.username}`);
    });
});
