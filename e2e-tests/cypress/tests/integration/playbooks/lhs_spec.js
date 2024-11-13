// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import {HALF_SEC} from '../../fixtures/timeouts';
import {stubClipboard} from '../../utils';

describe('lhs', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPublicPlaybook;
    let testPrivatePlaybook;
    let playbookRun;
    let testViewerUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create another user in the same team
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

            // # Create a private playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Private Playbook',
                memberIDs: [],
                public: false,
            }).then((playbook) => {
                testPrivatePlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Intercepts telemetry
        cy.interceptTelemetry();
    });

    const getRunDropdownItemByText = (groupName, runName, itemName) => {
        // # Click on run at LHS
        cy.findByTestId(groupName).findByTestId(runName).click();

        // # Click dot menu
        cy.findByTestId(groupName).
            findByTestId(runName).
            findByTestId('menuButton').
            click({force: true});

        cy.findByTestId('dropdownmenu').should('be.visible');

        return cy.findByTestId('dropdownmenu').findByText(itemName).should('be.visible');
    };

    describe('navigate', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'the run name(' + Date.now() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                // # Visit the playbook run
                cy.visit('/playbooks/runs');
                cy.findByTestId('lhs-navigation').findByText(playbookRun.name).should('be.visible');
            });

            cy.wait;
        });

        it('click run', () => {
            // # Click on run at LHS
            cy.findByTestId('Runs').findByTestId(playbookRun.name).click();

            // * assert telemetry
            cy.expectTelemetryToContain([
                {
                    type: 'page',
                    name: 'run_details',
                    properties: {
                        from: 'playbooks_lhs',
                        role: 'participant',
                        playbookrun_id: playbookRun.id,
                        playbook_id: testPublicPlaybook.id,
                    },
                },
            ]);
        });
    });

    describe('run dot menu', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPublicPlaybook.id,
                playbookRunName: 'the run name(' + Date.now() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;
            });
        });

        it('shows on click', () => {
            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);

            // # Click dot menu
            cy.findByTestId('Runs').
                findByTestId(playbookRun.name).
                findByTestId('menuButton').
                click({force: true});

            // * Assert context menu is opened
            cy.findByTestId('dropdownmenu').should('be.visible');
        });

        it('can copy link', () => {
            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);
            stubClipboard().as('clipboard');

            // # Click on Copy link menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Copy link').click();

            // * Verify clipboard content
            cy.get('@clipboard').its('contents').should('contain', `/playbooks/runs/${playbookRun.id}`);
        });

        it('can favorite / unfavorite', () => {
            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);

            // # Click on favorite menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Favorite').click();

            // * Verify the run is added to favorites
            cy.findByTestId('Favorite').findByTestId(playbookRun.name).should('exist');

            // # Click on unfavorite menu item
            getRunDropdownItemByText('Favorite', playbookRun.name, 'Unfavorite').click();

            // * Verify the run is removed from favorites
            cy.findByTestId('Favorite').should('not.exist');
        });

        it('lhs refresh on follow/unfollow', () => {
            cy.apiLogin(testViewerUser);

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);

            // # The assertions here guard against the click() on 194
            // # happening on a detached element.
            cy.assertRunDetailsPageRenderComplete(testUser.username);
            cy.findByTestId('runinfo-following').should('be.visible').within(() => {
                // # Verify follower icon
                cy.findAllByTestId('profile-option', {exact: false}).should('have.length', 1);
                cy.findByText('Follow').should('be.visible').click();

                // # Verify icons update
                cy.findAllByTestId('profile-option', {exact: false}).should('have.length', 2);
            });

            // * Verify that the run was added to the lhs
            cy.findByTestId('lhs-navigation').findByText(playbookRun.name).should('exist');

            // # Click on unfollow menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Unfollow').click();

            // * Verify that the run is removed lhs
            cy.findByTestId('Runs').findByTestId(playbookRun.name).should('not.exist');

            // # assert telemetry data
            cy.expectTelemetryToContain([
                {
                    type: 'track',
                    name: 'playbookrun_follow',
                    properties: {
                        from: 'run_details',
                        playbookrun_id: playbookRun.id,
                    },
                },
                {
                    type: 'track',
                    name: 'playbookrun_unfollow',
                    properties: {
                        from: 'playbooks_lhs',
                        playbookrun_id: playbookRun.id,
                    },
                },
            ]);
        });

        it('leave run', () => {
            // # Add viewer user to the channel
            cy.apiAddUsersToRun(playbookRun.id, [testViewerUser.id]);

            // # Visit the playbook run
            cy.visit(`/playbooks/runs/${playbookRun.id}`);

            // # Click on leave menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Leave and unfollow run').click();

            // * Verify that owner can't leave.
            cy.get('#confirmModal').should('not.exist');

            // # Change the owner to testViewerUser
            cy.findByTestId('runinfo-owner').findByTestId('assignee-profile-selector').click();
            cy.get('.playbook-react-select').findByText('@' + testViewerUser.username).click();

            // # Wait for owner to change
            cy.wait(HALF_SEC);

            // # Click on leave menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Leave and unfollow run').click();

            // * Click leave confirmation
            cy.get('#confirmModalButton').click();

            // # assert telemetry data
            cy.expectTelemetryToContain([
                {
                    type: 'track',
                    name: 'playbookrun_leave',
                    properties: {
                        from: 'playbooks_lhs',
                        playbookrun_id: playbookRun.id,
                    },
                },
            ]);
        });
    });

    describe('leave run - no permanent access', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPrivatePlaybook.id,
                playbookRunName: 'the run name(' + Date.now() + ')',
                ownerUserId: testUser.id,
            }).then((run) => {
                playbookRun = run;

                cy.apiAddUsersToRun(playbookRun.id, [testViewerUser.id]);

                cy.apiLogin(testViewerUser).then(() => {
                    // # Visit the playbook run
                    cy.visit(`/playbooks/runs/${playbookRun.id}`);
                });
            });
        });

        it('leave run, when on rdp of the same run', () => {
            // # Click on leave menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Leave and unfollow run').click();

            // # confirm modal
            cy.get('#confirmModal').should('be.visible').within(() => {
                cy.get('#confirmModalButton').click();
            });

            // * Verify that user was redirected to the run list page
            cy.url().should('include', 'playbooks/runs?sort=');
        });

        it('leave run, when not on rdp of the same run', () => {
            // # Visit playbooks list page
            cy.visit('/playbooks/playbooks');

            // # Click on leave menu item
            getRunDropdownItemByText('Runs', playbookRun.name, 'Leave and unfollow run').click();

            // # confirm modal
            cy.get('#confirmModal').should('be.visible').within(() => {
                cy.get('#confirmModalButton').click();
            });

            // * Verify that user was not redirected to the run list page
            cy.url().should('not.include', 'playbooks/runs?sort=');
        });
    });

    describe('playbook dot menu', () => {
        beforeEach(() => {
            // # Size the viewport to show the RHS without covering posts.
            cy.viewport('macbook-13');

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'the run name(' + Date.now() + ')',
                memberIDs: [],
            }).then((playbook) => {
                testPublicPlaybook = playbook;

                // # Visit the playbooks page
                cy.visit('/playbooks/playbooks');
            });
        });

        it('shows on click', () => {
            // # Click dot menu
            cy.findByTestId('Playbooks').
                findByTestId(testPublicPlaybook.title).
                findByTestId('menuButton').
                click({force: true});

            // * Assert context menu is opened
            cy.findByTestId('dropdownmenu').should('be.visible');
        });

        it('can copy link', () => {
            stubClipboard().as('clipboard');

            // # Click on Copy link menu item
            getRunDropdownItemByText('Playbooks', testPublicPlaybook.title, 'Copy link').click();

            // * Verify clipboard content
            cy.get('@clipboard').
                its('contents').
                should('contain', `/playbooks/playbooks/${testPublicPlaybook.id}`);
        });

        it('can favorite / unfavorite', () => {
            // # Click on favorite menu item
            getRunDropdownItemByText('Playbooks', testPublicPlaybook.title, 'Favorite').click();

            // * Verify the playbook is added to favorites
            cy.findByTestId('Favorite').findByTestId(testPublicPlaybook.title).should('exist');

            // # Click on unfavorite menu item
            getRunDropdownItemByText('Favorite', testPublicPlaybook.title, 'Unfavorite').click();

            // * Verify the playbook is removed from favorites
            cy.findByTestId('Playbooks').findByTestId(testPublicPlaybook.title).should('exist');
        });

        it('can leave', () => {
            stubClipboard().as('clipboard');

            // # Click on Leave menu item
            getRunDropdownItemByText('Playbooks', testPublicPlaybook.title, 'Leave').click();

            // * Verify the playbook is removed from the list
            cy.findByTestId('Playbooks').findByTestId(testPublicPlaybook.title).should('not.exist');
        });
    });
});
