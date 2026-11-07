// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbook tour points', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testSysadmin;
    beforeEach(() => {
        cy.apiInitSetup({promoteNewUserAsAdmin: true}).then(({team, user: sysadmin}) => {
            testTeam = team;
            testSysadmin = sysadmin;

            // # Create a user with tutorials enabled
            cy.apiCreateUser({bypassTutorial: false}).then(({user: userWithTours}) => {
                testUser = userWithTours;
                cy.apiAddUserToTeam(team.id, testUser.id);
                cy.apiLogin(userWithTours);
            });
        });
    });

    afterEach(() => {
        // # Ensure apiInitSetup() can run again
        cy.apiLogin(testSysadmin);
    });

    it('creation tour', () => {
        // # Open creation view from RHS
        cy.visit(`/${testTeam.name}/channels/town-square`);
        cy.get('#incidentIcon').click({force: true});
        cy.findByRole('button', {name: /create playbook/i}).click();
        cy.url().should('contain', '/playbooks/playbooks/new');

        // * Verify the tutorial steps
        cy.contains('Create and assign tasks').should('be.visible');
        cy.findByRole('button', {name: /next/i}).click();

        cy.contains('Set up assumptions').should('be.visible');
        cy.findByRole('button', {name: /next/i}).click();

        cy.contains('Keep stakeholders updated').should('be.visible');
        cy.findByRole('button', {name: /next/i}).click();

        cy.contains('Learn AND reflect').should('be.visible');
        cy.findByRole('button', {name: /done/i}).click();
    });

    it('preview tour', () => {
        // # Make a playbook to preview
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Preview Tour Test Playbook',
            memberIDs: [],
        }).then(() => {
            // # Open the playbook
            cy.visit('/playbooks/playbooks');
            cy.findByText('Preview Tour Test Playbook').click();

            // * Verify the tutorial steps
            cy.contains('Welcome to the playbook preview page!').should('be.visible');
            cy.findByRole('button', {name: /next/i}).click();

            cy.contains('different sections of the playbook').should('be.visible');
            cy.findByRole('button', {name: /next/i}).click();

            cy.contains('Ready to run your playbook?').should('be.visible');
            cy.findByRole('button', {name: /done/i}).click();
        });
    });

    describe('run tour', () => {
        beforeEach(() => {
            // # Disable the preview tour which we would otherwise see
            cy.apiSaveUserPreference([{
                user_id: testUser.id,
                category: 'playbook_preview',
                name: testUser.id,
                value: '999',
            }], testUser.id);

            // # Start a run from the tutorial template
            cy.visit('/playbooks/playbooks');
            cy.findByText('Learn how to use playbooks').click();
            cy.findByRole('button', {name: /run playbook/i}).click({force: true});

            // * Verify the tour confirmation modal is shown (other tours don't have one)
            cy.contains('auto-created your run').should('be.visible');
        });

        it('follows the tour when chosen from modal', () => {
            // # Accept the tour
            cy.contains('quick tour').click();

            // * Verify the tutorial steps
            cy.contains('See who is involved').should('be.visible');
            cy.findByRole('button', {name: /next/i}).click();

            cy.contains('Post status updates').should('be.visible');
            cy.findByRole('button', {name: /next/i}).click();

            cy.contains('Track progress and ownership').should('be.visible');
            cy.findByRole('button', {name: /done/i}).click();
        });

        it('does not follow the tour when dismissed from modal', () => {
            // # Dismiss the tour
            cy.findByRole('button', {name: /let me explore/i}).click();

            // * Verify the first step is _not_ shown
            cy.contains('See who is involved').should('not.exist');
        });
    });
});
