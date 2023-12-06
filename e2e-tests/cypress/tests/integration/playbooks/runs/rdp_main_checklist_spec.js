// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

// Note that this test checks the basic behavior in Run details page as participant / viewer
// It relies on the Channel RHS Checklist test to cover the full behavior of the checklists

describe('runs > run details page > checklist', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;
    const taskIndex = 0;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // Create another user in the same team
            cy.apiCreateUser().then(({user: viewer}) => {
                testViewerUser = viewer;
                cy.apiAddUserToTeam(testTeam.id, testViewerUser.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
                checklists: [
                    {
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                    {
                        title: 'Stage 2',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                ],
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName: 'the run name',
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            testRun = playbookRun;

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
        });
    });

    const getChecklist = () => cy.findByTestId('run-checklist-section');
    const getChecklistTasks = () => getChecklist().findAllByTestId('checkbox-item-container');

    const commonTests = () => {
        it('is visible', () => {
            // * Verify the tasks section is present
            getChecklist().should('be.visible');
        });

        it('has title', () => {
            // * Verify the task section has a title
            getChecklist().find('h3').contains('Tasks');
        });

        it('can see the tasks', () => {
            // * Verify tasks are shown
            getChecklistTasks().should('have.length', 4);
        });
    };

    describe('as participant', () => {
        commonTests();

        it('click marks task as done', () => {
            // # Click first task
            getChecklistTasks().eq(taskIndex).find('.checkbox').check({force: true});

            // * Assert checkbox is checked
            getChecklistTasks().eq(taskIndex).find('.checkbox').should('be.checked');
        });

        it('has hover menu', () => {
            // # Hover over the checklist item
            getChecklistTasks().eq(taskIndex).trigger('mouseover');

            // # Click dot menu
            getChecklistTasks().eq(taskIndex).findByTitle('More').click({force: true});

            // * Assert actions are available
            cy.findByRole('button', {name: 'Skip task'}).should('be.visible');
            cy.findByRole('button', {name: 'Duplicate task'}).should('be.visible');
        });
    });

    describe('as viewer', () => {
        beforeEach(() => {
            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });
        });

        commonTests();

        it('click does not work', () => {
            // # Click first task
            getChecklistTasks().eq(taskIndex).find('.checkbox').should('have.attr', 'readonly');
        });

        it('has not hover menu', () => {
            // # Hover over the checklist item
            getChecklistTasks().eq(taskIndex).trigger('mouseover');

            // * Check that the hover menu is not rendered
            getChecklistTasks().eq(taskIndex).findByTitle('More').should('not.exist');
        });
    });
});
