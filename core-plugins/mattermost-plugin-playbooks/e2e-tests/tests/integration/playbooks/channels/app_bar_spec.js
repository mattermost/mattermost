// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > App Bar', {testIsolation: true}, () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
    });

    it('App Bar disabled', () => {
        cy.apiUpdateConfig({ExperimentalSettings: {DisableAppBar: true}});

        // # Login as testUser
        cy.apiLogin(testUser);

        it('should not show the Playbook App Bar icon', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            cy.findByTestId('post_textbox').should('be.visible');

            // * Verify App Bar icon is not showing
            cy.get('.app-bar').should('not.exist');
        });
    });

    it('App Bar enabled', () => {
        cy.apiUpdateConfig({ExperimentalSettings: {DisableAppBar: false}});

        // # Login as testUser
        cy.apiLogin(testUser);

        it('should show "Playbooks" tooltip for Playbook App Bar icon', () => {
            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Hover over the channel header icon
            cy.getPlaybooksAppBarIcon().trigger('mouseenter');

            // * Verify tooltip text
            cy.findByRole('tooltip', {name: 'Playbooks'}).should('be.visible');
        });
    });
});
