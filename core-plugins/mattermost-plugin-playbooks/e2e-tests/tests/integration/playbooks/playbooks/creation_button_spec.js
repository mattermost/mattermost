// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > creation button', {testIsolation: true}, () => {
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

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            // # Creating this playbook ensures the list view
            // # specifically is shown in the backstage content section.
            // # Without it there is a brief flicker from the list view
            // # to the no content view, which causes some flake
            // # on clicking the 'Create playbook' button
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
            });
        });
    });

    beforeEach(() => {
        // # Login as user-1
        cy.apiLogin(testUser);

        // # Size the viewport to show playbooks without weird scrolling issues
        cy.viewport('macbook-13');
    });

    it('opens playbook creation page with New Playbook button', () => {
        const playbookName = 'Untitled Playbook';

        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'New Playbook' button
        cy.findByTestId('titlePlaybook').findByText('Create playbook').click();
        cy.get('#playbooks_create').findByText('Create playbook').click();

        // * Verify playbook outline page opened
        verifyPlaybookOutlineOpened(playbookName);

        // * Verify playbook was added to the LHS
        cy.findByTestId('lhs-navigation').findByText(playbookName).should('exist');
    });

    it('auto creates a playbook with "Blank" template option', () => {
        // # Open the product
        cy.visit('/playbooks');

        // # Switch to playbooks
        cy.findByTestId('playbooksLHSButton').click();

        // # Click 'Blank'
        cy.findByText('Blank').click();

        const playbookName = `@${testUser.username}'s Blank`;

        // * Verify playbook outline opened
        verifyPlaybookOutlineOpened(playbookName);

        // * Verify playbook was added to the LHS
        cy.findByTestId('lhs-navigation').findByText(playbookName).should('exist');
    });

    it('opens Service Outage Incident page from its template option (multiple teams)', () => {
        cy.apiCreateTeam('second-team', 'Second Team').then(() => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // # Click 'Incident Resolution'
            cy.findByText('Incident Resolution').click();

            const playbookName = `@${testUser.username}'s Incident Resolution`;

            // * Verify playbook outline opened
            verifyPlaybookOutlineOpened(playbookName);

            // * Verify the playbook was added to the lhs of current team
            cy.findByTestId('lhs-navigation').findByText(playbookName).should('exist');
        });
    });

    let restrictedTestTeam;
    let restrictedTestUser;

    describe('user is lacking permissions to create playbooks', () => {
        before(() => {
            cy.apiLogin(testSysadmin);

            cy.apiCreateUser().then(({user: createdUser}) => {
                restrictedTestUser = createdUser;
            });

            cy.apiCreateTeam('restricted-team', 'Restricted Team').then(({team: createdTeam}) => {
                restrictedTestTeam = createdTeam;
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
        });

        it('create playbook entry in LHS dropdown should not exist', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Open menu dropdown
            cy.findByTestId('create-playbook-dropdown-toggle').click();

            cy.get('#CreatePlaybookDropdown').within(() => {
                // * Verify create playbook entry is missing
                cy.findByText('Create New Playbook').should('not.exist');
            });
        });

        it('permission notice should be shown if no playbooks exist', () => {
            // # Open the product
            cy.visit('/playbooks');

            // # Switch to playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // * Verify notice about missing permissions and no playbooks is shown
            cy.findByText('There are no playbooks to view. You don\'t have permission to create playbooks in this workspace.').should('exist');
        });

        it('create playbook button should not exist if playbooks exist', () => {
            // # Create a playbook for the team
            cy.apiLogin(testSysadmin).then(() => {
                cy.apiCreatePlaybook({
                    teamId: restrictedTestTeam.id,
                    title: 'Playbook',
                    memberIDs: [],
                });
            });

            // # Login as user with restricted permissions
            cy.apiLogin(restrictedTestUser);

            // # Open the product
            cy.visit('/playbooks');

            // # Switch to playbooks
            cy.findByTestId('playbooksLHSButton').click();

            // * Verify create playbook button is missing
            cy.findByTestId('titlePlaybook').findByText('Create playbook').should('not.exist');
        });
    });
});

function verifyPlaybookOutlineOpened(playbookName) {
    // * Verify the page url contains 'playbooks/playbooks/new'
    cy.url().should('contain', '/outline');

    // * Verify the playbook name matches the one provided
    cy.findByTestId('playbook-editor-title').within(() => {
        cy.findByText(playbookName).should('be.visible');
    });
}
