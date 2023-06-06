// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > rhs > title', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let playbookRunChannelName;
    let testPlaybookRun;

    const getHeaderTitle = () => cy.get('#rhsContainer').find('.sidebar--right__title');

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show the RHS without covering posts.
        cy.viewport('macbook-13');

        // # Run the playbook
        const now = Date.now();
        const playbookRunName = 'Playbook Run (' + now + ')';
        playbookRunChannelName = 'playbook-run-' + now;
        cy.apiRunPlaybook({
            teamId: testTeam.id,
            playbookId: testPlaybook.id,
            playbookRunName,
            ownerUserId: testUser.id,
        }).then((run) => {
            testPlaybookRun = run;
        });

        // # Navigate directly to the application and the playbook run channel
        cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);
    });

    it('has title', () => {
        // * Verify the title is displayed
        getHeaderTitle().contains('Run details');
    });

    it('has following button', () => {
        // * Verify the following button  is displayed
        getHeaderTitle().find('button.unfollowButton').contains('Following');

        // * Verify the follow button is not displayed
        getHeaderTitle().find('button.followButton').should('not.exist');
    });

    it('can stop following', () => {
        // # Click the following button
        getHeaderTitle().find('button.unfollowButton').click();

        // * Verify the following button is not displayed
        getHeaderTitle().find('button.unfollowButton').should('not.exist');

        // * Verify the follow button is displayed
        getHeaderTitle().find('button.followButton').contains('Follow');
    });

    it('can navigate to RDP', () => {
        // # Click the title
        getHeaderTitle().findByTestId('rhs-title').click();

        // * assert url is RDP
        cy.url().should('include', `/playbooks/runs/${testPlaybookRun.id}`);
    });
});
