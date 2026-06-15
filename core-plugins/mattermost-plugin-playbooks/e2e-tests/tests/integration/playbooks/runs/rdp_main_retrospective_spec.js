// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

const editAndPublishRetro = () => {
    getRetro().within(() => {
        // # Start editing
        cy.findByTestId('retro-report-text').click();

        // * Verify the provided template text is pre-filled
        cy.focused().should('include.text', 'This is a retrospective template.');

        // # Change the retro text
        cy.focused().clear().type('Edited retrospective.');

        // # Save it by clicking outside the text area
        cy.findByText('Report').click();

        // # Publish
        cy.findByRole('button', {name: 'Publish'}).click();
    });

    cy.get('#confirm-modal-light').within(() => {
        // * Verify we're showing the publish retro confirmation modal
        cy.findByText('Are you sure you want to publish?');

        // # Publish
        cy.findByRole('button', {name: 'Publish'}).click();
    });

    // * Verify that retro got published
    getRetro().get('.icon-check-all').should('be.visible');
};

const getMetricInput = (index) => getRetro().getStyledComponent('InputContainer').eq(index);

const verifyMetricInput = (index, title, target, description, placeholder) => {
    getMetricInput(index).within(() => {
        cy.getStyledComponent('Title').contains(title);

        if (target) {
            cy.getStyledComponent('TargetTitle').contains(target);
        } else {
            cy.getStyledComponent('TargetTitle').should('not.exist');
        }

        if (description) {
            cy.getStyledComponent('HelpText').contains(description);
        }
        if (placeholder) {
            cy.get('input').should('have.attr', 'placeholder', placeholder);
        }
    });
};

const getRetro = () => cy.findByTestId('run-retrospective-section');

describe('runs > run details page', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
    let testPublicPlaybookWithMetrics;
    let testRun;

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
                retrospectiveTemplate: 'This is a retrospective template.',
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
                createPublicPlaybookRun: true,
                metrics: [
                    {
                        title: 'title1',
                        description: 'description1',
                        type: 'metric_duration',
                        target: 720000,
                    },
                    {
                        title: 'title2',
                        description: 'description2',
                        type: 'metric_currency',
                        target: 40,
                    },
                    {
                        title: 'title3',
                        description: 'description3',
                        type: 'metric_integer',
                        target: 30,
                    },
                ],
            }).then((playbook) => {
                testPublicPlaybookWithMetrics = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('retrospective', () => {
        const commonTests = () => {
            it('is visible', () => {
                // * Verify the retrospective section is present
                getRetro().should('be.visible');
            });

            it('has title', () => {
                // * Verify the retrospective section has a title
                getRetro().find('h3').contains('Retrospective');
            });

            it('has template text', () => {
                // * Verify the retrospective text is rendered
                getRetro().findByTestId('retro-report-text').contains('This is a retrospective template.');
            });

            it('has no metrics', () => {
                // * Verify there are no metric for this playbook
                getRetro().getStyledComponent('InputContainer').should('not.exist');
            });
        };

        describe('as participant', () => {
            beforeEach(() => {
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

            commonTests();

            it('publishing posts to run channel', () => {
                editAndPublishRetro();

                // # Switch to the run channel
                cy.findByTestId('runinfo-channel-link').click();

                // * Verify the modified retro text is posted
                cy.getStyledComponent('CustomPostContent').should('exist').contains('Edited retrospective.');
            });

            it('can be published once', () => {
                editAndPublishRetro();

                // * Verify the button is disabled
                getRetro().findByText('Publish').should('not.be.enabled');
            });
        });

        describe('as viewer', () => {
            before(() => {
                // # Login as testUser
                cy.apiLogin(testUser);

                // # Create test playbook run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPublicPlaybook.id,
                    playbookRunName: 'the run name',
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    testRun = playbookRun;
                });
            });

            beforeEach(() => {
                // Login as the test viewer
                cy.apiLogin(testViewerUser);

                // # Visit the playbook run
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });

            commonTests();

            it('text is not clickable', () => {
                getRetro().findByTestId('retro-report-text').click();
                getRetro().find('textarea').should('not.exist');
            });

            it('there is no publish button', () => {
                getRetro().findByText('Publish').should('not.exist');
            });
        });
    });

    describe('metrics', () => {
        const commonTests = () => {
            it('inputs info(title, target, description) and order', () => {
                // * Verify the created metrics
                verifyMetricInput(0, 'title1', '12 minutes', 'description1', 'Add value (in dd:hh:mm)');
                verifyMetricInput(1, 'title2', '40', 'description2', 'Add value');
                verifyMetricInput(2, 'title3', '30', 'description3', 'Add value');
            });
        };

        describe('as participant', () => {
            beforeEach(() => {
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPublicPlaybookWithMetrics.id,
                    playbookRunName: 'the run name',
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    testRun = playbookRun;
                });
            });

            beforeEach(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });

            commonTests();

            it('inputs, null and zero values', () => {
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Public Playbook',
                    memberIDs: [],
                    createPublicPlaybookRun: true,
                    metrics: [
                        {
                            title: 'title1',
                            description: 'description1',
                            type: 'metric_duration',
                            target: null,
                        },
                        {
                            title: 'title2',
                            description: 'description2',
                            type: 'metric_currency',
                            target: 0,
                        },
                        {
                            title: 'title3',
                            description: 'description3',
                            type: 'metric_integer',
                            target: 30,
                        },
                    ],
                }).then((playbook) => {
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: 'the run name',
                        ownerUserId: testUser.id,
                    }).then((playbookRun) => {
                        // # Navigate directly to the retro tab
                        cy.visit(`/playbooks/runs/${playbookRun.id}`);

                        // * Verify changes are reflected
                        verifyMetricInput(0, 'title1', null, 'description1', 'Add value (in dd:hh:mm)');
                        verifyMetricInput(1, 'title2', '0', 'description2', 'Add value');
                        verifyMetricInput(2, 'title3', '30', 'description3', 'Add value');
                    });
                });
            });

            it('auto save', () => {
                getRetro().within(() => {
                    // # Enter metric values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).type('12:11:10').
                        tab().type('56').
                        tab().type('123');

                    // # Click outside
                    cy.findByText('Retrospective').click({force: true});
                    cy.wait(2000);

                    // * Validate if values persist
                    cy.get('input[type=text]').eq(0).should('have.value', '12:11:10');
                    cy.get('input[type=text]').eq(1).should('have.value', '56');
                    cy.get('input[type=text]').eq(2).should('have.value', '123');

                    // # Enter new values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).clear().type('12:00:10').
                        tab().clear().type('20').
                        tab().clear().type('21');
                });

                // # Wait 2 sec to auto save
                cy.wait(2000);

                // # Reload page
                cy.visit(`/playbooks/runs/${testRun.id}`);

                getRetro().within(() => {
                    // * Validate if values are saved
                    cy.get('input[type=text]').eq(0).should('have.value', '12:00:10');
                    cy.get('input[type=text]').eq(1).should('have.value', '20');
                    cy.get('input[type=text]').eq(2).should('have.value', '21');
                });
            });

            it('save empty and zero values', () => {
                getRetro().within(() => {
                    // # Enter metric values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).clear().type('00:00:00').
                        tab().type('7').
                        tab().type('0');

                    // # Click outside
                    cy.findByText('Retrospective').click({force: true});

                    // * Validate if values persist
                    cy.get('input[type=text]').eq(0).should('have.value', '00:00:00');
                    cy.get('input[type=text]').eq(1).should('have.value', '7');
                    cy.get('input[type=text]').eq(2).should('have.value', '0');

                    // # Clear first two metrics values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).clear().
                        tab().clear();

                    // # Click outside
                    cy.findByText('Retrospective').click({force: true});

                    // * Validate if values persist
                    cy.get('input[type=text]').eq(0).should('have.value', '');
                    cy.get('input[type=text]').eq(1).should('have.value', '');
                    cy.get('input[type=text]').eq(2).should('have.value', '0');
                });
            });

            it('only valid values are saved. check error messages', () => {
                getRetro().within(() => {
                    // # Enter invalid metric values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).type('5').
                        tab().type('56d').
                        tab().type('125');

                    // * Validate error messages
                    cy.getStyledComponent('ErrorText').eq(0).contains('Please enter a duration in the format: dd:hh:mm (e.g., 12:00:00).');
                    cy.getStyledComponent('ErrorText').eq(1).contains('Please enter a number.');

                    // # Click outside
                    cy.findByText('Retrospective').click({force: true});
                });

                // # Reload page and navigate to the retro tab
                cy.visit(`/playbooks/runs/${testRun.id}`);

                getRetro().within(() => {
                    // * Validate that values are not saved
                    cy.get('input[type=text]').eq(0).should('have.value', '');
                    cy.get('input[type=text]').eq(1).should('have.value', '');
                    cy.get('input[type=text]').eq(2).should('have.value', '125');

                    // # Enter new metric values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).type('s').
                        tab().type('d').
                        tab().type('k');
                });
            });

            it('publish retro', () => {
                getRetro().within(() => {
                    // # Enter metric invalid values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).type('20:00:12d').
                        tab().type('56').
                        tab().type('125v');

                    // # Publish
                    cy.findByRole('button', {name: 'Publish'}).click();
                });

                // * Verify we're not showing the publish retro confirmation modal
                cy.get('#confirm-modal-light').should('not.exist');

                getRetro().within(() => {
                    //# Enter empty metric values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).clear().
                        tab().clear().
                        tab().clear().type(24);

                    // # Publish
                    cy.findByRole('button', {name: 'Publish'}).click();

                    // * Validate error messages
                    cy.getStyledComponent('ErrorText').eq(0).contains('Please fill in the metric value.');
                    cy.getStyledComponent('ErrorText').eq(1).contains('Please fill in the metric value.');
                    cy.getStyledComponent('ErrorText').should('have.length', 2);
                });

                // * Verify we're not showing the publish retro confirmation modal
                cy.get('#confirm-modal-light').should('not.exist');

                getRetro().within(() => {
                    //# Enter valid metric values
                    cy.get('input[type=text]').eq(0).click();
                    cy.get('input[type=text]').eq(0).type('09:87:12').
                        tab().type(123);

                    // # Publish
                    cy.findByRole('button', {name: 'Publish'}).click();
                });

                cy.get('#confirm-modal-light').within(() => {
                    // * Verify we're showing the publish retro confirmation modal
                    cy.findByText('Are you sure you want to publish?');

                    // # Publish
                    cy.findByRole('button', {name: 'Publish'}).click();
                });

                getRetro().within(() => {
                    // * Verify that retro got published
                    cy.get('.icon-check-all').should('be.visible');

                    // * Verify that metrics inputs are disabled
                    cy.get('input[type=text]').each(($el) => {
                        cy.wrap($el).should('not.be.enabled');
                    });
                });
            });
        });

        describe('as viewer', () => {
            before(() => {
                cy.apiLogin(testUser);

                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPublicPlaybookWithMetrics.id,
                    playbookRunName: 'the run name',
                    ownerUserId: testUser.id,
                }).then((playbookRun) => {
                    testRun = playbookRun;
                });
            });

            beforeEach(() => {
                cy.apiLogin(testViewerUser).then(() => {
                    cy.visit(`/playbooks/runs/${testRun.id}`);
                });
            });

            commonTests();

            it('are not editable', () => {
                // * Verify that inputs are disabled
                getMetricInput(0).find('input').should('be.disabled');
                getMetricInput(1).find('input').should('be.disabled');
                getMetricInput(2).find('input').should('be.disabled');
            });
        });
    });
});
