// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

describe('Settings > Sidebar > Channel Switcher', () => {
    let testUser;
    let testTeam;

    before(() => {
        // # Login as test user
        cy.apiInitSetup({loginAfter: true}).then(({team, user}) => {
            testUser = user;
            testTeam = team;
        });
    });

    beforeEach(() => {
        // # Visit off-topic
        cy.visit(`/${testTeam.name}/channels/off-topic`);
        cy.get('#channelHeaderTitle').should('be.visible').should('contain', 'Off-Topic');
    });

    it('Cmd/Ctrl+Shift+L closes Channel Switch modal and sets focus to post textbox', () => {
        // # Type CTRL/CMD+K
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');

        // * Channel switcher hint should be visible
        cy.get('#quickSwitchHint').should('be.visible').should('contain', 'Type to find a channel. Use UP/DOWN to browse, ENTER to select, ESC to dismiss.');

        // # Type CTRL/CMD+shift+L
        cy.findByRole('textbox', {name: 'quick switch input'}).cmdOrCtrlShortcut('{shift}L');

        // * Suggestion list should not be visible
        cy.get('#suggestionList').should('not.exist');

        // * focus should be on the input box
        cy.uiGetPostTextBox().should('be.focused');
    });

    it('Cmd/Ctrl+Shift+M closes Channel Switch modal and sets focus to mentions', () => {
        // # patch user info
        cy.apiPatchMe({notify_props: {first_name: 'false', mention_keys: testUser.username}});

        // # Type CTRL/CMD+K
        cy.uiGetPostTextBox().cmdOrCtrlShortcut('K');

        // * Channel switcher hint should be visible
        cy.get('#quickSwitchHint').should('be.visible').should('contain', 'Type to find a channel. Use UP/DOWN to browse, ENTER to select, ESC to dismiss.');

        // # Type CTRL/CMD+shift+m
        cy.findByRole('textbox', {name: 'quick switch input'}).cmdOrCtrlShortcut('{shift}M');

        // * Suggestion list should not be visible
        cy.get('#suggestionList').should('not.exist');

        cy.get('.sidebar--right__title').should('contain', 'Recent Mentions');
    });
});
