// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {getRandomId} from '../../../utils';

describe('runs > permissions', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testOtherTeam;

    let playbookMember;
    let runParticipant;
    let runFollower;
    let teamMember;
    let nonTeamMember;
    let sysadminInTeam;
    let sysadminNotInTeam;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a dedicated playbook member
            cy.apiCreateUser().then(({user: createdUser}) => {
                playbookMember = createdUser;

                cy.apiAddUserToTeam(testTeam.id, createdUser.id);
            });

            // # Create a dedicated run participant
            cy.apiCreateUser().then(({user: createdUser}) => {
                runParticipant = createdUser;

                cy.apiAddUserToTeam(testTeam.id, createdUser.id);
            });

            // # Create a dedicated run follower
            cy.apiCreateUser().then(({user: createdUser}) => {
                runFollower = createdUser;

                cy.apiAddUserToTeam(testTeam.id, createdUser.id);
            });

            // # Create a dedicated member in team 1
            cy.apiCreateUser().then(({user: createdUser}) => {
                teamMember = createdUser;

                cy.apiAddUserToTeam(testTeam.id, createdUser.id);
            });

            // # Create a dedicated sysadmin in team 1
            cy.apiCreateCustomAdmin().then(({sysadmin: createdUser}) => {
                sysadminInTeam = createdUser;

                cy.apiAddUserToTeam(testTeam.id, createdUser.id);
            });

            // # Create a public playbook and corresponding run with a public channel in
            // team 1. This is to ensure the list isn't empty for users who can't access the
            // run under test.
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook (Team 1)',
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((createdPlaybook) => {
                // Create a run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: createdPlaybook.id,
                    playbookRunName: getRandomId(),
                    ownerUserId: testUser.id,
                });
            });

            // # Create another team
            cy.apiCreateTeam('second-team', 'Second Team').then(({team: createdTeam}) => {
                testOtherTeam = createdTeam;

                // # Create a dedicated member not in team 1
                cy.apiCreateUser().then(({user: createdUser}) => {
                    nonTeamMember = createdUser;

                    cy.apiAddUserToTeam(testOtherTeam.id, createdUser.id);
                });

                // # Create a dedicated sysadmin not in team 1
                cy.apiCreateCustomAdmin().then(({sysadmin: createdUser}) => {
                    sysadminNotInTeam = createdUser;

                    cy.apiAddUserToTeam(testOtherTeam.id, createdUser.id);
                });

                // # Create a public playbook and corresponding run with a public channel in
                // team 2. This is to ensure the list isn't empty for users who can't access the
                // run under test.
                cy.apiCreatePlaybook({
                    teamId: testOtherTeam.id,
                    title: 'Playbook (Team 2)',
                    memberIDs: [],
                    createPublicPlaybookRun: true,
                }).then((createdPlaybook) => {
                    // Create a run
                    cy.apiRunPlaybook({
                        teamId: testOtherTeam.id,
                        playbookId: createdPlaybook.id,
                        playbookRunName: getRandomId(),
                        ownerUserId: nonTeamMember.id,
                    });
                });
            });
        });
    });

    describe('run with private channel from a public playbook', () => {
        let playbook;
        let run;

        before(() => {
            // # Login as the user setup during initialization.
            cy.apiLogin(testUser);

            // # Create a public playbook, configured to create private channels for runs
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
                createPublicPlaybookRun: false,
            }).then((createdPlaybook) => {
                playbook = createdPlaybook;

                // Create a run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: getRandomId(),
                    ownerUserId: runParticipant.id,
                }).then((createdRun) => {
                    run = createdRun;

                    // Have the dedicated participant join the run
                    cy.apiAddUsersToRun(run.id, [runParticipant.id]);

                    // # Have the dedicated follower follow this playbook run
                    cy.apiLogin(runFollower);
                    cy.apiFollowPlaybookRun(run.id);
                });
            });
        });

        describe('should be visible', () => {
            it('to playbook members', () => {
                assertRunIsVisible(run, playbookMember);
            });

            it('to run participants', () => {
                assertRunIsVisible(run, runParticipant);
            });

            it('to run followers', () => {
                assertRunIsVisible(run, runFollower);
            });

            it('to team members', () => {
                assertRunIsVisible(run, teamMember);
            });

            it('to admins in the team', () => {
                assertRunIsVisible(run, sysadminInTeam);
            });

            // XXX: The following asserts that while sysadmins don't see runs from other teams in
            // the list, they still have access to view the overview directly. Once we support
            // sudo-admins, we should change this behaviour to be consistent with normal users.
            it('to admins not in the team (overview only)', () => {
                cy.apiLogin(sysadminNotInTeam);

                assertRunOverviewIsVisible(run);
            });
        });

        describe('should not be visible', () => {
            it('to non-team members', () => {
                assertRunIsNotVisible(run, nonTeamMember);
            });

            it('to admins not in the team (list only)', () => {
                cy.apiLogin(sysadminNotInTeam);

                assertRunIsNotVisibleInList(run);
            });
        });
    });

    describe('run with public channel from a public playbook', () => {
        let playbook;
        let run;

        before(() => {
            // # Login as the user setup during initialization.
            cy.apiLogin(testUser);

            // # Create a public playbook, configured to create public channels for runs
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
                createPublicPlaybookRun: true,
            }).then((createdPlaybook) => {
                playbook = createdPlaybook;

                // Create a run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: getRandomId(),
                    ownerUserId: runParticipant.id,
                }).then((createdRun) => {
                    run = createdRun;

                    // Have the dedicated participant join the run
                    cy.apiAddUsersToRun(run.id, [runParticipant.id]);

                    // # Have the dedicated follower follow this playbook run
                    cy.apiLogin(runFollower);
                    cy.apiFollowPlaybookRun(run.id);
                });
            });
        });

        describe('should be visible', () => {
            it('to playbook members', () => {
                assertRunIsVisible(run, playbookMember);
            });

            it('to run participants', () => {
                assertRunIsVisible(run, runParticipant);
            });

            it('to run followers', () => {
                assertRunIsVisible(run, runFollower);
            });

            it('to team members', () => {
                assertRunIsVisible(run, teamMember);
            });

            it('to admins in the team', () => {
                assertRunIsVisible(run, sysadminInTeam);
            });

            // XXX: The following asserts that while sysadmins don't see runs from other teams in
            // the list, they still have access to view the overview directly. Once we support
            // sudo-admins, we should change this behaviour to be consistent with normal users.
            it('to admins not in the team (overview only)', () => {
                cy.apiLogin(sysadminNotInTeam);

                assertRunOverviewIsVisible(run);
            });
        });

        describe('should not be visible', () => {
            it('to non-team members', () => {
                assertRunIsNotVisible(run, nonTeamMember);
            });

            it('to admins not in the team (list only)', () => {
                cy.apiLogin(sysadminNotInTeam);

                assertRunIsNotVisibleInList(run);
            });
        });
    });

    describe('run with private channel from a private playbook', () => {
        let playbook;
        let run;

        before(() => {
            // # Login as the user setup during initialization.
            cy.apiLogin(testUser);

            // # Create private playbook, configured to create private channels for runs
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                makePublic: false,
                memberIDs: [testUser.id, playbookMember.id],
                createPublicPlaybookRun: false,
            }).then((createdPlaybook) => {
                playbook = createdPlaybook;

                // Login as the playbook member authorized to start a run
                cy.apiLogin(playbookMember);

                // Create a run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: getRandomId(),
                    ownerUserId: runParticipant.id,
                }).then((createdRun) => {
                    run = createdRun;

                    // Have the dedicated participant join the run
                    cy.apiAddUsersToRun(run.id, [runParticipant.id]);
                });
            });
        });

        describe('should be visible', () => {
            it('to playbook members', () => {
                assertRunIsVisible(run, playbookMember);
            });

            it('to run participants', () => {
                assertRunIsVisible(run, runParticipant);
            });

            // Followers cannot follow a run with a private channel from a private playbook
            it('to run followers', () => {
                assertRunIsNotVisible(run, runFollower);
            });

            it('to admins in the team', () => {
                assertRunIsVisible(run, sysadminInTeam);
            });

            // XXX: The following asserts that while sysadmins don't see runs from other teams in
            // the list, they still have access to view the run directly. Once we support
            // sudo-admins, we should change this behaviour to be consistent with normal users.
            it('to admins not in the team (run directly)', () => {
                cy.apiLogin(sysadminNotInTeam);

                assertRunOverviewIsVisible(run);
            });
        });

        describe('should not be visible', () => {
            it('to team members', () => {
                assertRunIsNotVisible(run, teamMember);
            });

            it('to non-team members', () => {
                assertRunIsNotVisible(run, nonTeamMember);
            });

            it('to admins not in the team (list only)', () => {
                cy.apiLogin(sysadminNotInTeam);

                assertRunIsNotVisibleInList(run);
            });
        });
    });

    describe('run with public channel from a private playbook', () => {
        let playbook;
        let run;

        before(() => {
            // # Login as the user setup during initialization.
            cy.apiLogin(testUser);

            // # Create private playbook, configured to create private channels for runs
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [testUser.id, playbookMember.id],
                makePublic: false,
                createPublicPlaybookRun: true,
            }).then((createdPlaybook) => {
                playbook = createdPlaybook;

                // Login as the playbook member authorized to start a run
                cy.apiLogin(playbookMember);

                // Create a run
                cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: playbook.id,
                    playbookRunName: getRandomId(),
                    ownerUserId: runParticipant.id,
                }).then((createdRun) => {
                    run = createdRun;

                    // Have the dedicated participant join the run
                    cy.apiAddUsersToRun(run.id, [runParticipant.id]);
                });
            });
        });

        describe('should be visible', () => {
            it('to playbook members', () => {
                assertRunIsVisible(run, playbookMember);
            });

            it('to run participants', () => {
                assertRunIsVisible(run, runParticipant);
            });

            // Followers cannot follow a run with a private channel from a private playbook
            it('to run followers', () => {
                assertRunIsNotVisible(run, runFollower);
            });

            it('to admins in the team', () => {
                assertRunIsVisible(run, sysadminInTeam);
            });

            // XXX: The following asserts that while sysadmins don't see runs from other teams in
            // the list, they still have access to view the run directly. Once we support
            // sudo-admins, we should change this behaviour to be consistent with normal users.
            it('to admins not in the team (run directly)', () => {
                cy.apiLogin(sysadminNotInTeam);

                assertRunOverviewIsVisible(run);
            });
        });

        describe('should not be visible', () => {
            it('to team members', () => {
                assertRunIsNotVisible(run, teamMember);
            });

            it('to non-team members', () => {
                assertRunIsNotVisible(run, nonTeamMember);
            });

            it('to admins not in the team (list only)', () => {
                cy.apiLogin(sysadminNotInTeam);

                assertRunIsNotVisibleInList(run);
            });
        });
    });
});

const assertRunIsVisible = (run, user) => {
    // # Login as the user in question
    cy.apiLogin(user);

    // # Open Runs
    cy.visit('/playbooks/runs');

    // # Find the playbook run and click to open details view
    cy.get('#playbookRunList').within(() => {
        cy.findByText(run.name).click();
    });

    // * Verify that the details loaded
    cy.findByTestId('run-header-section').get('h1').contains(run.name);
};

const assertRunOverviewIsVisible = (run) => {
    // # Opening the playbook run directly
    cy.visit(`/playbooks/runs/${run.id}`);

    // * Verify that the details loaded
    cy.findByTestId('run-header-section').get('h1').contains(run.name);
};

const assertRunIsNotVisible = (run, user) => {
    // # Login as the user in question
    cy.apiLogin(user);

    assertRunIsNotVisibleInList(run, user);
    assertRunOverviewIsNotVisible(run, user);
};

const assertRunIsNotVisibleInList = (run) => {
    // # Open Runs
    cy.visit('/playbooks/runs');

    // * Verify the playbook run is not visible
    cy.get('#playbookRunList').within(() => {
        cy.findByText(run.name).should('not.exist');
    });
};

const assertRunOverviewIsNotVisible = (run) => {
    // # Opening the playbook run directly
    cy.visit(`/playbooks/runs/${run.id}`);

    // * Verify the not found error screen
    cy.get('.error__container').within(() => {
        cy.findByText('Run not found').should('be.visible');
        cy.findByText('The run you\'re requesting is private or does not exist.').should('be.visible');
    });
};
