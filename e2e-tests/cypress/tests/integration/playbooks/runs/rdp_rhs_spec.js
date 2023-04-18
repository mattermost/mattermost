// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run details page > RHS', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testViewerUser;
    let testPublicPlaybook;
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
            }).then((playbook) => {
                testPublicPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Login as testUser
        cy.apiLogin(testUser);

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

    const getRHS = () => cy.findByRole('complementary');

    const getHeaderButton = (name) => cy.findByTestId(`rhs-header-button-${name}`);

    const checkRHSTitle = (expectedTitle) => {
        getRHS().within(() => {
            cy.findByTestId('rhs-title').contains(expectedTitle);
        });
    };

    const commonTests = () => {
        it('timeline button toggles timeline in the RHS', () => {
            // * Verify that the run info RHS is open
            checkRHSTitle('Run info');

            // # Click on the header timeline button
            getHeaderButton('timeline').click();

            // * Verify that the run info RHS changed to Timeline
            checkRHSTitle('Timeline');

            // # Wait so we don't double-click
            cy.wait(500);

            // # Click again on the header timeline button
            getHeaderButton('timeline').click();

            // * Verify that the RHS is closed
            getRHS().should('not.exist');
        });

        it('info button toggles info in the RHS', () => {
            // * Verify that the run info RHS is open
            checkRHSTitle('Run info');

            // # Click on the header info button
            getHeaderButton('info').click();

            // * Verify that the RHS is now closed
            getRHS().should('not.exist');

            // # Wait so we don't double-click
            cy.wait(500);

            // # Click again on the header info button
            getHeaderButton('info').click();

            // * Verify that the run info RHS is open again
            checkRHSTitle('Run info');
        });
    };

    describe('as participant', () => {
        commonTests();
    });

    describe('as viewer', () => {
        beforeEach(() => {
            cy.apiLogin(testViewerUser).then(() => {
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });
        });

        commonTests();
    });
});
