// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > retrospective', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybookWithMetrics;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Create playbook with metrics
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Playbook with metrics',
            memberIDs: [],
            createPublicPlaybookRun: true,
            metrics: [
                {
                    title: 'Time to acknowledge',
                    description: 'some description text',
                    type: 'metric_duration',
                    target: 7200000,
                },
                {
                    title: 'Cost',
                    description: 'Cost of some events',
                    type: 'metric_currency',
                    target: 400,
                },
                {
                    title: 'Number of customers',
                    description: 'Number of customers who had issues',
                    type: 'metric_integer',
                    target: 30,
                },
                {
                    title: 'Duration',
                    description: 'Duration of incident',
                    type: 'metric_duration',
                },
            ],
        }).then((playbook) => {
            testPlaybookWithMetrics = playbook;
        });
    });

    describe('runs with metrics', () => {
        let runId;
        let runName;
        let playbookRunChannelName;

        beforeEach(() => {
            // # Create a new playbook run
            const now = Date.now();
            runName = `Run (${now})`;
            playbookRunChannelName = `run-${now}`;

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybookWithMetrics.id,
                playbookRunName: runName,
                ownerUserId: testUser.id,
                createPublicPlaybookRun: true,
            }).then((run) => {
                runId = run.id;
            });
        });

        describe('publish retrospective', () => {
            it('retrospective with 4 key metrics', () => {
                // # Navigate directly to the retro tab
                cy.visit(`/playbooks/runs/${runId}/retrospective`);

                // * Verify metrics number
                cy.getStyledComponent('InputContainer').should('have.length', 4);

                // # Enter metrics values
                cy.get('input[type=text]').eq(0).click();
                cy.get('input[type=text]').eq(0).type('00:11:10').
                    tab().type('560').
                    tab().type('12').
                    tab().type('14:00:59');

                // # Publish retrospective
                publishRetro();

                // # Navigate to the playbook run channel
                cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                // * Verify channel retro post content
                cy.findAllByTestId('postView').last().contains(`Retrospective for ${runName} has been published by`);
                cy.getStyledComponent('MetricInfo').should('have.length', 4);
                cy.getStyledComponent('MetricInfo').eq(0).contains('11 hours, 10 minutes');
                cy.getStyledComponent('MetricInfo').eq(1).contains('560');
                cy.getStyledComponent('MetricInfo').eq(2).contains('12');
                cy.getStyledComponent('MetricInfo').eq(3).contains('14 days, 59 minutes');
            });

            it('retrospective with 3 key metrics', () => {
                // # Remove first metric, leave only 3
                testPlaybookWithMetrics.metrics.splice(0, 1);
                cy.apiUpdatePlaybook(testPlaybookWithMetrics).then(() => {
                    // # Navigate directly to the retro tab
                    cy.visit(`/playbooks/runs/${runId}/retrospective`);

                    // * Verify metrics number
                    cy.getStyledComponent('InputContainer').should('have.length', 3);

                    // # Enter metrics values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).type('43').
                        tab().type('121').
                        tab().type('11:00:02');

                    // # Publish retrospective
                    publishRetro();

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify channel retro post content
                    cy.findAllByTestId('postView').last().contains(`Retrospective for ${runName} has been published by`);
                    cy.getStyledComponent('MetricInfo').should('have.length', 3);
                    cy.getStyledComponent('MetricInfo').eq(0).contains('43');
                    cy.getStyledComponent('MetricInfo').eq(1).contains('121');
                    cy.getStyledComponent('MetricInfo').eq(2).contains('11 days, 2 minutes');
                });
            });

            it('retrospective with 2 key metrics', () => {
                // # Remove first two metrics, leave only 2
                testPlaybookWithMetrics.metrics.splice(0, 2);
                cy.apiUpdatePlaybook(testPlaybookWithMetrics).then(() => {
                    // # Navigate directly to the retro tab
                    cy.visit(`/playbooks/runs/${runId}/retrospective`);

                    // * Verify metrics number
                    cy.getStyledComponent('InputContainer').should('have.length', 2);

                    // # Enter metrics values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).type('0').
                        tab().type('00:04:02');

                    // # Publish retrospective
                    publishRetro();

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify channel retro post content
                    cy.findAllByTestId('postView').last().contains(`Retrospective for ${runName} has been published by`);
                    cy.getStyledComponent('MetricInfo').should('have.length', 2);
                    cy.getStyledComponent('MetricInfo').eq(0).contains('0');
                    cy.getStyledComponent('MetricInfo').eq(1).contains('4 hours, 2 minutes');
                });
            });

            it('retrospective with 1 key metrics', () => {
                // # Remove first 3 metrics, leave only 1
                testPlaybookWithMetrics.metrics.splice(0, 3);
                cy.apiUpdatePlaybook(testPlaybookWithMetrics).then(() => {
                    // # Navigate directly to the retro tab
                    cy.visit(`/playbooks/runs/${runId}/retrospective`);

                    // * Verify metrics number
                    cy.getStyledComponent('InputContainer').should('have.length', 1);

                    // # Enter metrics values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).type('00:00:00');

                    // # Publish retrospective
                    publishRetro();

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify channel retro post content
                    cy.findAllByTestId('postView').last().contains(`Retrospective for ${runName} has been published by`);
                    cy.getStyledComponent('MetricInfo').should('have.length', 1);
                    cy.getStyledComponent('MetricInfo').eq(0).contains('0 seconds');
                });
            });

            it('retrospective with no metrics', () => {
                // # Remove all metrics
                testPlaybookWithMetrics.metrics.splice(0, 4);
                cy.apiUpdatePlaybook(testPlaybookWithMetrics).then(() => {
                    // # Navigate directly to the retro tab
                    cy.visit(`/playbooks/runs/${runId}/retrospective`);

                    // * Verify there are no metrics inputs
                    cy.getStyledComponent('InputContainer').should('not.exist');

                    // # Publish retrospective
                    publishRetro();

                    // # Navigate to the playbook run channel
                    cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

                    // * Verify channel retro post content
                    cy.findAllByTestId('postView').last().contains(`Retrospective for ${runName} has been published by`);
                    cy.getStyledComponent('MetricInfo').should('not.exist');
                });
            });
        });
    });
});

const publishRetro = () => {
    // # Publish
    cy.findByRole('button', {name: 'Publish'}).click();

    cy.get('#confirm-modal-light').within(() => {
        // * Verify we're showing the publish retro confirmation modal
        cy.findByText('Are you sure you want to publish?');

        // # Publish
        cy.findByRole('button', {name: 'Publish'}).click();
    });
};
