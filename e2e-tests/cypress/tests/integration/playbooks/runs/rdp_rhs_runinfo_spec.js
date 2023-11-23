// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run details page > run info', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testRun;

    const getHeader = () => {
        return cy.findByTestId('run-header-section');
    };

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

    const getRHSSection = (title) => cy.findByRole('complementary').contains('section', title);

    describe('> overview', () => {
        const getOverviewEntry = (entryName) => (
            getRHSSection('Overview').findByTestId(`runinfo-${entryName}`)
        );

        const commonTests = () => {
            it('Playbook entry links to the playbook', () => {
                // # Click on the Playbook entry
                getOverviewEntry('playbook').within(() => cy.getStyledComponent('ItemLink').click());

                // * Verify the we're in the right playbook page
                cy.url().should('include', '/playbooks/playbooks');
                cy.findByTestId('playbook-editor-title').contains(testPublicPlaybook.title);
            });

            it('Owner entry shows the owner', () => {
                // * Verify that the owner is shown
                getOverviewEntry('owner').contains(testUser.username);
            });

            it('Participants entry shows the participants', () => {
                // * Verify that the participants are rendered
                getOverviewEntry('participants').within(() => {
                    cy.getStyledComponent('Participants').within(() => {
                        cy.getStyledComponent('UserPic').should('exist');
                    });
                });
            });

            it('clicking on Participants show the full list of participants', () => {
                // * Click on the Participants entry
                getOverviewEntry('participants').click();

                cy.findByRole('complementary').within(() => {
                    // * Verify that the Participants RHS is shown
                    cy.findByTestId('rhs-title').contains('Participants');

                    // * Verify that the back button is shown
                    cy.findByTestId('rhs-back-button').should('exist');

                    // * Verify that the participants list shows the number of participants
                    cy.findByText('1 Participant');

                    // * Verify that the participants list contains the test user
                    cy.findByText(`@${testUser.username}`);

                    // # Click on the back button
                    cy.findByTestId('rhs-back-button').click();

                    // * Verify that the RHS is back to Run info
                    cy.findByTestId('rhs-title').contains('Run info');
                });
            });
        };

        describe('as participant', () => {
            commonTests();

            it('Following button can be toggled', () => {
                // # Intercept all calls to telemetry
                cy.interceptTelemetry();

                getOverviewEntry('following').within(() => {
                    // * Verify that the user shows in the following list
                    cy.getStyledComponent('UserRow').within(() => {
                        cy.getStyledComponent('UserPic').should('have.length', 1);
                    });

                    // # Click the Following button
                    cy.findByRole('button', {name: /Following/}).click({force: true});

                    // * Verify that it now says (exactly) Follow
                    cy.findByRole('button', {name: /^Follow$/}).should('exist');

                    // * Verify that the user no longer shows in the following list
                    cy.getStyledComponent('UserRow').should('not.exist');

                    // # Click the Follow button
                    cy.findByRole('button', {name: /^Follow$/}).click({force: true});

                    // * Verify that it now says Following
                    cy.findByRole('button', {name: /Following/}).should('exist');
                });

                cy.expectTelemetryToContain([
                    {
                        name: 'playbookrun_unfollow',
                        type: 'track',
                        from: 'run_details',
                        playbookrun_id: testRun.id,
                    },
                    {
                        name: 'playbookrun_follow',
                        type: 'track',
                        from: 'run_details',
                        playbookrun_id: testRun.id,
                    },
                ], {waitForCalls: 2});
            });

            it('click channel link navigates to run\'s channel', () => {
                // * Assert channel name
                getOverviewEntry('channel').contains('the run name');

                // # Click on channel item
                getOverviewEntry('channel').within(() => cy.getStyledComponent('ItemLink').click());

                // * Assert we navigated correctly
                cy.url().should('include', `${testTeam.name}/channels/the-run-name`);
            });

            it('channel is still there when the run is finished', () => {
                cy.apiFinishRun(testRun.id).then(() => {
                    // # Reload page
                    cy.reload();

                    // * Assert channel name
                    getOverviewEntry('channel').contains('the run name');

                    // # Click on channel item
                    getOverviewEntry('channel').within(() => cy.getStyledComponent('ItemLink').click());

                    // * Assert we navigated correctly
                    cy.url().should('include', `${testTeam.name}/channels/the-run-name`);
                });
            });
        });

        describe('as viewer', () => {
            beforeEach(() => {
                cy.apiLogin(testViewerUser).then(() => {
                    cy.visit(`/playbooks/runs/${testRun.id}`);
                });
            });

            commonTests();

            it('Following button can be toggled', () => {
                getOverviewEntry('following').within(() => {
                    // * Verify that the user is not in the following list
                    cy.getStyledComponent('UserRow').within(() => {
                        cy.getStyledComponent('UserPic').should('have.length', 1);
                    });

                    // # Click the Follow button
                    cy.findByRole('button', {name: /^Follow$/}).click({force: true});

                    // * Verify that it now says Following
                    cy.findByRole('button', {name: /Following/}).should('exist');

                    // * Verify that the user is now in the following list
                    cy.getStyledComponent('UserRow').within(() => {
                        cy.getStyledComponent('UserPic').should('have.length', 2);
                    });

                    // # Click the Follow button
                    cy.findByRole('button', {name: /Following/}).click({force: true});

                    // * Verify that it now says (exactly) Follow
                    cy.findByRole('button', {name: /^Follow$/}).should('exist');
                });
            });

            it('there is no channel link but can request to join', () => {
                // * Assert that the section exists with label Private
                getOverviewEntry('channel').contains('Private');

                // * Assert that link does not exist
                getOverviewEntry('channel').within(() => {
                    cy.get('a').should('not.exist');
                });

                // * Assert that request-join button does not exist
                getOverviewEntry('channel').within(() => {
                    cy.get('button').should('not.exist');
                });

                cy.wait(500);

                // # Click Participate button
                getHeader().findByText('Participate').click();

                // * Assert that modal is shown
                cy.get('#become-participant-modal').should('exist');

                // # Confirm modal
                cy.findByTestId('modal-confirm-button').click();

                // Assert that request-join button doesn't exist
                getOverviewEntry('channel').within(() => {
                    cy.get('button').should('not.exist');
                });
            });
        });
    });

    describe('> key metrics', () => {
        describe('playbook without metrics', () => {
            describe('it should not render', () => {
                it('as participant', () => {
                    // * assert metrics does not exist
                    getRHSSection('Key Metrics').should('not.exist');
                });

                it('as viewer', () => {
                    cy.apiLogin(testViewerUser).then(() => {
                        cy.visit(`/playbooks/runs/${testRun.id}`);
                    });

                    // * assert metrics does not exist
                    getRHSSection('Key Metrics').should('not.exist');
                });
            });
        });

        describe('playbook with metrics (enabled retro)', () => {
            let playbookWithMetrics;
            let runWithMetrics;

            before(() => {
                // # Login as testUser
                cy.apiLogin(testUser);

                // # Create a public playbook with metrics
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Public Playbook with metrics',
                    memberIDs: [],
                    metrics: [
                        {
                            title: 'Duration',
                            description: 'duration',
                            type: 'metric_duration',
                            target: 6000,
                        },
                        {
                            title: 'Currency',
                            description: 'currency',
                            type: 'metric_currency',
                            target: 100,
                        },
                        {
                            title: 'Integer',
                            description: 'integer',
                            type: 'metric_integer',
                            target: 1,
                        },
                    ],
                }).then((playbook) => {
                    playbookWithMetrics = playbook;
                });
            });

            beforeEach(() => {
                // # Size the viewport to show the RHS without covering posts.
                cy.viewport('macbook-13');

                // # Login as testUser
                cy.apiLogin(testUser);

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbookWithMetrics.id,
                    playbookRunName: 'the run name',
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    runWithMetrics = playbookRun;

                    // # Visit the playbook run
                    cy.visit(`/playbooks/runs/${playbookRun.id}`);
                });
            });

            const commonTests = () => {
                it('key metrics is present', () => {
                    getRHSSection('Key Metrics').should('exist');
                });

                it('link scrolls to retrospective', () => {
                    // # click in view retro link
                    cy.findByRole('link', {name: /View Retrospective/}).click({force: true});

                    // * verify that URL has been changed
                    cy.url().should('contain', '#playbook-run-retrospective');
                });

                it('metric items scroll to corresponding metric', () => {
                    getRHSSection('Key Metrics').within(() => {
                        playbookWithMetrics.metrics.forEach((metric) => {
                            // # Click on metric
                            cy.findByText(metric.title).click({force: true});

                            // * Verify that url changed (and therefore we scrolled)
                            cy.url().should('contain', `#playbook-run-retrospective${metric.id}`);
                        });
                    });
                });
            };

            describe('as participant', () => {
                commonTests();

                it('metric items show Add value if empty', () => {
                    getRHSSection('Key Metrics').within(() => {
                        playbookWithMetrics.metrics.forEach((metric) => {
                            // * Verify that we show a placeholder when empty
                            cy.findByText(metric.title).parent().contains('Add value...');
                        });
                    });
                });

                it('click on metric items, type and see the result in the RHS', () => {
                    const testData = {
                        metric_duration: {
                            input: '12:06:03',
                            expected: '12d, 6h, 3m',
                        },
                        metric_currency: {
                            input: '5000',
                            expected: '5000',
                        },
                        metric_integer: {
                            input: '42',
                            expected: '42',
                        },
                    };

                    // # Type the values for the metrics
                    getRHSSection('Key Metrics').within(() => {
                        playbookWithMetrics.metrics.forEach((metric) => {
                            // # Click on the metric row
                            cy.findByText(metric.title).click();

                            // # Seems there's a re-render between clicking the title and
                            // # typing that occasionally leads to dropped keystrokes in
                            // # .type(). Wait for it to avoid.
                            cy.wait(1000);

                            // # Type a value for the metric
                            cy.focused().type(testData[metric.type].input);
                        });
                    });

                    // * Verify that the RHS is updated with those values
                    getRHSSection('Key Metrics').within(() => {
                        playbookWithMetrics.metrics.forEach((metric) => {
                            // * Verify that the metric was updated in the RHS
                            cy.findByText(metric.title).parent().contains(testData[metric.type].expected);
                        });
                    });
                });
            });

            describe('as viewer', () => {
                beforeEach(() => {
                    cy.apiLogin(testViewerUser).then(() => {
                        cy.visit(`/playbooks/runs/${runWithMetrics.id}`);
                    });
                });

                commonTests();

                it('metric items show - if empty', () => {
                    getRHSSection('Key Metrics').within(() => {
                        playbookWithMetrics.metrics.forEach((metric) => {
                            // * verify that values are shown as - when empty
                            cy.findByText(metric.title).parent().contains('-');
                        });
                    });
                });
            });
        });

        describe('playbook with metrics (disabled retro)', () => {
            let playbookWithMetrics;
            let runWithMetrics;

            before(() => {
                // # Login as testUser
                cy.apiLogin(testUser);

                // # Create a public playbook with metrics
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Public Playbook with metrics',
                    memberIDs: [],
                    metrics: [
                        {
                            title: 'Integer',
                            description: 'integer',
                            type: 'metric_integer',
                            target: 1,
                        },
                    ],
                    retrospectiveEnabled: false,
                }).then((playbook) => {
                    playbookWithMetrics = playbook;
                });
            });

            beforeEach(() => {
                // # Size the viewport to show the RHS without covering posts.
                cy.viewport('macbook-13');

                // # Login as testUser
                cy.apiLogin(testUser);

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbookWithMetrics.id,
                    playbookRunName: 'the run name',
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    runWithMetrics = playbookRun;

                    // # Visit the playbook run
                    cy.visit(`/playbooks/runs/${playbookRun.id}`);
                });
            });

            const commonTests = () => {
                it('key metrics is hidden', () => {
                    getRHSSection('Key Metrics').should('not.exist');
                });
            };

            describe('as participant', () => {
                commonTests();
            });

            describe('as viewer', () => {
                beforeEach(() => {
                    cy.apiLogin(testViewerUser).then(() => {
                        cy.visit(`/playbooks/runs/${runWithMetrics.id}`);
                    });
                });

                commonTests();
            });
        });
    });

    describe('> recent activity', () => {
        const commonTests = () => {
            it('recent activity is present and it contains a timeline', () => {
                getRHSSection('Recent Activity').within(() => {
                    // * assert that section is shown
                    cy.findByTestId('rhs-timeline').should('exist');
                });
            });

            it('link switches the RHS to Timeline', () => {
                getRHSSection('Recent Activity').within(() => {
                    // * click link to see all timeline
                    cy.findByText('View all').click({force: true});
                });

                cy.findByRole('complementary').within(() => {
                    // * verify we changed to RHS-timeline
                    cy.findByTestId('rhs-title').contains('Timeline');
                    cy.findByTestId('rhs-back-button').should('exist');
                });
            });
        };

        describe('as participant', () => {
            commonTests();
        });

        describe('as viewer', () => {
            beforeEach(() => {
                cy.apiLogin(testViewerUser).then(() => {
                    cy.visit(`/playbooks/runs/${testRun.id}`);
                });
            });

            commonTests();
        });
    });
});
