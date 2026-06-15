// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > slash command > info', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testUser2;
    let testPlaybook;
    let testPlaybookRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser().then(({user: user2}) => {
                testUser2 = user2;
                cy.apiAddUserToTeam(testTeam.id, testUser2.id);
            });

            cy.apiLogin(testUser);

            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
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
                memberIDs: [testUser.id],
            }).then((playbook) => {
                testPlaybook = playbook;

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Playbook Run',
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    testPlaybookRun = playbookRun;
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Reset the owner back to testUser as necessary.
        cy.apiChangePlaybookRunOwner(testPlaybookRun.id, testUser.id);
    });

    describe('/playbook info', () => {
        it('should show an error when not in a playbook run channel', () => {
            // # Navigate to a non-playbook run channel.
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Run a slash command to show the playbook run's info.
            cy.uiPostMessageQuickly('/playbook info');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('This command only works when run from a playbook run channel.');
        });

        it('should open the RHS when it is not open', () => {
            // # Navigate directly to the application and the playbook run channel.
            cy.visit(`/${testTeam.name}/channels/playbook-run`);

            // # Close the RHS, which is opened by default when navigating to a playbook run channel.
            cy.get('#searchResultsCloseButton').click();

            // * Verify that the RHS is indeed closed.
            cy.get('#rhsContainer').should('not.exist');

            // # Run a slash command to show the playbook run's info.
            cy.uiPostMessageQuickly('/playbook info');

            // * Verify that the RHS is now open.
            cy.get('#rhsContainer').should('be.visible');
        });

        it('should show an ephemeral post when the RHS is already open', () => {
            // # Navigate directly to the application and the playbook run channel.
            cy.visit(`/${testTeam.name}/channels/playbook-run`);

            // * Verify that the RHS is open.
            cy.get('#rhsContainer').should('be.visible');

            // # Run a slash command to show the playbook run's info.
            cy.uiPostMessageQuickly('/playbook info');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('Your playbook run details are already open in the right hand side of the channel.');
        });
    });
});
