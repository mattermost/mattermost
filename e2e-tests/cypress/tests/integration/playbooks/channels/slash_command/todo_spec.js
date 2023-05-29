// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > slash command > todo', {testIsolation: true}, () => {
    let team1;
    let team2;
    let testUser;
    let testOtherUser;
    let run1;
    let run2;
    let run3;
    let run4;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            team1 = team;
            testUser = user;

            cy.apiCreateUser().then(({user: otherUser}) => {
                testOtherUser = otherUser;

                // # Add this new user to the team
                cy.apiAddUserToTeam(team1.id, testOtherUser.id);

                // # Login as testUser
                cy.apiLogin(testUser);

                // # Create a public playbook
                cy.apiCreatePlaybook({
                    teamId: team1.id,
                    title: 'Playbook One',
                    memberIDs: [],
                    createPublicPlaybookRun: true,
                    checklists: [
                        {
                            title: 'Playbook One - Stage 1',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                        {
                            title: 'Playbook One - Stage 2',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                    ],
                }).then(({id: playbookId}) => {
                    // # Create two runs in team 1.
                    const now = Date.now();
                    cy.apiRunPlaybook({
                        teamId: team1.id,
                        playbookId,
                        playbookRunName: 'Playbook Run (' + now + ')',
                        ownerUserId: testUser.id,
                    }).then((run) => {
                        run1 = run;
                    });

                    const now2 = Date.now() + 100;
                    cy.apiRunPlaybook({
                        teamId: team1.id,
                        playbookId,
                        playbookRunName: 'Playbook Run (' + now2 + ')',
                        ownerUserId: testUser.id,
                    }).then((run) => {
                        run2 = run;
                    });
                });

                // # Create a second team to test cross-team notifications
                cy.apiCreateTeam('team2', 'Team 2').then(({team: secondTeam}) => {
                    team2 = secondTeam;

                    cy.apiAdminLogin();
                    cy.apiAddUserToTeam(team2.id, testUser.id);
                    cy.apiLogin(testUser);

                    // # Create a public playbook
                    cy.apiCreatePlaybook({
                        teamId: team2.id,
                        title: 'Playbook Two',
                        memberIDs: [],
                        createPublicPlaybookRun: true,
                        checklists: [
                            {
                                title: 'Playbook Two - Stage 1',
                                items: [
                                    {title: 'Step 1'},
                                    {title: 'Step 2'},
                                ],
                            },
                            {
                                title: 'Playbook Two - Stage 2',
                                items: [
                                    {title: 'Step 1'},
                                    {title: 'Step 2'},
                                ],
                            },
                        ],
                    }).then(({id: playbookId}) => {
                        // # Create one run in team 2.
                        const now = Date.now() + 200;
                        cy.apiRunPlaybook({
                            teamId: team2.id,
                            playbookId,
                            playbookRunName: 'Playbook Run (' + now + ')',
                            ownerUserId: testUser.id,
                        }).then((run) => {
                            run3 = run;
                        });
                    });
                });

                // # Create another playbook with runs owned by another user
                cy.apiCreatePlaybook({
                    teamId: team1.id,
                    title: 'Playbook Other',
                    memberIDs: [],
                    createPublicPlaybookRun: true,
                    checklists: [
                        {
                            title: 'Playbook Other - Stage 1',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                        {
                            title: 'Playbook Other - Stage 2',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                    ],
                }).then(({id: playbookId}) => {
                    // # Login as testOtherUser
                    cy.apiLogin(testOtherUser);

                    // # Create a run in team 1, with testOtherUser as owner and inviting testUser
                    const now = Date.now();
                    cy.apiRunPlaybook({
                        teamId: team1.id,
                        playbookId,
                        playbookRunName: 'Other Playbook Run (' + now + ')',
                        ownerUserId: testOtherUser.id,
                    }).then((run) => {
                        run4 = run;

                        // # Invite testUser to the channel
                        // cy.apiAddUserToChannel(run.channel_id, testUser.id);
                        cy.apiAddUsersToRun(run.id, [testUser.id]);

                        // # Force this run to be overdue
                        cy.apiUpdateStatus({
                            playbookRunId: run4.id,
                            message: 'no message 4',
                            reminder: 1,
                        });
                    });

                    // # Create a run in team 1, with testOtherUser as owner but not inviting testUser
                    const now2 = Date.now() + 100;
                    cy.apiRunPlaybook({
                        teamId: team1.id,
                        playbookId,
                        playbookRunName: 'Other Playbook Run (' + now2 + ')',
                        ownerUserId: testOtherUser.id,
                    }).then((run) => {
                        // # Force this run to be overdue
                        cy.apiUpdateStatus({
                            playbookRunId: run.id,
                            message: 'no message 5',
                            reminder: 1,
                        });
                    });
                });
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('/playbook todo should show', () => {
        it('three runs', () => {
            // # Navigate to a non-playbook run channel.
            cy.visit(`/${team2.name}/channels/town-square`);

            // # Run a slash command to show the to-do list.
            cy.uiPostMessageQuickly('/playbook todo');

            cy.getLastPost().within((post) => {
                // * Should show titles
                cy.wrap(post).contains('You have 0 runs overdue.');
                cy.wrap(post).contains('You have 0 assigned tasks.');
                cy.wrap(post).contains('You have 4 runs currently in progress:');

                // * Should show four active runs
                cy.get('li').then((liItems) => {
                    expect(liItems[0]).to.contain.text(run4.name);
                    expect(liItems[1]).to.contain.text(run1.name);
                    expect(liItems[2]).to.contain.text(run2.name);
                    expect(liItems[3]).to.contain.text(run3.name);
                });
            });
        });

        it('four assigned tasks', () => {
            // # assign self four tasks
            cy.apiChangeChecklistItemAssignee(run1.id, 0, 0, testUser.id);
            cy.apiChangeChecklistItemAssignee(run1.id, 1, 1, testUser.id);
            cy.apiChangeChecklistItemAssignee(run2.id, 0, 1, testUser.id);
            cy.apiChangeChecklistItemAssignee(run3.id, 1, 0, testUser.id);

            // # Navigate to a non-playbook run channel.
            cy.visit(`/${team2.name}/channels/town-square`);

            // # Run a slash command to show the to-do list.
            cy.uiPostMessageQuickly('/playbook todo');

            cy.getLastPost().within((post) => {
                // * Should show titles
                cy.wrap(post).contains('You have 0 runs overdue.');
                cy.wrap(post).contains('You have 4 total assigned tasks:');

                // * Should show 3 runs w/ tasks
                cy.get('.post__body a').then((links) => {
                    expect(links[0]).to.contain.text(run1.name);
                    expect(links[1]).to.contain.text(run2.name);
                    expect(links[2]).to.contain.text(run3.name);
                });

                cy.get('.post__body li').then((items) => {
                    // * first run
                    expect(items[0]).to.contain.text('Playbook One - Stage 1: Step 1');
                    expect(items[1]).to.contain.text('Playbook One - Stage 2: Step 2');

                    // * second run
                    expect(items[2]).to.contain.text('Playbook One - Stage 1: Step 2');

                    // * third run
                    expect(items[3]).to.contain.text('Playbook Two - Stage 2: Step 1');
                });
            });

            // # check two of the items via API
            cy.apiSetChecklistItemState(run1.id, 0, 0, 'closed');
            cy.apiSetChecklistItemState(run3.id, 1, 0, 'closed');

            // # Show the to-do list.
            cy.uiPostMessageQuickly('/playbook todo');

            // * Should show 2 tasks
            cy.getLastPost().within((post) => {
                // * Should show titles
                cy.wrap(post).contains('You have 0 runs overdue.');
                cy.wrap(post).contains('You have 2 total assigned tasks:');

                // * Should show 2 runs w/ tasks
                cy.get('.post__body a').then((links) => {
                    expect(links[0]).to.contain.text(run1.name);
                    expect(links[1]).to.contain.text(run2.name);
                });

                cy.get('.post__body li').then((items) => {
                    // * first run
                    expect(items[0]).to.contain.text('Playbook One - Stage 2: Step 2');

                    // * second run
                    expect(items[1]).to.contain.text('Playbook One - Stage 1: Step 2');
                });
            });
        });

        it('two overdue status updates', () => {
            // # set two updates with short timers
            cy.apiUpdateStatus({
                playbookRunId: run1.id,
                message: 'no message 1',
                reminder: 1,
            });
            cy.apiUpdateStatus({
                playbookRunId: run3.id,
                message: 'no message 3',
                reminder: 1,
            });

            cy.wait(1100);

            // # Switch to playbooks DM channel
            cy.visit(`/${team2.name}/messages/@playbooks`);

            // # Run a slash command to show the to-do list.
            cy.uiPostMessageQuickly('/playbook todo');

            // # Should show two runs overdue -- ignoring the rest
            cy.getLastPost().within(() => {
                cy.get('.post__body li').then((liItems) => {
                    expect(liItems[0]).to.contain.text(run1.name);
                    expect(liItems[1]).to.contain.text(run3.name);
                });
            });
        });
    });
});
