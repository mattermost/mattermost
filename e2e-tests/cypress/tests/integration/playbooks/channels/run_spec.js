// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels > run', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPrivateChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreatePlaybook({
                teamId: team.id,
                title: 'Playbook',
                memberIDs: [user.id],
            });

            // # Create a private channel
            cy.apiCreateChannel(
                testTeam.id,
                'private-channel',
                'Private Channel',
                'P',
            ).then(({channel}) => {
                testPrivateChannel = channel;
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Size the viewport to show plugin icons even when RHS is open
        cy.viewport('macbook-13');
    });

    describe('via slash command', () => {
        it('while viewing a public channel', () => {
            // # Visit a public channel
            cy.visit(`/${testTeam.name}/channels/off-topic`);

            // * Verify that playbook run can be started with slash command
            const playbookRunName = 'Public ' + Date.now();
            cy.startPlaybookRunWithSlashCommand('Playbook', playbookRunName);
            cy.verifyPlaybookRunActive(testTeam.id, playbookRunName);
        });

        it('while viewing a private channel', () => {
            // # Visit a private channel
            cy.visit(`/${testTeam.name}/channels/${testPrivateChannel.name}`);

            // * Verify that playbook run can be started with slash command
            const playbookRunName = 'Private ' + Date.now();
            cy.startPlaybookRunWithSlashCommand('Playbook', playbookRunName);
            cy.verifyPlaybookRunActive(testTeam.id, playbookRunName);
        });
    });

    describe('via post menu', () => {
        it('while viewing a public channel', () => {
            // # Visit a public channel
            cy.visit(`/${testTeam.name}/channels/off-topic`);

            // * Verify that playbook run can be started from post menu
            const playbookRunName = 'Public - ' + Date.now();
            cy.startPlaybookRunFromPostMenu('Playbook', playbookRunName);
            cy.verifyPlaybookRunActive(testTeam.id, playbookRunName);
        });

        it('while viewing a private channel', () => {
            // # Visit a private channel
            cy.visit(`/${testTeam.name}/channels/${testPrivateChannel.name}`);

            // * Verify that playbook run can be started from post menu
            const playbookRunName = 'Private - ' + Date.now();
            cy.startPlaybookRunFromPostMenu('Playbook', playbookRunName);
            cy.verifyPlaybookRunActive(testTeam.id, playbookRunName);
        });
    });

    it('always as channel admin', () => {
        // # Visit a public channel
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # Start a playbook run with a slash command
        const playbookRunName = 'Public ' + Date.now();
        cy.startPlaybookRunWithSlashCommand('Playbook', playbookRunName);
        cy.verifyPlaybookRunActive(testTeam.id, playbookRunName);

        // # Open the channel header
        cy.get('#channelHeaderTitle').click();

        // * Verify the ability to edit the channel header exists
        cy.get('#channelEditHeader').should('exist');
    });
});
