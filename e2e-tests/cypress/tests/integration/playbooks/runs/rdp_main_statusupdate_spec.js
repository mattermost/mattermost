// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run details page > status update', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;
    let playbookRunChannelName;

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

        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        playbookRunChannelName = 'playbook-run-' + now;

        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            testRun = playbookRun;

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);

            cy.assertRunDetailsPageRenderComplete(testUser.username);
        });
    });

    describe('as participant', () => {
        it('is visible', () => {
            // * Verify the status update section is present
            cy.findByTestId('run-statusupdate-section').should('be.visible');
        });

        it('has no title', () => {
            // * Verify the title
            cy.findByTestId('run-statusupdate-section').find('h3').should('not.exist');
        });

        describe('post update', () => {
            it('button disappears if we finish the run', () => {
                // * Check that post update button is visible
                cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').should('be.visible');

                // # Click finish button and confirm modal
                cy.findByTestId('run-finish-section').find('button').click();
                cy.get('#confirmModal').get('#confirmModalButton').click();

                // * Check that post update button does not exist anymore
                cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').should('not.exist');
            });

            it('button triggers post update modal', () => {
                // * Check due date
                cy.findByTestId('update-due-date-text').contains('Update due');
                cy.findByTestId('update-due-date-time').contains('in 24 hours');

                // # Click post update
                cy.findByTestId('run-statusupdate-section').findByTestId('post-update-button').click();

                // * Assert modal is opened
                cy.getStatusUpdateDialog().should('be.visible');

                // # Write message
                cy.findByTestId('update_run_status_textbox').clear().type('my nice update');
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('input').type('15 minutes', {delay: 200, force: true}).type('{enter}', {force: true});
                });

                // # Post update
                cy.getStatusUpdateDialog().findByTestId('modal-confirm-button').click();

                // * Check new due date
                cy.findByTestId('update-due-date-text').contains('Update due');
                cy.findByTestId('update-due-date-time').contains('in 15 minutes');

                // # Intercept all calls to telemetry
                cy.interceptTelemetry();

                // # go to channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // * check that post has been added
                cy.getLastPost().contains('my nice update');

                // * assert  telemetry pageview
                cy.expectTelemetryToContain([
                    {
                        name: 'run_status_update',
                        type: 'page',
                        properties: {
                            channel_type: 'P',
                        },
                    },
                ]);
            });
        });

        describe('request an update', () => {
            it('is disabled if the run is finished', () => {
                cy.apiFinishRun(testRun.id).then(() => {
                    // # reload url
                    cy.visit(`/playbooks/runs/${testRun.id}`);
                    cy.assertRunDetailsPageRenderComplete(testUser.username);

                    // # Click on kebab menu
                    cy.findByTestId('run-statusupdate-section').getStyledComponent('Kebab').click();

                    // # click on request update option (force because is disabled)
                    cy.findByText('Request update...').click({force: true});

                    // * assert modal is not opened
                    cy.get('#confirmModalButton').should('not.exist');
                });
            });

            it('requests and confirm', () => {
                // # Click on kebab menu
                cy.findByTestId('run-statusupdate-section').getStyledComponent('Kebab').click();

                cy.findByTestId('dropdownmenu').within(($dropdown) => {
                    cy.wrap($dropdown).children().should('have.length', 2);

                    // # Click on request update
                    cy.findByText('Request update...').click();
                });

                // # Click on modal confirmation
                cy.get('#confirmModalButton').click();

                // # Go to channel
                cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Assert that message has been sent
                cy.getLastPost().contains(`${testUser.username} requested a status update for ${testRun.name}.`);
            });

            it('requests and cancel', () => {
                // # Click on kebab menu
                cy.findByTestId('run-statusupdate-section').getStyledComponent('Kebab').click();
                cy.findByTestId('dropdownmenu').within(($dropdown) => {
                    cy.wrap($dropdown).children().should('have.length', 2);

                    // # Click on request update
                    cy.findByText('Request update...').click();
                });

                // # Click on modal confirmation
                cy.get('#cancelModalButton').click();

                // # Go to channel
                cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Assert that message has not been sent
                cy.getLastPost().should('not.contain', `${testUser.username} requested a status update for ${testRun.name}.`);
            });
        });
    });

    describe('as viewer', () => {
        beforeEach(() => {
            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
                cy.assertRunDetailsPageRenderComplete(testUser.username);
            });
        });

        it('is visible', () => {
            // * Verify the status update section is present
            cy.findByTestId('run-statusupdate-section').should('be.visible');
        });

        it('has a title', () => {
            // * Verify the title
            cy.findByTestId('run-statusupdate-section').find('h3').contains('Recent status update');
        });

        it('has placeholder', () => {
            // * Verify the placeholder
            cy.findByTestId('run-statusupdate-section').find('i').contains('No updates have been posted yet');
        });

        it('has a due date', () => {
            // * Verify the due date
            cy.findByTestId('update-due-date-text').contains('Update due');
            cy.findByTestId('update-due-date-time').contains('in 24 hours');
        });

        it('shows the most recent update', () => {
            // # Login as participant
            cy.apiLogin(testUser).then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
                cy.assertRunDetailsPageRenderComplete(testUser.username);
            });

            // # Click post update
            cy.findByTestId('run-statusupdate-section').
                should('be.visible').
                findByTestId('post-update-button').click();

            // * Assert modal is opened
            cy.getStatusUpdateDialog().should('be.visible');

            // # Write message
            cy.findByTestId('update_run_status_textbox').clear().type('my nice update');
            cy.get('#reminder_timer_datetime').within(() => {
                cy.get('input').type('15 minutes', {delay: 200, force: true}).type('{enter}', {force: true});
            });

            // # Post update
            cy.getStatusUpdateDialog().findByTestId('modal-confirm-button').click();

            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
                cy.assertRunDetailsPageRenderComplete(testUser.username);

                // * Check new due date
                cy.findByTestId('update-due-date-text').contains('Update due');
                cy.findByTestId('update-due-date-time').contains('in 15 minutes');

                // * Assert the recent updated text
                cy.findByTestId('status-update-card').contains('my nice update');
            });
        });

        it('requests an update and confirm', () => {
            // # Click on request update
            cy.findByTestId('run-statusupdate-section').
                should('be.visible').
                findByText('Request update...').click();

            // # Click on modal confirmation
            cy.get('#confirmModalButton').click();

            cy.apiLogin(testUser).then(() => {
                // # Go to channel
                cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Assert that message has been sent
                cy.getLastPost().contains(`${testViewerUser.username} requested a status update for ${testRun.name}.`);
            });
        });

        it('requests an update and cancel', () => {
            // # Click request update
            cy.findByTestId('run-statusupdate-section').
                should('be.visible').
                findByText('Request update...').click();

            // # Click on modal confirmation
            cy.get('#cancelModalButton').click();

            cy.apiLogin(testUser).then(() => {
                // # Go to channel
                cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Assert that message has been sent
                cy.getLastPost().should('not.contain', `${testUser.username} requested a status update for ${testPublicPlaybook.name}].`);
            });
        });
    });
});
