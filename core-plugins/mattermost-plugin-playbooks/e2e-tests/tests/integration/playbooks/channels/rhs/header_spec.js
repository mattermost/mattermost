// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

import * as TIMEOUTS from '../../../../fixtures/timeouts';

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > header', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testViewerUser;
    // eslint-disable-next-line no-unused-vars
    let standaloneRun;
    // eslint-disable-next-line no-unused-vars
    let standaloneRunChannelName;
    let privatePlaybook;
    let privateRun;
    // eslint-disable-next-line no-unused-vars
    let privateRunChannelName;

    before(() => {
        cy.apiInitSetup().then(({team, user, channel}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Create a standalone run without a playbook (channel checklist) in existing channel (MM-67648)
                const now = Date.now();
                const standaloneRunName = 'Standalone Run (' + now + ')';
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: '', // Empty playbook ID for standalone run
                    playbookRunName: standaloneRunName,
                    ownerUserId: testUser.id,
                    channelId: channel.id,
                }).then((run) => {
                    standaloneRun = run;

                    // # Get the actual channel name from the API
                    cy.apiGetChannel(run.channel_id).then(({channel: ch}) => {
                        standaloneRunChannelName = ch.name;
                    });
                });

                // # Create a second user (viewer) and add to team
                cy.apiCreateUser().then(({user: viewerUser}) => {
                    testViewerUser = viewerUser;
                    cy.apiAddUserToTeam(testTeam.id, testViewerUser.id);

                    // # Create a private playbook with only testUser as member
                    cy.apiCreatePlaybook({
                        teamId: testTeam.id,
                        title: 'Private Playbook',
                        memberIDs: [testUser.id], // Only testUser is a member
                        makePublic: false,
                    }).then((privPlaybook) => {
                        privatePlaybook = privPlaybook;

                        // # Create a run from the private playbook
                        const privateRunName = 'Private Run (' + Date.now() + ')';
                        cy.apiRunPlaybook({
                            teamId: testTeam.id,
                            playbookId: privatePlaybook.id,
                            playbookRunName: privateRunName,
                            ownerUserId: testUser.id,
                        }).then((run) => {
                            privateRun = run;

                            // # Get the actual channel name from the API
                            cy.apiGetChannel(run.channel_id).then(({channel: ch}) => {
                                privateRunChannelName = ch.name;
                            });

                            // # Add viewerUser as participant to the run
                            cy.apiAddUsersToRun(privateRun.id, [testViewerUser.id]);
                        });
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');
    });

    describe('shows name', () => {
        it('of active playbook run', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // * Verify the title is displayed
            cy.get('#rhsContainer').contains(playbookRunName);
        });

        it('of renamed playbook run', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # Navigate directly to the application and the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Verify the existing title is displayed
                cy.get('#rhsContainer').contains(playbookRunName);

                // # Rename the channel
                cy.apiPatchChannel(playbookRun.channel_id, {
                    id: playbookRun.channel_id,
                    display_name: 'Updated',
                });

                // * Verify the updated title is displayed
                cy.get('#rhsContainer').contains(playbookRunName);
            });
        });
    });

    describe('edit summary', () => {
        it('by clicking on placeholder', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // # click on the field
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').click();

            // # type text in textarea
            cy.get('#rhsContainer').findByTestId('textarea-description').should('be.visible').type('new summary{ctrl+enter}');

            // * make sure the updated summary is here
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').contains('new summary');

            // * reload the page
            cy.reload();

            // * make sure the updated summary is still there
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').contains('new summary');
        });
    });

    describe('playbook badge', () => {
        it('is shown for runs started from a playbook and navigates to playbook editor when clicked', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            });

            // # Navigate to the run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // * Verify the playbook badge is visible and shows the playbook name
            cy.findByTestId('playbook-badge').should('be.visible').and('contain', 'Playbook');

            // # Click the playbook badge
            cy.findByTestId('playbook-badge').click();

            // * Verify we navigated to the playbook editor
            cy.url().should('include', `/playbooks/${testPlaybook.id}`);
        });

        it('is hidden for runs started from a playbook I do not have access to', () => {
            // # Login as viewer and navigate to the private run
            cy.apiLogin(testViewerUser);
            cy.visit(`/${testTeam.name}/channels/${privateRunChannelName}`);

            // * Verify the playbook badge does not exist
            cy.findByTestId('playbook-badge').should('not.exist');
        });

        it('is hidden for channel checklists', () => {
            // # Navigate to the standalone run channel (channel checklist)
            cy.visit(`/${testTeam.name}/channels/${standaloneRunChannelName}`);

            // * Verify the playbook badge does not exist
            cy.findByTestId('playbook-badge').should('not.exist');
        });
    });

    describe('edit summary of finished run', () => {
        let playbookRunChannelName;
        let finishedPlaybookRun;

        beforeEach(() => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                finishedPlaybookRun = playbookRun;
            });
        });

        it('by clicking on placeholder', () => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // # Wait for the RHS to open
            cy.get('#rhsContainer').should('be.visible');

            // # Mark the run as finished
            cy.apiFinishRun(finishedPlaybookRun.id);

            cy.wait(TIMEOUTS.TWO_SEC);

            // # click on the field
            cy.get('#rhsContainer').findByTestId('rendered-description').should('be.visible').click();

            // * Verify textarea does not appear
            cy.get('#rhsContainer').findByTestId('textarea-description').should('not.exist');

            // * Verify no prompt to join appears (timeout ensures it fails right away before toast disappears)
            cy.findByText('Become a participant to interact with this run', {timeout: 500}).should('not.exist');
        });
    });

    describe('rename checklist', () => {
        it('can rename active checklist from RHS header', () => {
            // # Visit the standalone run channel (channel checklist)
            cy.visit(`/${testTeam.name}/channels/${standaloneRunChannelName}`);

            // # Wait for the RHS to open (standalone runs may not auto-open)
            cy.get('#rhsContainer').should('exist');

            // # Click on the checklist dropdown in the RHS header
            cy.get('#rhsContainer').findByTestId('menuButton').should('be.visible').click();

            // * Verify "Rename" option exists for active checklists
            cy.findByTestId('dropdownmenu').within(() => {
                cy.findByText('Rename').should('exist');
                cy.findByText('Finish').should('exist');
            });
        });

        it('cannot rename finished checklist from RHS header', () => {
            // # Visit the standalone run channel (channel checklist)
            cy.visit(`/${testTeam.name}/channels/${standaloneRunChannelName}`);

            // # Wait for the RHS to open (standalone runs may not auto-open)
            cy.get('#rhsContainer').should('exist');

            // # Finish the checklist and wait for RHS to reflect finished state
            cy.apiFinishRun(standaloneRun.id);
            cy.get('#rhsContainer').within(() => {
                cy.findByText('Finished').should('be.visible');
                cy.findByRole('button', {name: 'Done'}).should('be.visible');
            });

            // # Click on the title menu in the RHS header
            cy.get('#rhsContainer').findByTestId('menuButton').should('be.visible').click();

            // * Verify "Rename" option does not exist for finished checklists
            cy.findByTestId('dropdownmenu').within(() => {
                cy.findByText('Save as playbook');
                cy.findByText('Resume');
                cy.findByText('Rename').should('not.exist');
            });
        });
    });
});
