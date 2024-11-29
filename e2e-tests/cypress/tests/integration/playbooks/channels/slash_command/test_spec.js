// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Group: @playbooks

describe('channels > slash command > test', {testIsolation: true}, () => {
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

    describe('as a regular user', () => {
        before(() => {
            // # Login as sysadmin.
            cy.apiAdminLogin();

            // # Set EnableTesting to true.
            cy.apiUpdateConfig({
                ServiceSettings: {
                    EnableTesting: true,
                },
            });
            cy.apiReloadConfig();
        });

        beforeEach(() => {
            // # Login as user-1
            cy.apiLogin(testUser);

            // # Navigate to a channel.
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });

        it('fails to run subcommand bulk-data', () => {
            // # Execute the bulk-data command.
            cy.uiPostMessageQuickly('/playbook test bulk-data');

            // * Verify the ephemeral message warns that the user is not admin.
            cy.verifyEphemeralMessage('Running the test command is restricted to system administrators.');
        });

        it('fails to run subcommand create-playbook-run', () => {
            // # Execute the create-playbook-run command.
            cy.uiPostMessageQuickly('/playbook test create-playbook-run');

            // * Verify the ephemeral message warns that the user is not admin.
            cy.verifyEphemeralMessage('Running the test command is restricted to system administrators.');
        });

        it('fails to run subcommand self', () => {
            // # Execute the self command.
            cy.uiPostMessageQuickly('/playbook test self');

            // * Verify the ephemeral message warns that the user is not admin.
            cy.verifyEphemeralMessage('Running the test command is restricted to system administrators.');
        });
    });

    describe('as an admin', () => {
        describe('with EnableTesting set to false', () => {
            before(() => {
                // # Login as sysadmin.
                cy.apiAdminLogin();

                // # Set EnableTesting to false.
                cy.apiUpdateConfig({
                    ServiceSettings: {
                        EnableTesting: false,
                    },
                });
                cy.apiReloadConfig();
            });

            beforeEach(() => {
                // # Login as sysadmin.
                cy.apiAdminLogin();

                // # Navigate to a channel.
                cy.visit(`/${testTeam.name}/channels/town-square`);
            });

            it('fails to run subcommand bulk-data', () => {
                // # Execute the bulk-data command.
                cy.uiPostMessageQuickly('/playbook test bulk-data');

                // * Verify the ephemeral message warns that the user is not admin.
                cy.verifyEphemeralMessage('Setting EnableTesting must be set to true to run the test command.');
            });

            it('fails to run subcommand create-playbook-run', () => {
                // # Execute the create-playbook-run command.
                cy.uiPostMessageQuickly('/playbook test create-playbook-run');

                // * Verify the ephemeral message warns that the user is not admin.
                cy.verifyEphemeralMessage('Setting EnableTesting must be set to true to run the test command.');
            });

            it('fails to run subcommand self', () => {
                // # Execute the self command.
                cy.uiPostMessageQuickly('/playbook test self');

                // * Verify the ephemeral message warns that the user is not admin.
                cy.verifyEphemeralMessage('Setting EnableTesting must be set to true to run the test command.');
            });
        });

        describe('with EnableTesting set to true', () => {
            before(() => {
                // # Login as sysadmin.
                cy.apiAdminLogin();

                // # Set EnableTesting to true.
                cy.apiUpdateConfig({
                    ServiceSettings: {
                        EnableTesting: true,
                    },
                });
                cy.apiReloadConfig();
            });

            beforeEach(() => {
                // # Login as sysadmin.
                cy.apiAdminLogin();

                // # Size the viewport to show the RHS without covering posts.
                cy.viewport('macbook-13');

                // # Navigate to a channel.
                cy.visit(`/${testTeam.name}/channels/town-square`);
            });

            describe('with subcommand self', () => {
                it('asks for confirmation', () => {
                    // # Execute the self command.
                    cy.uiPostMessageQuickly('/playbook test self');

                    // * Verify the ephemeral message asks for the confirmation keywords.
                    cy.verifyEphemeralMessage('Are you sure you want to self-test (which will nuke the database and delete all data -- instances, configuration)? All data will be lost. To self-test, type /playbook test self CONFIRM TEST SELF');
                });
            });

            describe('with subcommand create', () => {
                it('fails to run with no arguments', () => {
                    // # Execute the create-playbook-run command with no arguments.
                    cy.uiPostMessageQuickly('/playbook test create-playbook-run');

                    // * Verify the ephemeral message warns about the parameters.
                    cy.verifyEphemeralMessage('The command expects three parameters: <playbook_id> <timestamp> <name>');
                });

                it('fails to run with one argument', () => {
                    // # Execute the create-playbook-run command with one argument.
                    cy.uiPostMessageQuickly(`/playbook test create-playbook-run ${testPlaybook.id}`);

                    // * Verify the ephemeral message warns about the parameters.
                    cy.verifyEphemeralMessage('The command expects three parameters: <playbook_id> <timestamp> <name>');
                });

                it('fails to run with two arguments', () => {
                    // # Execute the create-playbook-run command with two arguments.
                    cy.uiPostMessageQuickly(`/playbook test create-playbook-run ${testPlaybook.id} 2020-01-01`);

                    // * Verify the ephemeral message warns about the parameters.
                    cy.verifyEphemeralMessage('The command expects three parameters: <playbook_id> <timestamp> <name>');
                });

                it('fails to run with a malformed playbook ID', () => {
                    // # Execute the create-playbook-run command with all arguments, but a malformed plabook ID.
                    cy.uiPostMessageQuickly('/playbook test create-playbook-run unknownID 2020-01-01 The playbook run name');

                    // * Verify the ephemeral message warns about the ID.
                    cy.verifyEphemeralMessage('The first parameter, <playbook_id>, must be a valid ID.');
                });

                it('fails to run with a valid, but unknown playbook ID', () => {
                    // # Execute the create-playbook-run command with all arguments, but an unknown plabook ID.
                    cy.uiPostMessageQuickly('/playbook test create-playbook-run abcdefghijklmnopqrstuvwxyz 2020-01-01 The playbook run name');

                    // * Verify the ephemeral message warns about the parameter.
                    cy.verifyEphemeralMessage('The playbook with ID \'abcdefghijklmnopqrstuvwxyz\' does not exist.');
                });

                it('fails to run with a malformed date', () => {
                    // # Execute the create-playbook-run command with all arguments, but a malformed creation timestamp.
                    cy.uiPostMessageQuickly(`/playbook test create-playbook-run ${testPlaybook.id} 2020-1-1 The playbook run name`);

                    // * Verify the ephemeral message warns about the parameter.
                    cy.verifyEphemeralMessage('Timestamp \'2020-1-1\' could not be parsed as a date. If you want the playbook run to start on January 2, 2006, the timestamp should be \'2006-01-02\'.');
                });
            });
        });
    });
});
