// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {onlyOn} from '@cypress/skip-test';

describe('channels > channel header', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testPlaybookRun;
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
                }).then((run) => {
                    testPlaybookRun = run;
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

    describe('App Bar enabled', () => {
        it('webapp should hide the Playbook channel header button', () => {
            onlyOn(appBarEnabled);

            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * Verify channel header button is not showing
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('not.exist');
            });
        });
    });

    describe('App Bar disabled', () => {
        it('webapp should show the Playbook channel header button', () => {
            onlyOn(!appBarEnabled);

            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * Verify channel header button is showing
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').should('exist');
            });
        });

        it('tooltip text should show "Playbooks" for Playbook channel header button', () => {
            onlyOn(!appBarEnabled);

            // # Navigate directly to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Hover over the channel header icon
            cy.get('#channel-header').within(() => {
                cy.get('#incidentIcon').trigger('mouseover');
            });

            // * Verify tooltip text
            cy.get('#pluginTooltip').contains('Playbooks');
        });
    });

    describe('description text', () => {
        it('should contain a link to the playbook', () => {
            // # Navigate directly to a playbook run channel
            cy.visit(`/${testTeam.name}/channels/playbook-run`);

            // * Verify link to playbook
            cy.get('.header-description__text').findByText('Playbook').should('have.attr', 'href').then((href) => {
                expect(href).to.equals(`/playbooks/playbooks/${testPlaybook.id}`);
            });
        });
        it('should contain a link to the overview page', () => {
            // # Navigate directly to a playbook run channel
            cy.visit(`/${testTeam.name}/channels/playbook-run`);

            // * Verify link to overview page
            cy.get('.header-description__text').findByText('the overview page').should('have.attr', 'href').then((href) => {
                expect(href).to.equals(`/playbooks/runs/${testPlaybookRun.id}`);
            });
        });
    });
});
