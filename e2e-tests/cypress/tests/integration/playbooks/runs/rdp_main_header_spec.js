// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {stubClipboard} from '../../../utils';

describe('runs > run details page > header', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testPublicPlaybookAndChannel;
    let playbookRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create another user in the same team
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

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                createPublicPlaybookRun: true,
                memberIDs: [],
            }).then((playbook) => {
                testPublicPlaybookAndChannel = playbook;
            });
        });
    });

    const openRunActionsModal = () => {
        // # Click on the run actions modal button
        cy.findByRole('button', {name: /Run Actions/i}).click({force: true});

        // * Verify that the modal is shown
        cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');
    };

    const saveRunActionsModal = () => {
        // # Click on the Save button without changing anything
        cy.findByRole('button', {name: /Save/i}).click();

        // * Verify that the modal is no longer there
        cy.findByRole('dialog', {name: /Run Actions/i}).should('not.exist');
    };

    const getHeader = () => {
        return cy.findByTestId('run-header-section');
    };

    const getHeaderIcon = (selector) => {
        return getHeader().find(selector);
    };

    const getDropdownItemByText = (text) => {
        cy.findByTestId('run-header-section').find('h1').click();
        return cy.findByTestId('dropdownmenu').findByText(text);
    };

    const commonHeaderTests = () => {
        it('shows the title', () => {
            // * Assert title is shown in h1 inside header
            cy.findByTestId('run-header-section').find('h1').contains(playbookRun.name);
        });

        it('shows the in-progress status badge', () => {
            // * Assert in progress status badge
            cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');
        });

        it('has a copy-link icon', () => {
            // # Mouseover on the icon
            getHeaderIcon('.icon-link-variant').trigger('mouseover');

            // * Assert tooltip is shown
            cy.get('#copy-run-link-tooltip').should('contain', 'Copy link to run');

            stubClipboard().as('clipboard');
            getHeaderIcon('.icon-link-variant').click().then(() => {
                // * Verify that tooltip text changed
                cy.get('#copy-run-link-tooltip').should('contain', 'Copied!');

                // * Verify clipboard content
                cy.get('@clipboard').its('contents').should('contain', `/playbooks/runs/${playbookRun.id}`);
            });
        });
    };

    const commonContextDropdownTests = () => {
        it('shows on click', () => {
            // # Click title
            cy.findByTestId('run-header-section').find('h1').click();

            // * Assert context menu is opened
            cy.findByTestId('dropdownmenu').should('be.visible');
        });

        it('can copy link', () => {
            stubClipboard().as('clipboard');

            getDropdownItemByText('Copy link').click().then(() => {
                // * Verify clipboard content
                cy.get('@clipboard').its('contents').should('contain', `/playbooks/runs/${playbookRun.id}`);
            });
        });
    };

    describe('as participant', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'the run name(' + Date.now() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                // # Visit the playbook run
                cy.visit(`/playbooks/runs/${playbookRun.id}`);

                cy.assertRunDetailsPageRenderComplete(testUser.username);
            });
        });

        describe('title, icons and buttons', () => {
            commonHeaderTests();

            it('has not participate button', () => {
                // * Assert button is not showed
                getHeader().findByText('Participate').should('not.exist');
            });

            describe('run actions', () => {
                describe('modal behaviour', () => {
                    it('shows and hides as expected', () => {
                        // * Verify that the run actions modal is shown when clicking on the button
                        openRunActionsModal();

                        // # Click on the Cancel button
                        cy.findByRole('button', {name: /Cancel/i}).click();

                        // * Verify that the modal is no longer there
                        cy.findByRole('dialog', {name: /Run Actions/i}).should('not.exist');

                        // # Open the run actions modal
                        openRunActionsModal();

                        // Intercept all telemetry calls
                        cy.interceptTelemetry();

                        // * Verify that saving the modal hides it
                        saveRunActionsModal();

                        // * assert telemetry call
                        cy.expectTelemetryToContain([
                            {
                                name: 'playbookrun_update_actions',
                                type: 'track',
                                properties: {
                                    playbookrun_id: playbookRun.id,
                                    playbook_id: playbookRun.playbook_id,
                                },
                            },
                        ]);
                    });

                    it('can not save an invalid form', () => {
                        // * Verify that the run actions modal is shown when clicking on the button
                        openRunActionsModal();

                        cy.findByRole('dialog', {name: /Run Actions/i}).within(() => {
                            // # click on webhooks toggle
                            cy.findByText('Send outgoing webhook').click();

                            // # Type an invalid webhook URL
                            cy.getStyledComponent('TextArea').clear().type('invalidurl');

                            // # Click outside textarea
                            cy.findByText('Run Actions').click();

                            // * Assert the error message is displayed
                            cy.findByText('Invalid webhook URLs').should('be.visible');

                            // # Click save
                            cy.findByTestId('modal-confirm-button').click();

                            // * Assert that modal is still open
                            cy.findByText('Run Actions').should('be.visible');
                        });
                    });

                    it('honours the settings from the playbook', () => {
                        cy.apiCreateChannel(
                            testTeam.id,
                            'action-channel',
                            'Action Channel',
                            'O',
                        ).then(({channel}) => {
                            // # Create a different playbook with both settings enabled and populated with data,
                            // # and then start a run from it
                            const broadcastChannelIds = [channel.id];
                            const webhookOnStatusUpdateURLs = ['https://one.com', 'https://two.com'];
                            cy.apiCreatePlaybook({
                                teamId: testTeam.id,
                                title: 'Playbook' + Date.now(),
                                broadcastEnabled: true,
                                broadcastChannelIds,
                                webhookOnStatusUpdateEnabled: true,
                                webhookOnStatusUpdateURLs,
                            }).then((playbook) => {
                                cy.apiRunPlaybook({
                                    teamId: testTeam.id,
                                    playbookId: playbook.id,
                                    playbookRunName: 'Run with actions preconfigured',
                                    ownerUserId: testUser.id,
                                });
                            });

                            // # Navigate to the run page
                            cy.visit(`/${testTeam.name}/channels/run-with-actions-preconfigured`);
                            cy.findByRole('button', {name: /Run details/i}).click({force: true});

                            // # Open the run actions modal
                            openRunActionsModal();

                            // * Verify that the broadcast-to-channels toggle is checked
                            cy.findByText('Broadcast update to selected channels').parent().within(() => {
                                cy.get('input').should('be.checked');
                            });

                            // * Verify that the channel is in the selector
                            cy.findByText(channel.display_name);

                            // * Verify that the send-webhooks toggle is checked
                            cy.findByText('Send outgoing webhook').parent().within(() => {
                                cy.get('input').should('be.checked');
                            });
                        });
                    });
                });
            });

            describe('trigger: when a status update is posted', () => {
                describe('action: Broadcast update to selected channels', () => {
                    it('shows channel information on first load', () => {
                        // # Open the run actions modal
                        openRunActionsModal();

                        // # Enable broadcast to channels
                        cy.findByText('Broadcast update to selected channels').click();

                        // # Select a couple of channels
                        cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}');

                        // # Save the changes
                        saveRunActionsModal();

                        // # Reload the page, so that the store is not pre-populated when visiting Channels
                        cy.visit(`/playbooks/runs/${playbookRun.id}/overview`);

                        // # Open the run actions modal
                        openRunActionsModal();

                        // * Check that the channels previously added are shown with their full name,
                        // * verifying that the store has been populated by the modal component.
                        cy.findByText('Town Square').should('exist');
                        cy.findByText('Off-Topic').should('exist');
                    });

                    it('broadcasts to two channels configured when it is enabled', () => {
                        // # Open the run actions modal
                        openRunActionsModal();

                        // # Enable broadcast to channels
                        cy.findByText('Broadcast update to selected channels').click();

                        // # Select a couple of channels
                        cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}', {delay: 100});

                        // # Save the changes
                        saveRunActionsModal();

                        // # Post a status update, with a reminder in 1 second.
                        const message = 'Status update - ' + Date.now();
                        cy.apiUpdateStatus({
                            playbookRunId: playbookRun.id,
                            message,
                        });

                        // # Navigate to the town square channel
                        cy.visit(`/${testTeam.name}/channels/town-square`);

                        // * Verify that the last post contains the status update
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(message);
                        });

                        // # Navigate to the off-topic channel
                        cy.visit(`/${testTeam.name}/channels/off-topic`);

                        // * Verify that the last post contains the status update
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(message);
                        });
                    });

                    it('does not broadcast if it is disabled, even if there are channels configured', () => {
                        // # Open the run actions modal
                        openRunActionsModal();

                        // # Enable broadcast to channels
                        cy.findByText('Broadcast update to selected channels').click();

                        // # Select a couple of channels
                        cy.findByText('Select channels').click().type('town square{enter}off-topic{enter}', {delay: 100});

                        // # Disable broadcast to channels
                        cy.findByText('Broadcast update to selected channels').click();

                        // # Save the changes
                        saveRunActionsModal();

                        // # Post a status update, with a reminder in 1 second.
                        const message = 'Status update - ' + Date.now();
                        cy.apiUpdateStatus({
                            playbookRunId: playbookRun.id,
                            message,
                        });

                        // # Navigate to the town square channel
                        cy.visit(`/${testTeam.name}/channels/town-square`);

                        // * Verify that the last post does not contain the status update
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(message).should('not.exist');
                        });

                        // # Navigate to the off-topic channel
                        cy.visit(`/${testTeam.name}/channels/off-topic`);

                        // * Verify that the last post does not contain the status update
                        cy.getLastPost().then((post) => {
                            cy.get(post).contains(message).should('not.exist');
                        });
                    });
                });
            });
        });

        describe('context menu', () => {
            commonContextDropdownTests();

            it('can rename run', () => {
                // # Click on rename run
                getDropdownItemByText('Rename run').click();

                cy.findByTestId('run-header-section').within(() => {
                    // # Type a new name
                    cy.findByTestId('rendered-editable-text').clear().type('The new fancy name');

                    // # Save
                    cy.findByTestId('checklist-item-save-button').click();

                    // * Assert name is updated
                    cy.get('h1').contains('The new fancy name');
                });

                cy.reload();

                cy.findByTestId('run-header-section').within(() => {
                    // * Assert name is persisted
                    cy.get('h1').contains('The new fancy name');
                });
            });

            describe('finish run', () => {
                it('can be confirmed', () => {
                    // * Check that status badge is in-progress
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

                    // # Click on finish run
                    getDropdownItemByText('Finish run').click();

                    // # Check that finish run modal is open
                    cy.get('#confirmModal').should('be.visible');
                    cy.get('#confirmModal').find('h1').contains('Confirm finish run');

                    // # Click on confirm
                    cy.get('#confirmModal').get('#confirmModalButton').click();

                    // * Assert option is not anymore in context dropdown
                    getDropdownItemByText('Finish run').should('not.exist');

                    // * Assert status badge is finished
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('Finished');
                });

                it('can be canceled', () => {
                    // * Check that status badge is in-progress
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');

                    // # Click on finish run
                    getDropdownItemByText('Finish run').click();

                    // * Check that finish run modal is open
                    cy.get('#confirmModal').should('be.visible');
                    cy.get('#confirmModal').find('h1').contains('Confirm finish run');

                    // # Click on cancel
                    cy.get('#confirmModal').get('#cancelModalButton').click();

                    // * Assert option is not anymore in context dropdown
                    getDropdownItemByText('Finish run').should('be.visible');

                    // * Assert status badge is still in progress
                    cy.findByTestId('run-header-section').findByTestId('badge').contains('In Progress');
                });
            });

            describe('run actions', () => {
                it('modal can be opened', () => {
                    // # Click on finish run
                    getDropdownItemByText('Run actions').click();

                    // * Assert modal pop up
                    cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');

                    // # Click on cancel
                    cy.findByRole('dialog', {name: /Run Actions/i}).findByTestId('modal-cancel-button').click();

                    // * Assert modal disappeared
                    cy.findByRole('dialog', {name: /Run Actions/i}).should('not.exist');
                });
            });

            describe('leave run', () => {
                it('can leave run', () => {
                    // # Intercept all calls to telemetry
                    cy.interceptTelemetry();

                    // # Add viewer user to the channel
                    cy.apiAddUsersToRun(playbookRun.id, [testViewerUser.id]);
                    cy.findAllByTestId('timeline-item', {exact: false}).should('have.length', 3);

                    // # Change the owner to testViewerUser
                    cy.apiChangePlaybookRunOwner(playbookRun.id, testViewerUser.id);
                    cy.findByTestId('assignee-profile-selector').should('contain', testViewerUser.username);

                    // # Click on leave run
                    getDropdownItemByText('Leave and unfollow run').click();

                    // # confirm modal
                    cy.get('#confirmModal').get('#confirmModalButton').click();

                    // NOTE: this check fails because the front doesn't receive updated run object. Will deal in separate PR.
                    // * Assert that the Participate button is shown
                    getHeader().findByText('Participate').should('be.visible');

                    // * Verify run has been removed from LHS
                    cy.findByTestId('lhs-navigation').findByText(playbookRun.name).should('not.exist');

                    // # assert telemetry data
                    cy.expectTelemetryToContain([
                        {
                            name: 'playbookrun_leave',
                            type: 'track',
                            properties: {
                                from: 'run_details',
                                playbookrun_id: playbookRun.id,
                            },
                        },
                    ]);
                });
            });
        });
    });

    describe('as viewer', () => {
        let playbookRunChannelName;
        let playbookRunName;

        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            const now = Date.now();
            playbookRunName = 'Playbook Run (' + now + ')';
            playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                cy.apiLogin(testViewerUser).then(() => {
                    // # Visit the playbook run
                    cy.visit(`/playbooks/runs/${playbookRun.id}`);
                });

                cy.assertRunDetailsPageRenderComplete(testUser.username);
            });
        });

        describe('title, icons and buttons', () => {
            commonHeaderTests();

            describe('Favorite', () => {
                it('add and remove from LHS', () => {
                    // # Click fav icon
                    getHeader().getStyledComponent('StarButton').click();

                    // * Assert run appears in LHS
                    cy.findByTestId('lhs-navigation').findByText(playbookRunName).should('exist');

                    // # Click fav icon again (unfav)
                    getHeader().getStyledComponent('StarButton').click();

                    // * Assert run disappeared from LHS
                    cy.findByTestId('lhs-navigation').findByText(playbookRunName).should('not.exist');
                });
            });

            describe('Participate', () => {
                it('shows button', () => {
                    // * Assert that the button is shown
                    getHeader().findByText('Participate').should('be.visible');
                });

                describe('Join action enabled', () => {
                    it('click button to show modal and cancel', () => {
                        // * Assert that component is rendered
                        getHeader().findByText('Participate').should('be.visible');

                        // # Click Participate button
                        getHeader().findByText('Participate').click();

                        // * Verify modal message is correct
                        cy.findByText('You’ll also be added to the channel linked to this run.').should('exist');

                        // # cancel modal
                        cy.findByTestId('modal-cancel-button').click();

                        // * Assert modal is not shown
                        cy.get('#become-participant-modal').should('not.exist');

                        // # Login as testUser
                        cy.apiLogin(testUser).then(() => {
                            // # Visit the channel run
                            cy.visit(`${testTeam.name}/channels/${playbookRunChannelName}`);

                            // * Assert user has not been added to the channel
                            cy.getLastPost().should('not.contain', 'Someone');
                            cy.getLastPost().should('not.contain', testViewerUser.username);
                        });
                    });

                    it('click button to show modal and confirm when private channel', () => {
                        // # Intercept all calls to telemetry
                        cy.interceptTelemetry();

                        // * Assert component is rendered
                        getHeader().findByText('Participate').should('be.visible');

                        // # Click start-participating button
                        getHeader().findByText('Participate').click();

                        // * Verify modal message is correct
                        cy.findByText('You’ll also be added to the channel linked to this run.').should('exist');

                        // # confirm modal
                        cy.findByTestId('modal-confirm-button').click();

                        // * Assert that modal is not shown
                        cy.get('#become-participant-modal').should('not.exist');

                        // * Verify run has been added to LHS
                        verifyRunHasBeenAddedToLHS(playbookRunName);

                        // # Navigate to the playbook run channel
                        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                        // # Verify channel loads
                        cy.get('#channelHeaderTitle').should('be.visible').should('contain', playbookRunName);

                        // * assert telemetry data
                        cy.expectTelemetryToContain([
                            {
                                name: 'playbookrun_participate',
                                type: 'track',
                                properties: {
                                    from: 'run_details',
                                    playbookrun_id: playbookRun.id,
                                },
                            },
                        ]);
                    });

                    it('click button and confirm to when public channel', () => {
                        // # Login as testUser
                        cy.apiLogin(testUser);

                        const now = Date.now();
                        playbookRunName = 'Playbook Run (' + now + ')';
                        playbookRunChannelName = 'playbook-run-' + now;

                        // # Create a run with public chanel
                        cy.apiRunPlaybook({
                            teamId: testTeam.id,
                            playbookId: testPublicPlaybookAndChannel.id,
                            playbookRunName,
                            ownerUserId: testUser.id,
                        }).then((run) => {
                            cy.apiLogin(testViewerUser);

                            // # Visit the playbook run
                            cy.visit(`/playbooks/runs/${run.id}`);
                            cy.assertRunDetailsPageRenderComplete(testUser.username);

                            // * Assert that component is rendered
                            getHeader().findByText('Participate').should('be.visible');

                            // # Click start-participating button
                            getHeader().findByText('Participate').click();

                            // * Verify modal message is correct
                            cy.findByText('You’ll also be added to the channel linked to this run.').should('exist');

                            // # confirm modal
                            cy.findByTestId('modal-confirm-button').click();

                            // * Assert that modal is not shown
                            cy.get('#become-participant-modal').should('not.exist');

                            // * Verify run has been added to LHS
                            cy.findByTestId('lhs-navigation').findByText(playbookRunName).should('exist');

                            // # Navigate to the playbook run channel
                            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                            // # Verify channel loads
                            cy.get('#channelHeaderTitle').should('be.visible').should('contain', playbookRunName);
                        });
                    });
                });

                describe('Join action disabled', () => {
                    beforeEach(() => {
                        cy.apiLogin(testUser);

                        // # Disable join action
                        cy.apiUpdateRun(playbookRun.id, {createChannelMemberOnNewParticipant: false});

                        cy.apiLogin(testViewerUser).then(() => {
                            // # Visit the playbook run
                            cy.visit(`/playbooks/runs/${playbookRun.id}`);
                        });

                        cy.assertRunDetailsPageRenderComplete(testUser.username);
                    });

                    it('join the run with private channel, request to join the channel', () => {
                        // # Click start-participating button
                        getHeader().findByText('Participate').click();

                        // * Verify modal message is correct
                        cy.findByText('Request access to the channel linked to this run').should('exist');

                        // # Select checkbox
                        cy.findByTestId('also-add-to-channel').click({force: true});

                        // # confirm modal
                        cy.findByTestId('modal-confirm-button').click();

                        // * Assert that modal is not shown
                        cy.get('#become-participant-modal').should('not.exist');

                        // * Verify run has been added to LHS
                        verifyRunHasBeenAddedToLHS(playbookRunName);

                        // # Login as testUser to check if join request was posted in the channel
                        cy.apiLogin(testUser);

                        // # Navigate to the playbook run channel
                        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                        // * Verify that the request was sent to the channel
                        cy.getLastPostId().then((id) => {
                            cy.get(`#postMessageText_${id}`).within(() => {
                                cy.contains(`@${testViewerUser.username} is a run participant and wants join this channel. Any member of the channel can invite them.`);
                            });
                        });
                    });

                    it('join the run with private channel, no request to join the channel', () => {
                        // # Click start-participating button
                        getHeader().findByText('Participate').click();

                        // * Verify modal message is correct
                        cy.findByText('Request access to the channel linked to this run').should('exist');

                        // # confirm modal
                        cy.findByTestId('modal-confirm-button').click();

                        // * Assert that modal is not shown
                        cy.get('#become-participant-modal').should('not.exist');

                        // * Verify run has been added to LHS
                        verifyRunHasBeenAddedToLHS(playbookRunName);

                        // # Login as testUser to check if join request was posted in the channel
                        cy.apiLogin(testUser);

                        // # Navigate to the playbook run channel
                        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                        // * Verify that the request was sent to the channel
                        cy.getLastPostId().then((id) => {
                            cy.get(`#postMessageText_${id}`).within(() => {
                                cy.contains(`@${testViewerUser.username} is a run participant and wants join this channel. Any member of the channel can invite them.`).should('not.exist');
                            });
                        });
                    });

                    it('join run with public channel, join the channel', () => {
                        // # Login as testUser
                        cy.apiLogin(testUser);

                        const now = Date.now();
                        playbookRunName = 'Playbook Run (' + now + ')';
                        playbookRunChannelName = 'playbook-run-' + now;

                        // Create a run with public chanel
                        cy.apiRunPlaybook({
                            teamId: testTeam.id,
                            playbookId: testPublicPlaybookAndChannel.id,
                            playbookRunName,
                            ownerUserId: testUser.id,
                        }).then((run) => {
                            cy.apiLogin(testViewerUser);

                            // # Visit the playbook run
                            cy.visit(`/playbooks/runs/${run.id}`);
                            cy.assertRunDetailsPageRenderComplete(testUser.username);

                            // * Assert that component is rendered
                            getHeader().findByText('Participate').should('be.visible');

                            // # Click start-participating button
                            getHeader().findByText('Participate').click();

                            // * Verify modal message is correct
                            cy.findByText('You’ll also be added to the channel linked to this run.').should('exist');

                            // # confirm modal
                            cy.findByTestId('modal-confirm-button').click();

                            // * Assert that modal is not shown
                            cy.get('#become-participant-modal').should('not.exist');

                            // * Verify run has been added to LHS
                            cy.findByTestId('lhs-navigation').findByText(playbookRunName).should('exist');

                            // # Navigate to the playbook run channel
                            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                            // # Verify channel loads
                            cy.get('#channelHeaderTitle').should('be.visible').should('contain', playbookRunName);
                        });
                    });
                });
            });

            describe('run actions', () => {
                describe('modal behaviour', () => {
                    it('modal can be opened read-only', () => {
                        // # Click on run actions
                        getDropdownItemByText('Run actions').click();

                        // * Assert modal pop up
                        cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');

                        // * Assert there are no buttons
                        cy.findByRole('dialog', {name: /Run Actions/i}).findByTestId('modal-cancel-button').should('not.exist');
                        cy.findByRole('button', {name: /Save/i}).should('not.exist');

                        // # Close modal
                        cy.findByRole('dialog', {name: /Run Actions/i}).find('.close').click();
                    });
                });
            });
        });

        describe('context menu', () => {
            commonContextDropdownTests();

            it('can not rename run', () => {
                // # There's no rename  option
                getDropdownItemByText('Rename run').should('not.exist');
            });

            it('can not finish run', () => {
                // * There's no finish run item
                getDropdownItemByText('Finish run').should('not.exist');
            });

            describe('run actions', () => {
                it('modal can be opened read-only', () => {
                    // # Click on finish run
                    getDropdownItemByText('Run actions').click();

                    // * Assert modal pop up
                    cy.findByRole('dialog', {name: /Run Actions/i}).should('exist');

                    // * Assert there are no buttons
                    cy.findByRole('dialog', {name: /Run Actions/i}).findByTestId('modal-cancel-button').should('not.exist');
                    cy.findByRole('button', {name: /Save/i}).should('not.exist');

                    // # Close modal
                    cy.findByRole('dialog', {name: /Run Actions/i}).find('.close').click();
                });
            });
        });
    });
});

const verifyRunHasBeenAddedToLHS = (playbookRunName) => {
    // * Verify run has been added to LHS
    cy.findByTestId('lhs-navigation').
        should('be.visible').
        findByText(playbookRunName).
        should('be.visible');
};
