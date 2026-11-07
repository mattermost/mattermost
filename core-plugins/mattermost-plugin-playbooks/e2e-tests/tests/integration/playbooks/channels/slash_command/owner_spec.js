// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > slash command > owner', {testIsolation: true}, () => {
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

    describe('/playbook owner', () => {
        it('should show an error when not in a playbook run channel', () => {
            // # Navigate to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Run a slash command to show the current owner
            cy.uiPostMessageQuickly('/playbook owner');

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('This command only works when run from a playbook run channel.');
        });

        it('should show the current owner', () => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/playbook-run`);

            // # Run a slash command to show the current owner
            cy.uiPostMessageQuickly('/playbook owner');

            // * Verify the expected owner.
            cy.verifyEphemeralMessage(`@${testUser.username} is the current owner for this playbook run.`);
        });
    });

    describe('/playbook owner @username', () => {
        it('should show an error when not in a playbook run channel', () => {
            // # Navigate to a non-playbook run channel
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // # Run a slash command to change the current owner
            cy.uiPostMessageQuickly(`/playbook owner ${testUser2.username}`);

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('This command only works when run from a playbook run channel.');
        });

        describe('should show an error when the user is not found', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the playbook run channel
                cy.visit(`/${testTeam.name}/channels/playbook-run`);
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.uiPostMessageQuickly('/playbook owner unknown');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('Unable to find user @unknown');
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.uiPostMessageQuickly('/playbook owner @unknown');

                // * Verify the expected error message.
                cy.verifyEphemeralMessage('Unable to find user @unknown');
            });
        });

        describe('should not show an error when the user is not in the channel', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the playbook run channel
                cy.visit(`/${testTeam.name}/channels/playbook-run`);

                // # Ensure the user3 is not part of the channel.
                cy.uiPostMessageQuickly(`/kick ${testUser2.username}`);
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.uiPostMessageQuickly(`/playbook owner ${testUser2.username}`);

                // * Verify the owner has changed.
                cy.findByTestId('owner-profile-selector').contains(testUser2.username);
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.uiPostMessageQuickly(`/playbook owner @${testUser2.username}`);

                // * Verify the owner has changed.
                cy.findByTestId('owner-profile-selector').contains(testUser2.username);
            });
        });

        describe('should show a message when the user is already the owner', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the playbook run channel
                cy.visit(`/${testTeam.name}/channels/playbook-run`);
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.uiPostMessageQuickly(`/playbook owner ${testUser.username}`);

                // * Verify the expected error message.
                cy.verifyEphemeralMessage(`User @${testUser.username} is already owner of this playbook run.`);
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.uiPostMessageQuickly(`/playbook owner @${testUser.username}`);

                // * Verify the expected error message.
                cy.verifyEphemeralMessage(`User @${testUser.username} is already owner of this playbook run.`);
            });
        });

        describe('should change the current owner', () => {
            beforeEach(() => {
                // # Navigate directly to the application and the playbook run channel
                cy.visit(`/${testTeam.name}/channels/playbook-run`);

                // # Ensure the testUser2 is part of the channel.
                cy.uiPostMessageQuickly(`/invite ${testUser2.username}`);
            });

            it('when the username has no @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.uiPostMessageQuickly(`/playbook owner ${testUser2.username}`);

                // # Verify the owner has changed.
                cy.findByTestId('owner-profile-selector').contains(testUser2.username);
            });

            it('when the username has an @-prefix', () => {
                // # Run a slash command to change the current owner
                cy.uiPostMessageQuickly(`/playbook owner @${testUser2.username}`);

                // # Verify the owner has changed.
                cy.findByTestId('owner-profile-selector').contains(testUser2.username);
            });
        });

        it('should show an error when specifying more than one username', () => {
            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/playbook-run`);

            // # Run a slash command with too many parameters
            cy.uiPostMessageQuickly(`/playbook owner ${testUser.username} ${testUser2.username}`);

            // * Verify the expected error message.
            cy.verifyEphemeralMessage('/playbook owner expects at most one argument.');
        });
    });
});
