// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {onlyOn} from '@cypress/skip-test';

describe('channels > App Bar', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let appBarEnabled;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Start a playbook run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Playbook Run',
                    ownerUserId: testUser.id,
                });
            });

            cy.apiGetConfig(true).then(({config}) => {
                appBarEnabled = config.EnableAppBar === 'true';
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('App Bar disabled', () => {
        it('should not show the Playbook App Bar icon', () => {
            onlyOn(!appBarEnabled);

            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * Verify App Bar icon is not showing
            cy.get('#channel_view').within(() => {
                cy.getPlaybooksAppBarIcon().should('not.exist');
            });
        });
    });

    describe('App Bar enabled', () => {
        it('should show the Playbook App Bar icon', () => {
            onlyOn(appBarEnabled);

            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * Verify App Bar icon is showing
            cy.getPlaybooksAppBarIcon().should('exist');
        });

        it('should show "Playbooks" tooltip for Playbook App Bar icon', () => {
            onlyOn(appBarEnabled);

            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Hover over the channel header icon
            cy.getPlaybooksAppBarIcon().trigger('mouseover');

            // * Verify tooltip text
            cy.findByRole('tooltip', {name: 'Playbooks'}).should('be.visible');
        });
    });
});
