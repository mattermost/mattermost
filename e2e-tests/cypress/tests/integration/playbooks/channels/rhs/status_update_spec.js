// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Group: @playbooks

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('channels > rhs > status update', {testIsolation: true}, () => {
    const defaultReminderMessage = '# Default reminder message';
    let testTeam;
    let testChannel;
    let testUser;
    let testPlaybook;
    let testRun;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser,
                broadcastChannelIds: [testChannel.id],
                reminderTimerDefaultSeconds: 3600,
                reminderMessageTemplate: defaultReminderMessage,
                retrospectiveEnabled: false,
                broadcastEnabled: true,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

        // # Create a new playbook run
        const now = Date.now();
        const name = 'Playbook Run (' + now + ')';
        const channelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName: name,
            ownerUserId: testUser.id,
        }).then((run) => {
            testRun = run;
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${channelName}`);
    });

    describe('post update dialog', () => {
        it('renders description correctly', () => {
            // # Run the `/playbook update` slash command.
            cy.uiPostMessageQuickly('/playbook update ');

            // # Get dialog modal.
            cy.getStatusUpdateDialog().within(() => {
                // * Check description
                cy.findByTestId('update_run_status_description').contains(`This update for the run ${testRun.name} will be broadcasted to one channel and one direct message.`);
            });
        });

        it('description link navigates to run overview', () => {
            // # Run the `/playbook update` slash command.
            cy.uiPostMessageQuickly('/playbook update ');

            // # Get dialog modal.
            cy.getStatusUpdateDialog().within(() => {
                // # Click overview link
                cy.findByTestId('run-overview-link').click();
            });

            // * Check that we are now in run overview page
            cy.url().should('include', `/playbooks/runs/${testRun.id}`);

            // * Check that the run actions modal is already opened
            cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');
        });

        it('prevents posting an update message with only whitespace', () => {
            // # Run the `/playbook update` slash command.
            cy.uiPostMessageQuickly('/playbook update ');

            // # Get dialog modal.
            cy.getStatusUpdateDialog().within(() => {
                // # Type the invalid data
                cy.findByTestId('update_run_status_textbox').clear().type(' {enter} {enter}  ');

                // * Verify submit is disabled.
                cy.get('button.confirm').should('be.disabled');

                // # Enter valid data
                cy.findByTestId('update_run_status_textbox').type('valid update');

                // # Submit the dialog.
                cy.get('button.confirm').click();
            });

            // * Verify that the Post update dialog has gone.
            cy.getStatusUpdateDialog().should('not.exist');
        });

        it('lets users with no access to the playbook post an update', () => {
            let channelName;
            const updateMessage = 'status update ' + Date.now();

            // # Login as sysadmin and create a private playbook and a run
            cy.apiAdminLogin().then(({user: sysadmin}) => {
                // # Create a private playbook
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Playbook - Private',
                    memberIDs: [sysadmin.id], // Make it accesible only to sysadmin
                    inviteUsersEnabled: true,
                    invitedUserIds: [testUser.id], // Invite the test user
                }).then((playbook) => {
                    // # Create a new playbook run
                    const now = Date.now();
                    const name = 'Playbook Run (' + now + ')';
                    channelName = 'playbook-run-' + now;
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: name,
                        ownerUserId: sysadmin.id,
                    }).then((run) => {
                        cy.apiAddUsersToRun(run.id, [testUser.id]);
                    });
                });
            }).then(() => {
                // # Login as the test user
                cy.apiLogin(testUser);

                // # Navigate directly to the application and the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${channelName}`);

                // # Run the `/playbook update` slash command.
                cy.uiPostMessageQuickly('/playbook update ');

                // # Get dialog modal.
                cy.getStatusUpdateDialog().within(() => {
                    // # Enter valid data
                    cy.findByTestId('update_run_status_textbox').type(updateMessage);

                    // # Submit the dialog.
                    cy.get('button.confirm').click();
                });

                // * Verify that the Post update dialog has gone.
                cy.getStatusUpdateDialog().should('not.exist');

                // * Verify that the status update was posted.
                cy.getLastPost().within(() => {
                    cy.findByText(updateMessage).should('exist');
                });
            });
        });

        it('confirms finishing the run, and remembers changes and reminder when canceled', () => {
            const updateMessage = 'This is the update text to test with.';
            const reminderTime = '1 day';

            // # Run the `/playbook update` slash command.
            cy.uiPostMessageQuickly('/playbook update ');

            // # Get the dialog modal.
            cy.getStatusUpdateDialog().within(() => {
                // * Verify the first message is there.
                cy.findByTestId('update_run_status_textbox').within(() => {
                    cy.findByText(defaultReminderMessage).should('exist');
                });

                // # Type text to test for later
                cy.findByTestId('update_run_status_textbox').clear().type(updateMessage);

                // # Set a new reminder to test for later
                cy.openReminderSelector();
                cy.selectReminderTime(reminderTime);

                // # Mark the run as finished
                cy.findByTestId('mark-run-as-finished').click({force: true});

                // # Submit the dialog.
                cy.get('button.confirm').click();
            });

            // * Confirmation should appear
            cy.get('.modal-header').should('be.visible').contains('Confirm finish run');

            // # Cancel
            cy.get('#cancelModalButton').click({force: true});

            // * Verify post update has the same information
            cy.getStatusUpdateDialog().within(() => {
                // * Verify the message was remembered
                cy.findByTestId('update_run_status_textbox').within(() => {
                    cy.findByText(updateMessage).should('exist');
                });

                // * Verify the reminder was remembered
                cy.get('#reminder_timer_datetime').contains(reminderTime);

                // * Marked run is still checked
                cy.findByTestId('mark-run-as-finished').within(() => {
                    cy.get('[type="checkbox"]').should('be.checked');
                });

                // # Submit the dialog.
                cy.get('button.confirm').click();
            });

            // * Confirmation should appear
            cy.get('.modal-header').should('be.visible').contains('Confirm finish run');

            // # Submit
            cy.get('#confirmModalButton').click({force: true});

            // * Verify the status update was posted.
            cy.getStyledComponent('CustomPostContent').within(() => {
                cy.findByText(updateMessage).should('exist');
            });

            // * Verify the run was finished.
            cy.getLastPost().contains(`@${testUser.username} marked ${testRun.name} as finished.`);
        });

        describe('prevents user from losing changes', () => {
            it('cancel, go back and save', () => {
                // # Run the `/playbook update` slash command.
                cy.uiPostMessageQuickly('/playbook update ');

                // # Get dialog modal.
                cy.getStatusUpdateDialog().within(() => {
                    // # Type the invalid data
                    cy.findByTestId('update_run_status_textbox').clear().type('My valid and important changes that I don\'t want to lose');

                    // * Click cancel
                    cy.findByTestId('modal-cancel-button').click();
                });

                // * Go back from unsaved changes modal
                cy.get('#confirm-modal-light').within(() => {
                    cy.findByTestId('modal-cancel-button').click();
                });

                // # Delay in between the modal switch to ensure the
                // # animation has fully happened
                cy.wait(TIMEOUTS.TWO_SEC);

                // # Submit the dialog.
                cy.get('button.confirm').click();

                // * Verify that the Post update and unsaved changes modals have gone.
                cy.getStatusUpdateDialog().should('not.exist');
                cy.get('#confirm-modal-light').should('not.exist');
            });

            it('click overview link, go back and save', () => {
                // # Run the `/playbook update` slash command.
                cy.uiPostMessageQuickly('/playbook update ');

                // # Get dialog modal.
                cy.getStatusUpdateDialog().within(() => {
                    // # Type the invalid data
                    cy.findByTestId('update_run_status_textbox').clear().type('My valid and important changes that I don\'t want to lose');

                    // # Click overview link
                    cy.findByTestId('run-overview-link').click();
                });

                // Verify that the confirmation modal is shown
                cy.get('#confirm-modal-light').within(() => {
                    // * Go back from unsaved changes modal
                    cy.findByTestId('modal-cancel-button').click();
                });

                // # Delay in between the modal switch to ensure the
                // # animation has fully happened
                cy.wait(TIMEOUTS.TWO_SEC);

                // # Submit the dialog.
                cy.get('button.confirm').click();

                // * Verify that the Post update and unsaved changes modals have gone.
                cy.getStatusUpdateDialog().should('not.exist');
                cy.get('#confirm-modal-light').should('not.exist');
            });

            it('cancel and discard explicitly', () => {
                // # Run the `/playbook update` slash command.
                cy.uiPostMessageQuickly('/playbook update ');

                // # Get dialog modal.
                cy.getStatusUpdateDialog().within(() => {
                    // # Type the invalid data
                    cy.findByTestId('update_run_status_textbox').clear().type('My valid and important changes that I don\'t want to lose');

                    // * Click cancel
                    cy.findByTestId('modal-cancel-button').click();
                });

                // * Discard explicitly from unsaved changes
                cy.get('#confirm-modal-light').within(() => {
                    cy.get('button.confirm').click();
                });

                // * Verify that the Post update and unsaved changes modals have gone.
                cy.getStatusUpdateDialog().should('not.exist');
                cy.get('#confirm-modal-light').should('not.exist');
            });

            it('click overview link and discard explicitly', () => {
                // # Run the `/playbook update` slash command.
                cy.uiPostMessageQuickly('/playbook update ');

                // # Get dialog modal.
                cy.getStatusUpdateDialog().within(() => {
                    // # Type the invalid data
                    cy.findByTestId('update_run_status_textbox').clear().type('My valid and important changes that I don\'t want to lose');

                    // # Click overview link
                    cy.findByTestId('run-overview-link').click();
                });

                // * Discard explicitly from unsaved changes
                cy.get('#confirm-modal-light').within(() => {
                    cy.get('button.confirm').click();
                });

                // * Assert that we are at run overview page.
                cy.url().should('include', `/playbooks/runs/${testRun.id}`);

                // * Verify that the Post update and unsaved changes modals have gone.
                cy.getStatusUpdateDialog().should('not.exist');
                cy.get('#confirm-modal-light').should('not.exist');

                // * Verify that the run actions modal is opened.
                cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');
            });
        });

        describe('shows the last update in update message', () => {
            it('shows the default when we have not made an update before', () => {
                // # Run the `/playbook update` slash command.
                cy.uiPostMessageQuickly('/playbook update ');

                // # Get the dialog modal.
                cy.getStatusUpdateDialog().within(() => {
                    // * Verify the first message is there.
                    cy.findByTestId('update_run_status_textbox').within(() => {
                        cy.findByText(defaultReminderMessage).should('exist');
                    });
                });
            });

            it('when we have made a previous update', () => {
                const now = Date.now();
                const firstMessage = 'Update - ' + now;

                // # Create a first status update
                cy.updateStatus(firstMessage);

                // # Run the `/playbook update` slash command.
                cy.uiPostMessageQuickly('/playbook update ');

                // # Get the dialog modal.
                cy.getStatusUpdateDialog().within(() => {
                    // * Verify the first message is there.
                    cy.findByTestId('update_run_status_textbox').within(() => {
                        cy.findByText(firstMessage).should('exist');
                    });
                });
            });
        });
    });

    describe('the default reminder', () => {
        it('shows the configured default when we have not made a previous update', () => {
            // # Run the `/playbook update` slash command.
            cy.uiPostMessageQuickly('/playbook update ');

            // # Get the dialog modal.
            cy.getStatusUpdateDialog().within(() => {
                // * Verify the default is as expected
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('[class$=singleValue]').should('have.text', '1 hour');
                });
            });
        });

        it('shows the last reminder we typed in: 15 minutes', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '15 minutes');

            // # Run the `/playbook update` slash command.
            cy.uiPostMessageQuickly('/playbook update ');

            // # Get the dialog modal.
            cy.getStatusUpdateDialog().within(() => {
                // * Verify the default is as expected
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('[class$=singleValue]').should('have.text', '15 minutes');
                });
            });
        });

        it('shows the last reminder we typed in: 90 minutes', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '90 minutes');

            // # Run the `/playbook update` slash command.
            cy.uiPostMessageQuickly('/playbook update ');

            // # Get the dialog modal.
            cy.getStatusUpdateDialog().within(() => {
                // * Verify the default is as expected
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('[class$=singleValue]').should('have.text', '1 hour, 30 minutes');
                });
            });
        });

        it('shows the last reminder we typed in: 7 days', () => {
            const now = Date.now();
            const firstMessage = 'Update - ' + now;

            // # Create a first status update
            cy.updateStatus(firstMessage, '7 days');

            // # Run the `/playbook update` slash command.
            cy.uiPostMessageQuickly('/playbook update ');

            // # Get the dialog modal.
            cy.getStatusUpdateDialog().within(() => {
                // * Verify the default is as expected
                cy.get('#reminder_timer_datetime').within(() => {
                    cy.get('[class$=singleValue]').should('have.text', '7 days');
                });
            });
        });
    });

    describe('playbook with disabled status updates', () => {
        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser,
                broadcastChannelId: testChannel.id,
                statusUpdateEnabled: false,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });

        describe('omit status update dialog when status updates are disabled', () => {
            it('shows the default when we have not made an update before', () => {
                // * Check if RHS section is loaded
                cy.get('#rhs-about').should('exist');

                // * Check if Post Update section is omitted
                cy.get('#rhs-post-update').should('not.exist');
            });
        });
    });
});
