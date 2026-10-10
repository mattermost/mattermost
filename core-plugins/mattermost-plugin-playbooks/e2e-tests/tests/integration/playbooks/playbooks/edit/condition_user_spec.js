// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > edit > conditions > user', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testRun;
    let priorityField;
    let statusField;
    let testCondition;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.viewport('macbook-13');
    });

    describe('task visibility with simple condition', () => {
        it('hides task when condition not met', () => {
            createPlaybookWithConditionalTask('High');

            startRun();

            navigateToRun();

            verifyTaskHidden('Conditional Task');

            setPropertyValue('Priority', 'Low');

            verifyTaskHidden('Conditional Task');

            setPropertyValue('Priority', 'High');

            verifyTaskVisible('Conditional Task');
        });
    });

    describe('task visibility with AND logic', () => {
        it('evaluates AND condition correctly', () => {
            createPlaybookWithAttributes();

            cy.then(() => {
                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;
                const activeOptionId = statusField.attrs.options.find((o) => o.name === 'Active').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    and: [
                        {is: {field_id: priorityField.id, value: [highOptionId]}},
                        {is: {field_id: statusField.id, value: [activeOptionId]}},
                    ],
                }).then((condition) => {
                    testCondition = condition;

                    return cy.apiGetPlaybook(testPlaybook.id);
                }).then((playbook) => {
                    playbook.checklists[0].items[0].title = 'AND Conditional Task';
                    playbook.checklists[0].items[0].condition_id = testCondition.id;
                    return cy.apiUpdatePlaybook(playbook);
                }).then(() => {
                    startRun();
                    navigateToRun();

                    verifyTaskHidden('AND Conditional Task');

                    setPropertyValue('Priority', 'High');

                    verifyTaskHidden('AND Conditional Task');

                    setPropertyValue('Status', 'Active');

                    verifyTaskVisible('AND Conditional Task');

                    setPropertyValue('Priority', 'Low');

                    verifyTaskHidden('AND Conditional Task');
                });
            });
        });
    });

    describe('task visibility with OR logic', () => {
        it('evaluates OR condition correctly', () => {
            createPlaybookWithAttributes();

            cy.then(() => {
                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;
                const mediumOptionId = priorityField.attrs.options.find((o) => o.name === 'Medium').id;

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    or: [
                        {is: {field_id: priorityField.id, value: [highOptionId]}},
                        {is: {field_id: priorityField.id, value: [mediumOptionId]}},
                    ],
                }).then((condition) => {
                    testCondition = condition;

                    return cy.apiGetPlaybook(testPlaybook.id);
                }).then((playbook) => {
                    playbook.checklists[0].items[0].title = 'OR Conditional Task';
                    playbook.checklists[0].items[0].condition_id = testCondition.id;
                    return cy.apiUpdatePlaybook(playbook);
                }).then(() => {
                    startRun();
                    navigateToRun();

                    verifyTaskHidden('OR Conditional Task');

                    setPropertyValue('Priority', 'Low');

                    verifyTaskHidden('OR Conditional Task');

                    setPropertyValue('Priority', 'Medium');

                    verifyTaskVisible('OR Conditional Task');

                    setPropertyValue('Priority', 'High');

                    verifyTaskVisible('OR Conditional Task');
                });
            });
        });
    });

    describe('modified task behavior', () => {
        it('shows warning indicator for modified task when condition no longer met', () => {
            createPlaybookWithConditionalTask('High');

            startRun();

            navigateToRun();

            setPropertyValue('Priority', 'High');

            verifyTaskVisible('Conditional Task');

            cy.findByText('Conditional Task').closest('[data-testid="checkbox-item-container"]').within(() => {
                cy.get('input[type="checkbox"]').check();
            });

            cy.wait(500);

            setPropertyValue('Priority', 'Low');

            cy.wait(500);

            verifyTaskVisible('Conditional Task');

            cy.findByTestId('condition-indicator-error').should('exist');
        });
    });

    describe('real-time updates', () => {
        it('updates task visibility without page reload', () => {
            createPlaybookWithConditionalTask('High');

            startRun();

            navigateToRun();

            verifyTaskHidden('Conditional Task');

            setPropertyValue('Priority', 'High');

            verifyTaskVisible('Conditional Task');

            setPropertyValue('Priority', 'Medium');

            verifyTaskHidden('Conditional Task');

            setPropertyValue('Priority', 'High');

            verifyTaskVisible('Conditional Task');
        });
    });

    describe('channel messages for conditional tasks', () => {
        it('posts channel message when property change adds new tasks', () => {
            createPlaybookWithConditionalTask('High');

            startRun();

            navigateToRun();

            // # Change property to trigger task addition
            setPropertyValue('Priority', 'High');

            // # Navigate to the run's channel
            cy.then(() => {
                cy.visit(`/${testTeam.name}/channels/${testRun.channel_id}`);
            });

            // * Verify message posted about new tasks
            cy.get('#postListContent').within(() => {
                cy.contains('updated Priority to High, resulting in the addition of 1 new task to Stage 1 checklist').should('exist');
            });
        });

        it('posts message when multiple tasks are added', () => {
            createPlaybookWithAttributes();

            cy.then(() => {
                const highOptionId = priorityField.attrs.options.find((o) => o.name === 'High').id;

                // Create condition and add multiple conditional tasks
                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: priorityField.id,
                        value: [highOptionId],
                    },
                }).then((condition) => {
                    testCondition = condition;

                    return cy.apiGetPlaybook(testPlaybook.id);
                }).then((playbook) => {
                    // Add multiple conditional tasks
                    playbook.checklists[0].items = [
                        {
                            title: 'High Priority Task 1',
                            condition_id: testCondition.id,
                        },
                        {
                            title: 'High Priority Task 2',
                            condition_id: testCondition.id,
                        },
                        {
                            title: 'High Priority Task 3',
                            condition_id: testCondition.id,
                        },
                    ];
                    return cy.apiUpdatePlaybook(playbook);
                }).then(() => {
                    startRun();

                    navigateToRun();

                    // # Change property to trigger task additions
                    setPropertyValue('Priority', 'High');

                    // # Navigate to the run's channel
                    cy.then(() => {
                        cy.visit(`/${testTeam.name}/channels/${testRun.channel_id}`);
                    });

                    // * Verify message posted about multiple tasks
                    cy.get('#postListContent').within(() => {
                        cy.contains('updated Priority to High, resulting in the addition of 3 new tasks to Stage 1 checklist').should('exist');
                    });
                });
            });
        });
    });

    describe('text property conditions', () => {
        it('evaluates is and is_not conditions for text fields', () => {
            let textField;
            let isCondition;
            let isNotCondition;

            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Text Condition Test ' + Date.now(),
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });

            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: 'Code',
                    type: 'text',
                    attrs: {
                        visibility: 'always',
                        sortOrder: 1,
                    },
                });

                cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                    textField = fields.find((f) => f.name === 'Code');
                });
            });

            cy.then(() => {
                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    is: {
                        field_id: textField.id,
                        value: 'abc',
                    },
                }).then((condition) => {
                    isCondition = condition;
                });

                cy.apiCreatePlaybookCondition(testPlaybook.id, {
                    isNot: {
                        field_id: textField.id,
                        value: 'abc',
                    },
                }).then((condition) => {
                    isNotCondition = condition;
                });
            });

            cy.then(() => {
                return cy.apiGetPlaybook(testPlaybook.id);
            }).then((playbook) => {
                playbook.checklists[0].items[0].title = 'Task when IS abc';
                playbook.checklists[0].items[0].condition_id = isCondition.id;

                playbook.checklists[0].items.push({
                    title: 'Task when NOT abc',
                    condition_id: isNotCondition.id,
                });

                return cy.apiUpdatePlaybook(playbook);
            }).then(() => {
                startRun();
                navigateToRun();

                verifyTaskHidden('Task when IS abc');
                verifyTaskVisible('Task when NOT abc');

                setTextPropertyValue('Code', 'abc');

                verifyTaskVisible('Task when IS abc');
                verifyTaskHidden('Task when NOT abc');

                setTextPropertyValue('Code', 'xyz');

                verifyTaskHidden('Task when IS abc');
                verifyTaskVisible('Task when NOT abc');
            });
        });
    });

    function createPlaybookWithAttributes() {
        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Condition User Test ' + Date.now(),
            userId: testUser.id,
        }).then((playbook) => {
            testPlaybook = playbook;
        });

        cy.then(() => {
            cy.apiAddPropertyField(testPlaybook.id, {
                name: 'Priority',
                type: 'select',
                attrs: {
                    visibility: 'always',
                    sortOrder: 1,
                    options: [
                        {name: 'High'},
                        {name: 'Medium'},
                        {name: 'Low'},
                    ],
                },
            });

            cy.apiAddPropertyField(testPlaybook.id, {
                name: 'Status',
                type: 'select',
                attrs: {
                    visibility: 'always',
                    sortOrder: 2,
                    options: [
                        {name: 'Active'},
                        {name: 'Inactive'},
                    ],
                },
            });

            cy.apiGetPropertyFields(testPlaybook.id).then((fields) => {
                priorityField = fields.find((f) => f.name === 'Priority');
                statusField = fields.find((f) => f.name === 'Status');
            });
        });
    }

    function createPlaybookWithConditionalTask(priorityValue) {
        createPlaybookWithAttributes();

        cy.then(() => {
            const optionId = priorityField.attrs.options.find((o) => o.name === priorityValue).id;

            cy.apiCreatePlaybookCondition(testPlaybook.id, {
                is: {
                    field_id: priorityField.id,
                    value: [optionId],
                },
            }).then((condition) => {
                testCondition = condition;

                return cy.apiGetPlaybook(testPlaybook.id);
            }).then((playbook) => {
                playbook.checklists[0].items[0].title = 'Conditional Task';
                playbook.checklists[0].items[0].condition_id = testCondition.id;
                return cy.apiUpdatePlaybook(playbook);
            });
        });
    }

    function startRun() {
        cy.then(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: 'Condition Test Run',
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;
            });
        });
    }

    function navigateToRun() {
        cy.then(() => {
            cy.visit(`/playbooks/runs/${testRun.id}`);
        });
    }

    function setPropertyValue(propertyName, value) {
        const testId = `run-property-${propertyName.toLowerCase().replace(/\s+/g, '-')}`;

        cy.findByRole('complementary').within(() => {
            cy.findByTestId(testId).within(() => {
                cy.findByTestId('property-value').realClick();
            });
        });

        cy.findByText(value).click();

        cy.wait(500);
    }

    function setTextPropertyValue(propertyName, value) {
        const testId = `run-property-${propertyName.toLowerCase().replace(/\s+/g, '-')}`;

        cy.findByRole('complementary').within(() => {
            cy.findByTestId(testId).within(() => {
                cy.findByTestId('property-value').realClick();
            });
        });

        cy.focused().clear().realType(value);
        cy.realPress('Tab');

        cy.wait(500);
    }

    function verifyTaskVisible(taskTitle) {
        cy.findByText(taskTitle).should('exist').should('be.visible');
    }

    function verifyTaskHidden(taskTitle) {
        cy.findByText(taskTitle).should('not.exist');
    }
});
