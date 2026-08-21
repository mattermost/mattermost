// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import * as TIMEOUTS from '../../../../fixtures/timeouts';

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > home', {testIsolation: true}, () => {
    let testSysadmin;
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateCustomAdmin().then(({sysadmin}) => {
                testSysadmin = sysadmin;
            });
        });
    });

    describe('default permission settings', () => {
        beforeEach(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Navigate to the application, starting in a non-run channel.
            cy.visit(`/${testTeam.name}/`);

            // # Wait for page to fully load and settle
            cy.wait(TIMEOUTS.TWO_SEC);

            // * Check post list content as an indicator of page stability
            cy.get('#postListContent').should('be.visible');
        });

        describe('shows available', () => {
            // TBD: UI changes for Checklists feature - template access workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('starter templates', () => {
            // templates are defined in webapp/src/components/templates/template_data.tsx
                const templates = [
                    {name: 'Blank', checklists: '1 checklist', actions: '1 action'},
                    {name: 'Product Release', checklists: '4 checklists', actions: '3 actions'},
                    {name: 'Incident Resolution', checklists: '4 checklists', actions: '4 actions'},
                    {name: 'Customer Onboarding', checklists: '4 checklists', actions: '3 actions'},
                    {name: 'Employee Onboarding', checklists: '5 checklists', actions: '2 actions'},
                    {name: 'Feature Lifecycle', checklists: '5 checklists', actions: '3 actions'},
                    {name: 'Bug Bash', checklists: '5 checklists', actions: '3 actions'},
                    {name: 'Learn how to use playbooks', checklists: '2 checklists', actions: '2 actions'},
                ];

                // # Ensure any existing runs in this channel are finished so we get the empty state
                cy.apiFinishAllRuns(testTeam.id);
                cy.wait(500);

                // # Ensure RHS is closed before opening it
                cy.get('body').then(($body) => {
                    if ($body.find('#sidebar-right.is-open').length > 0) {
                        cy.getPlaybooksAppBarIcon().click(); // Close if already open
                        cy.wait(500);
                    }
                });

                // # Click the icon to open RHS
                cy.getPlaybooksAppBarIcon().should('be.visible').click();

                // # Wait for RHS to open
                cy.get('#rhsContainer', {timeout: 10000}).should('be.visible');

                // * Verify we see the new checklist UI for empty channels
                cy.get('#rhsContainer').within(() => {
                    cy.findByText('Get started with a checklist for this channel').should('be.visible');

                    // # First create a blank checklist so the header with dropdown appears
                    cy.findByTestId('create-blank-checklist').click();
                });
                cy.wait(2000); // Wait for checklist creation and RHS update

                // # Click the dropdown next to "+ New checklist" button in header
                cy.get('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

                // # Click "Run a playbook" from the dropdown
                cy.findByTestId('create-from-playbook').click();

                // * Verify the templates are shown in the modal
                cy.get('#root-portal.modal-open').within(() => {
                    cy.findByText('Select a playbook').should('be.visible');

                    // * Verify template tab and templates
                    cy.findByText('Playbook Templates').click();

                    cy.findAllByTestId('template-details').each(($templateElement, index) => {
                        cy.wrap($templateElement).within(() => {
                            cy.findByText(templates[index].name).should('exist');
                            cy.findByText(templates[index].checklists).should('exist');
                            cy.findByText(templates[index].actions).should('exist');
                        });
                    });
                });
            });
        });

        describe('show zero case if there are playbooks', () => {
            beforeEach(() => {
                // # Create a public playbook
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Team Playbook',
                    memberIDs: [],
                });

                // # Ensure any existing runs in this channel are finished so we get the empty state
                cy.apiFinishAllRuns(testTeam.id);
                cy.wait(500);

                // # Ensure RHS is closed before opening it
                cy.get('body').then(($body) => {
                    if ($body.find('#sidebar-right.is-open').length > 0) {
                        cy.getPlaybooksAppBarIcon().click(); // Close if already open
                        cy.wait(500);
                    }
                });

                // # Click the icon to open RHS
                cy.getPlaybooksAppBarIcon().click();

                // # Wait for RHS to open
                cy.get('#sidebar-right', {timeout: 10000}).should('be.visible');
            });

            // TBD: UI changes for Checklists feature - empty state display has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('without pre-populated channel name template', () => {
                // * Verify the templates are not shown
                cy.findAllByTestId('template-details').should('not.exist');

                // * Verify the zero case is shown
                cy.get('#sidebar-right').findByText('There are no runs in progress linked to this channel').should('be.visible');
            });
        });
    });

    let restrictedTestTeam;
    let restrictedTestUser;

    describe('user is lacking permissions to create playbooks', () => {
        before(() => {
            cy.apiLogin(testSysadmin);

            cy.apiCreateUser().then(({user}) => {
                restrictedTestUser = user;
            });

            cy.apiCreateTeam('restricted-team', 'Restricted Team').then(({team}) => {
                restrictedTestTeam = team;
                cy.apiAddUserToTeam(restrictedTestTeam.id, restrictedTestUser.id);
            });

            cy.apiCreateScheme('Restricted Team Scheme', 'team').then(({scheme}) => {
                cy.apiSetTeamScheme(restrictedTestTeam.id, scheme.id);
                cy.apiGetRolesByNames([scheme.default_team_user_role]).then(({roles}) => {
                    const role = roles[0];

                    // Remove permissions to create playbooks
                    const permissions = role.permissions.filter((perm) => !(/playbook_(private|public)_create/).test(perm));
                    cy.apiPatchRole(role.id, {permissions});
                });
            });
        });

        beforeEach(() => {
            // # Login as user with restricted permissions
            cy.apiLogin(restrictedTestUser);

            // # Navigate to the application, starting in a non-run channel.
            cy.visit(`/${restrictedTestTeam.name}/`);
        });

        // TBD: UI changes for Checklists feature - permission messaging has changed
        // eslint-disable-next-line no-only-tests/no-only-tests
        it.skip('permission notice should be shown and no create button should exist', () => {
            // # Ensure any existing runs in this channel are finished so we get the empty state
            cy.apiFinishAllRuns(restrictedTestTeam.id);
            cy.wait(500);

            // # Ensure RHS is closed before opening it
            cy.get('body').then(($body) => {
                if ($body.find('#sidebar-right.is-open').length > 0) {
                    cy.getPlaybooksAppBarIcon().click(); // Close if already open
                    cy.wait(500);
                }
            });

            // # Click the icon to open RHS
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // # Wait for RHS to open
            cy.get('#sidebar-right', {timeout: 10000}).should('be.visible');

            cy.get('#sidebar-right').within(() => {
                // * Verify notice about missing permissions exists
                cy.findByText('You don\'t have permission to create playbooks in this workspace.').should('be.visible');

                // * Verify create playbook button does not exist
                cy.findByText('Create playbook').should('not.exist');
            });
        });
    });
});
