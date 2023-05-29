// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {stubClipboard} from '../../../utils';

describe('playbooks > overview', {testIsolation: true}, () => {
    let testTeam;
    let testOtherTeam;
    let testUser;
    let testUser2;
    let testPublicPlaybook;
    let testPlaybookOnTeamForSwitching;
    let testPlaybookOnOtherTeamForSwitching;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // Create another user in the same team
            cy.apiCreateUser().then(({user: user2}) => {
                testUser2 = user2;
                cy.apiAddUserToTeam(testTeam.id, testUser2.id);
            });

            // # Create another team
            cy.apiCreateTeam('second-team', 'Second Team').then(({team: createdTeam}) => {
                testOtherTeam = createdTeam;
                cy.apiAddUserToTeam(testOtherTeam.id, testUser.id);

                // # Create a dedicated run follower
                cy.apiCreateUser().then(({user: createdUser}) => {
                    cy.apiAddUserToTeam(testTeam.id, createdUser.id);
                    cy.apiAddUserToTeam(testOtherTeam.id, createdUser.id);
                });

                // # Create another user
                cy.apiCreateUser().then(({user: anotherUser}) => {
                    // # Login as testUser
                    cy.apiLogin(testUser);

                    // # Create a public playbook
                    cy.apiCreatePlaybook({
                        teamId: testTeam.id,
                        title: 'Public Playbook',
                        memberIDs: [],
                        retrospectiveTemplate: 'Retro template text',
                        retrospectiveReminderIntervalSeconds: 60 * 60 * 24 * 7, // 7 days
                    }).then((playbook) => {
                        testPublicPlaybook = playbook;
                    });

                    // # Create a private playbook with only the current user
                    cy.apiCreatePlaybook({
                        teamId: testTeam.id,
                        title: 'Private Only Mine Playbook',
                        memberIDs: [testUser.id],
                    });

                    // # Create a private playbook with multiple users
                    cy.apiCreatePlaybook({
                        teamId: testTeam.id,
                        title: 'Private Shared Playbook',
                        memberIDs: [testUser.id, anotherUser.id],
                    });

                    // # Create a public playbook
                    cy.apiCreatePlaybook({
                        teamId: testTeam.id,
                        title: 'Switch A',
                        memberIDs: [],
                        retrospectiveTemplate: 'Retro template text',
                        retrospectiveReminderIntervalSeconds: 60 * 60 * 24 * 7, // 7 days
                    }).then((playbook) => {
                        testPlaybookOnTeamForSwitching = playbook;
                    });

                    // # Create a public playbook on another team
                    cy.apiCreatePlaybook({
                        teamId: testOtherTeam.id,
                        title: 'Switch B',
                        memberIDs: [],
                    }).then((playbook) => {
                        testPlaybookOnOtherTeamForSwitching = playbook;
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

    it('redirects to not found error if the playbook is unknown', () => {
        // # Visit the URL of a non-existing playbook
        cy.visit('/playbooks/playbooks/an_unknown_id');

        // * Verify that the user has been redirected to the playbooks not found error page
        cy.url().should('include', '/playbooks/error?type=playbooks');
    });

    describe('should switch to channels and prompt to run when clicking run', () => {
        const openAndRunPlaybook = (team) => {
            // # Navigate directly to town square on the team
            cy.visit(`${team.name}/channels/town-square`);

            // # Open Playbooks
            cy.get('[aria-label="Product switch menu"]').click({force: true});
            cy.get('a[href="/playbooks"]').click({force: true});

            // Click through to open the playbook
            cy.findByTestId('playbooksLHSButton').click({force: true});
            cy.get('[placeholder="Search for a playbook"]').type(testPlaybookOnTeamForSwitching.title);
            cy.findByTestId('playbook-title').click({force: true});

            // # Click Run Playbook
            cy.findByTestId('run-playbook').click({force: true});

            // * Verify the playbook run creation dialog has opened
            cy.get('#playbooks_run_playbook_dialog').should('exist').within(() => {
                cy.findByText('Start run').should('exist');
            });
        };

        it('for testPlaybookOnTeamForSwitching from its own team', () => {
            openAndRunPlaybook(testTeam, testPlaybookOnTeamForSwitching);
        });

        it('for testPlaybookOnTeamForSwitching from another team', () => {
            openAndRunPlaybook(testOtherTeam, testPlaybookOnTeamForSwitching);
        });

        it('for testPlaybookOnOtherTeamForSwitching from its own team', () => {
            openAndRunPlaybook(testTeam, testPlaybookOnOtherTeamForSwitching);
        });

        it('for testPlaybookOnOtherTeamForSwitchingOnOtherTeam from another team', () => {
            openAndRunPlaybook(testOtherTeam, testPlaybookOnOtherTeamForSwitching);
        });

        it('on direct navigation to a playbook', () => {
            // # Navigate directly to the playbook
            cy.visit(`/playbooks/playbooks/${testPlaybookOnTeamForSwitching.id}`);

            // # Click Run Playbook
            cy.findByTestId('run-playbook').click();

            // * Verify the playbook run creation dialog has opened
            cy.get('#playbooks_run_playbook_dialog').should('exist').within(() => {
                cy.findByText('Start run').should('exist');
            });
        });
    });

    it('should copy playbook link', () => {
        // # Navigate directly to the playbook
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);

        // # trigger the tooltip
        cy.get('.icon-link-variant').trigger('mouseover', {force: true});

        // * Verify tooltip text
        cy.get('#copy-playbook-link-tooltip').should('contain', 'Copy link to');

        stubClipboard().as('clipboard');

        // # click on copy button
        cy.get('.icon-link-variant').click({force: true}).then(() => {
            // * Verify that tooltip text changed
            cy.get('#copy-playbook-link-tooltip').should('contain', 'Copied!');

            // * Verify clipboard content
            cy.get('@clipboard').its('contents').should('contain', `/playbooks/playbooks/${testPublicPlaybook.id}`);
        });
    });

    it('should duplicate playbook', () => {
        // # Login as testUser2
        cy.apiLogin(testUser2);

        // # Navigate directly to the playbook
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);

        // # Click on playbook title
        cy.findByTestId('playbook-editor-title').click();

        // # Click on duplicate
        cy.findByText('Duplicate').click();

        // * Verify that playbook got duplicated
        cy.findByTestId('playbook-editor-title').should('contain', `Copy of ${testPublicPlaybook.title}`);

        // * Verify that the current user is a member and can run the playbook.
        cy.findByTestId('run-playbook').should('exist');
        cy.findByTestId('join-playbook').should('not.exist');

        // * Verify that the current user is the only member.
        cy.findByTestId('playbook-members').should('contain', '1');
    });

    describe('checklists', () => {
        describe('header', () => {
            beforeEach(() => {
                cy.apiCreatePlaybook({
                    teamId: testTeam.id,
                    title: 'Playbook',
                    description: 'Cypress Playbook',
                    memberIDs: [],
                    checklists: [
                        {
                            title: 'Stage 1',
                            items: [
                                {title: 'Step 1'},
                                {title: 'Step 2'},
                            ],
                        },
                    ],
                    retrospectiveTemplate: 'Cypress test template',
                }).then((playbook) => {
                    cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);
                });
            });

            it('has title', () => {
                cy.get('#checklists').within(() => {
                    cy.findByText('Tasks').should('exist');
                });
            });
        });

        it('shows checklists', () => {
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                description: 'Cypress Playbook',
                memberIDs: [],
                checklists: [
                    {
                        title: 'Stage 1',
                        items: [
                            {title: 'Step 1'},
                            {title: 'Step 2'},
                        ],
                    },
                ],
                retrospectiveTemplate: 'Cypress test template',
            }).then((playbook) => {
                cy.visit(`/playbooks/playbooks/${playbook.id}`);
            });

            // # Switch to Outline section
            cy.findByText('Outline').click();

            // * Verify checklist and associated steps
            cy.get('#checklists').within(() => {
                cy.findByText('Stage 1').should('exist');
                cy.findByText('Step 1').should('exist');
                cy.findByText('Step 2').should('exist');
            });
        });
    });

    it('shows correct retrospective timer and template text', () => {
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);
        cy.findByText('Outline').click();

        cy.get('#retrospective').within(() => {
            cy.findByText('7 days').should('exist');
            cy.findByText('Retro template text').should('exist');
        });
    });

    it('shows statistics in usage tab', () => {
        // # Start playbook run.
        const now = Date.now();
        const playbookRunName = `Run (${now})`;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPublicPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        }).then((playbookRun) => {
            // # Go to usage view
            cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);

            // * Verify basic information.
            cy.findByText('Runs currently in progress').next().should('contain', '1');
            cy.findByText('Participants currently active').next().should('contain', '1');
            cy.findByText('Runs finished in the last 30 days').next().should('contain', '0');

            // # End the run so those metrics change.
            cy.apiFinishRun(playbookRun.id).then(() => {
                cy.reload();

                // * Verify changes.
                cy.findByText('Runs currently in progress').next().should('contain', '0');
                cy.findByText('Participants currently active').next().should('contain', '0');
                cy.findByText('Runs finished in the last 30 days').next().should('contain', '1');
            });
        });
    });

    it('start a run', () => {
        // # Visit playbook page
        cy.visit(`/playbooks/playbooks/${testPublicPlaybook.id}`);

        // # Click Run Playbook
        cy.findByTestId('run-playbook').click();

        // # Enter the run name
        cy.findByTestId('run-name-input').clear().type('run1234567');

        // # Click start run button
        cy.get('button[data-testid=modal-confirm-button]').click();

        // * Verify the run is added to lhs
        cy.findByTestId('Runs').findByTestId('run1234567').should('exist');
    });

    describe('archiving', () => {
        const playbookTitle = 'Playbook (' + Date.now() + ')';
        let testPlaybook;

        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: playbookTitle,
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });

        it('shows intended UI and disallows further updates', () => {
            // # Programmatically archive it
            cy.apiArchivePlaybook(testPlaybook.id);

            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}`);

            // * Verify we're on the right playbook
            cy.get('[class^="Title-"]').contains(playbookTitle);

            // * Verify we can see the archived badge
            cy.get('.icon-archive-outline').should('be.visible');

            // * Verify the run button is disabled
            cy.findByTestId('run-playbook').should('be.disabled');

            // # Attempt to edit the playbook
            cy.apiGetPlaybook(testPlaybook.id).then((playbook) => {
                // # New title
                playbook.title = 'new Title!!!';

                // * Verify update fails
                cy.apiUpdatePlaybook(playbook, 400);
            });
        });
    });

    describe('start a run', () => {
        let testPlaybook;

        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);
        });

        after(() => {
            // # Login as testUser
            cy.apiLogin(testUser);
        });

        beforeEach(() => {
            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook (' + Date.now() + ')',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });

        it('start a run, create a new channel', () => {
            // # Visit playbook page
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}`);

            // # Click Run Playbook
            cy.findByTestId('run-playbook').click();

            // * Verify that channel configuration matches playbook config
            cy.findByTestId('link-existing-channel-radio').should('not.be.checked');
            cy.get('#link-existing-channel-selector').should('not.exist');
            cy.findByTestId('create-channel-radio').should('be.checked');
            cy.findByTestId('create-private-channel-radio').should('be.checked');

            // # Enter the run name
            const runName = 'run' + Date.now();
            cy.findByTestId('run-name-input').clear().type(runName);

            // # Click start run button
            cy.get('button[data-testid=modal-confirm-button]').click();

            // * Verify the run is added to lhs
            cy.findByTestId('Runs').findByTestId(runName).should('exist');

            // * Verify the channel is created
            cy.findByTestId('runinfo-channel-link').contains(runName);
        });

        it('start a run in existing channel', () => {
            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Select the action section.
            cy.get('#actions #link-existing-channel').within(() => {
                // # Enable link to existing channel
                cy.get('input[type=radio]').click();

                // * Verify that the toggle is checked and input is enabled
                cy.get('input[type=radio]').should('be.checked');
                cy.get('input[type=text]').should('not.be.disabled');

                // # Select channel
                cy.findByText('Select a channel').click().type('Town{enter}');
            });

            // # Click Run Playbook
            cy.findByTestId('run-playbook').click({force: true});

            // # Enter the run name
            const runName = 'run' + Date.now();
            cy.findByTestId('run-name-input').clear().type(runName);

            // * Verify that channel configuration matches playbook config
            cy.findByTestId('link-existing-channel-radio').should('be.checked');
            cy.get('#link-existing-channel-selector').get('input[type=text]').should('be.enabled');
            cy.findByTestId('create-channel-radio').should('not.be.checked');
            cy.findByTestId('create-private-channel-radio').should('not.exist');

            // # Click start run button
            cy.get('button[data-testid=modal-confirm-button]').click();

            // * Verify the run is added to lhs
            cy.findByTestId('Runs').findByTestId(runName).should('exist');

            // * Verify the channel is created
            cy.findByTestId('runinfo-channel-link').contains('Town');
        });
    });
});
