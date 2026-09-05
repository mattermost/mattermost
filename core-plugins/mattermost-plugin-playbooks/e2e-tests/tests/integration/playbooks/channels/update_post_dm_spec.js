// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > status update posts in DMs', {testIsolation: true}, () => {
    let testTeam;
    let userA;
    let userB;
    let testPlaybookRun;

    beforeEach(() => {
        cy.apiAdminLogin();

        cy.apiInitSetup({loginAfter: false}).then(({team, user}) => {
            testTeam = team;
            userA = user;

            // # Create second user
            cy.apiCreateUser().then(({user: secondUser}) => {
                userB = secondUser;
                cy.apiAddUserToTeam(testTeam.id, userB.id);

                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Test Playbook',
                    memberIDs: [],
                    createPublicPlaybookRun: true,
                }).then((playbook) => {
                    cy.apiRunPlaybook({
                        teamId: testTeam.id,
                        playbookId: playbook.id,
                        playbookRunName: 'Test Run',
                        ownerUserId: userA.id,
                    }).then((playbookRun) => {
                        testPlaybookRun = playbookRun;

                        // # Add both users as participants to the run
                        cy.apiAddUsersToRun(playbookRun.id, [userA.id, userB.id]);
                    });
                });
            });
        });
    });

    it('status update posts render correctly in DMs from playbooks bot', () => {
        const updateMessage = 'Test status update with **markdown**';

        // # User A posts a status update
        cy.apiLogin(userA);
        cy.apiUpdateStatus({
            playbookRunId: testPlaybookRun.id,
            message: updateMessage,
        });
        cy.apiLogout();

        // # Switch to User B
        cy.apiLogin(userB);

        // # User B visits the DM channel with playbooks bot
        cy.visit(`/${testTeam.name}/messages/@playbooks`);

        // * Verify the status update message is visible
        cy.get('[data-testid="postView"]').first().within(() => {
            cy.contains('Test status update with markdown');
            cy.contains(`@${userA.username} posted an update for ${testPlaybookRun.name}`);
        });
    });
});
