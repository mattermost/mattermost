// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ONE_SEC} from '../../../../fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > runlist', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPlaybook;
    let testChannel;
    // eslint-disable-next-line no-unused-vars
    let standaloneRun;
    let privatePlaybook;
    let privateRun;
    const numActiveRuns = 10;
    const numFinishedRuns = 4;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'The playbook name',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Create a test channel
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                    testChannel = channel;

                    // # Run the playbook a few times in the existing channel
                    for (let i = 0; i < numActiveRuns; i++) {
                        const runName = 'playbook-run-' + i;
                        cy.apiRunPlaybook({
                            teamId: testTeam.id,
                            playbookId: testPlaybook.id,
                            ownerUserId: testUser.id,
                            channelId: testChannel.id,
                            playbookRunName: runName,
                        });
                    }

                    // # Do it again but finished
                    for (let i = 0; i < numFinishedRuns; i++) {
                        const runName = 'playbook-run-' + i;
                        cy.apiRunPlaybook({
                            teamId: testTeam.id,
                            playbookId: testPlaybook.id,
                            ownerUserId: testUser.id,
                            channelId: testChannel.id,
                            playbookRunName: runName,
                        }).then((run) => {
                            cy.apiFinishRun(run.id);
                        });
                    }

                    // # Create a standalone run without a playbook (channel checklist) in the same channel
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: '', // Empty playbook ID for standalone run
                        playbookRunName: 'standalone checklist',
                        ownerUserId: testUser.id,
                        channelId: testChannel.id,
                    }).then((run) => {
                        standaloneRun = run;
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

                            // # Create a run from the private playbook in the same channel
                            cy.apiRunPlaybook({
                                teamId: testTeam.id,
                                playbookId: privatePlaybook.id,
                                playbookRunName: 'private run',
                                ownerUserId: testUser.id,
                                channelId: testChannel.id,
                            }).then((run) => {
                                privateRun = run;

                                // # Add viewerUser as participant to the run
                                cy.apiAddUsersToRun(privateRun.id, [testViewerUser.id]);
                            });
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

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Wait the RHS to load
        cy.findByText('In progress').should('be.visible');
    });

    it('can filter', () => {
        // # Click the filter menu
        cy.findByTestId('rhs-runs-filter-menu').click();

        // * Verify displayed options
        cy.findByTestId('dropdownmenu').within(() => {
            cy.findByText(`${numActiveRuns + 2}`).should('exist');
            cy.findByText(`${numFinishedRuns}`).should('exist');
        });

        // # Click the filter for finished runs
        cy.findByTestId('dropdownmenu').findByText(`${numFinishedRuns}`).click();

        // # Wait for filtering to complete - API needs time to apply include_ended=true
        cy.wait(500);

        // * Verify exactly the number of finished runs are displayed
        cy.findByTestId('rhs-runs-list').children().should('have.length', numFinishedRuns);
    });

    it('can show more (pagination)', () => {
        // * Verify we have the first page
        cy.findByTestId('rhs-runs-list').findAllByTestId('run-list-card').should('have.length', 8);

        // # Click the show-more button
        cy.findByTestId('rhs-runs-list').findByRole('button', {name: /show more/i}).click();

        // * Verify we have loaded the second page
        cy.findByTestId('rhs-runs-list').findAllByTestId('run-list-card').should('have.length', numActiveRuns + 2);
    });

    it('card has the basic info', () => {
        // # Find the run card by its name
        cy.findByTestId('rhs-runs-list').contains('[data-testid="run-list-card"]', 'playbook-run-9').within(() => {
            cy.findByText('playbook-run-9').should('be.visible');
            cy.findByText('The playbook name').should('be.visible');
            cy.findByText(testUser.username).should('be.visible');
        });
    });

    it('can click through', () => {
        // # Click the run card with playbook-run-9
        cy.findByTestId('rhs-runs-list').contains('[data-testid="run-list-card"]', 'playbook-run-9').click();

        // * Verify we made it to the run details at Channels RHS
        cy.get('#rhsContainer').should('exist').within(() => {
            cy.findByText('playbook-run-9').should('exist');
        });
        cy.findByTestId('pb-checklists-inner-container').within(() => {
            cy.findByText('Tasks').should('be.visible');
        });
    });

    describe('dotmenu', () => {
        it('can navigate to RDP', () => {
            // # Click the run's dotmenu button
            cy.findByTestId('rhs-runs-list').contains('[data-testid="run-list-card"]', privateRun.name).findByRole('button').click();

            // # Click on go to run
            cy.findByText('Go to overview').click();

            // * Assert we are in the run details page
            cy.url().should('include', '/playbooks/runs/');
            cy.url().should('include', '?from=channel_rhs_dotmenu');
        });

        it('can navigate to PBE', () => {
            // # Click the run's dotmenu button
            cy.findByTestId('rhs-runs-list').contains('[data-testid="run-list-card"]', privateRun.name).findByRole('button').click();

            // # Click on go to playbook
            cy.findByText('Go to playbook').click();

            cy.wait(5000);

            // * Assert we are in the PBE page
            cy.findByTestId('playbook-editor-title').should('contain', privatePlaybook.title);
        });

        it('hides "Go to playbook" for standalone runs', () => {
            // # Visit the channel with the standalone run
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Wait for the RHS to load
            cy.findByText('In progress').should('be.visible');

            // # Find the standalone run card by its name and click its dotmenu
            cy.findByTestId('rhs-runs-list').contains('standalone checklist').parents('div[data-testid="run-list-card"]').findByRole('button').click();

            // * Verify "Go to playbook" does not exist
            cy.findByTestId('dropdownmenu').within(() => {
                cy.findByText('Go to playbook').should('not.exist');
                cy.findByText('Move to a different channel').should('exist');
            });
        });

        it('hides "Go to playbook" for private playbooks without access', () => {
            // # Login as viewer and visit the channel
            cy.apiLogin(testViewerUser);
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Wait for the RHS to load
            cy.findByText('In progress').should('be.visible');

            // # Find the private run card by its name and click its dotmenu
            cy.findByTestId('rhs-runs-list').contains(privateRun.name).parents('div[data-testid="run-list-card"]').findByRole('button').click();

            // * Verify "Go to playbook" does not exist for user without access
            cy.findByTestId('dropdownmenu').within(() => {
                cy.findByText('Go to playbook').should('not.exist');
                cy.findByText('Go to overview').should('exist');
            });
        });

        // https://mattermost.atlassian.net/browse/MM-63692
        // eslint-disable-next-line no-only-tests/no-only-tests
        it('can change linked channel', () => {
            // # Click on the first run's dotmenu button
            cy.findByTestId('rhs-runs-list').findAllByTestId('run-list-card').first().findByRole('button').click();

            // # Click on the move to a different channel option
            cy.findByText('Move to a different channel').click();

            // # Select town square channel
            cy.get('#link_existing_channel_selector').click().type('Town Square{enter}');

            // # Click save
            cy.findByTestId('modal-confirm-button').click();

            // # Let the listing refresh
            cy.wait(1000);

            // * Verify we have the first page (8 cards)
            cy.findByTestId('rhs-runs-list').findAllByTestId('run-list-card').should('have.length', 8);

            // # Click the show-more button
            cy.findByTestId('rhs-runs-list').findByRole('button', {name: /show more/i}).click();

            // * Verify the channel has changed, now one run less (11 total instead of 12)
            cy.findByTestId('rhs-runs-list').findAllByTestId('run-list-card').should('have.length', 11);
        });

        describe('navigation', () => {
            let testChannelWith2Runs;
            before(() => {
                cy.apiLogin(testUser);

                // # Create a test channel
                cy.apiCreateChannel(testTeam.id, 'channel', 'Channel').then(({channel}) => {
                    testChannelWith2Runs = channel;

                    // # Run the playbook a few times in the existing channel
                    for (let i = 0; i < 2; i++) {
                        const runName = 'playbook-run-' + i;
                        cy.apiRunPlaybook({
                            teamId: testTeam.id,
                            playbookId: testPlaybook.id,
                            ownerUserId: testUser.id,
                            channelId: testChannelWith2Runs.id,
                            playbookRunName: runName,
                        });
                    }
                });
            });

            it('stays at list even if one only linked run after moving run', () => {
                // # Visit channel with 2 runs
                cy.visit(`/${testTeam.name}/channels/${testChannelWith2Runs.name}`);

                // # Click on the first run's dotmenu button
                cy.findByTestId('rhs-runs-list').findAllByTestId('run-list-card').first().findByRole('button').click();

                // # Click on the move to a different channel option
                cy.findByText('Move to a different channel').click();

                cy.wait(ONE_SEC);

                // # Select town square channel
                cy.get('#link_existing_channel_selector').click().type('Town Square{enter}');

                // # Click save
                cy.findByTestId('modal-confirm-button').click();

                // * Verify the run is not there, but we are still in the list (not rhs details) - only 1 card remains
                cy.findByTestId('rhs-runs-list').findAllByTestId('run-list-card').should('have.length', 1);
            });
        });
    });
});
