// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('channels > rhs', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook',
                memberIDs: [],
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('does not open', () => {
        it('when navigating to a non-playbook run channel', () => {
            // # Navigate to the application
            cy.visit(`/${testTeam.name}/`);

            // # Select a channel without a playbook run.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Wait until the channel loads enough to show the post textbox.
            cy.get('#post-create').should('exist');

            // # Wait a bit longer to be confident.
            cy.wait(TIMEOUTS.TWO_SEC);

            // * Verify the playbook run RHS is not open.
            cy.get('#rhsContainer').should('not.exist');
        });

        it('when navigating to a playbook run channel with the RHS already open', () => {
            // # Navigate to the application.
            cy.visit(`/${testTeam.name}/`);

            // # Select a channel without a playbook run.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Run the playbook after loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            });

            // # Open the flagged posts RHS
            cy.get('body').then(($body) => {
                if ($body.find('#channelHeaderFlagButton').length > 0) {
                    cy.get('#channelHeaderFlagButton').click({force: true});
                } else {
                    cy.findByRole('button', {name: 'Saved posts'}).
                        click({force: true});
                }
            });

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // # Wait until the channel loads enough to show the post textbox.
            cy.get('#post-create').should('exist');

            // # Wait a bit longer to be confident.
            cy.wait(TIMEOUTS.TWO_SEC);

            // * Verify the playbook run RHS is not open.
            cy.get('#rhsContainer').should('not.exist');
        });

        it('when navigating directly to a finished playbook run channel', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiFinishRun(playbookRun.id);
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // # Wait a bit longer to be confident.
            cy.wait(TIMEOUTS.TWO_SEC);

            // * Verify the playbook run RHS is not open.
            cy.get('#rhsContainer').should('not.exist');
        });

        it('for an existing, finished playbook run channel opened from the lhs', () => {
            // # Run the playbook before loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;

            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiFinishRun(playbookRun.id);
            });

            // # Navigate to a channel without a playbook run.
            cy.visit(`/${testTeam.name}/channels/off-topic`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.findByTestId('post_textbox').should('exist');

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // # Wait a bit longer to be confident.
            cy.wait(TIMEOUTS.TWO_SEC);

            // * Verify the playbook run RHS is not open.
            cy.get('#rhsContainer').should('not.exist');
        });

        it('for a new, finished playbook run channel opened from the lhs', () => {
            // # Navigate to the application.
            cy.visit(`/${testTeam.name}/`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.findByTestId('post_textbox').should('exist');

            // # Select a channel without a playbook run.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // * Verify the playbook run RHS is not open.
            cy.get('#rhsContainer').should('not.exist');

            // # Run the playbook after loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # Wait a bit longer to avoid websocket events potentially being out-of-order.
                cy.wait(TIMEOUTS.TWO_SEC);

                // # End the playbook run
                cy.apiFinishRun(playbookRun.id);
            });

            // # Wait because this test is flaky if we move too quickly
            cy.wait(TIMEOUTS.FIVE_SEC);

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // # Wait a bit longer to be confident.
            cy.wait(TIMEOUTS.FIVE_SEC);

            // * Verify the playbook run RHS is not open.
            cy.get('#rhsContainer').should('not.exist');
        });

        it('when starting a new run of a newly-created playbook created from RHS in a newly-created channel', () => {
            // # Create a new channel
            const channelName = 'playbook-test-' + Date.now();
            cy.apiCreateChannel(testTeam.id, channelName, channelName, 'O').then(({channel}) => {
                // # Navigate to the new channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // # Open RHS
                cy.getPlaybooksAppBarIcon().click();

                // # Wait a bit
                cy.wait(TIMEOUTS.TWO_SEC);

                // # open start run dialog
                cy.findByTestId('rhs-runlist-start-run').click();

                // # Create a new playbook
                cy.findByText('Create new playbook').click();

                // # confirm new playbook creation (with defaults)
                cy.findByTestId('modal-confirm-button').click();

                // * Verify we're in the playbook edit screen
                cy.findByTestId('playbook-members');

                // # Run the playbook
                cy.findByTestId('run-playbook').click();
                cy.findByTestId('run-name-input').type('Playbook Run');

                // # Link to the new channel
                cy.findByTestId('link-existing-channel-radio').click();
                cy.get('#link-existing-channel-selector input').type(`${channel.name}{enter}`, {force: true});

                cy.findByTestId('modal-confirm-button').click();

                // # Wait a bit
                cy.wait(TIMEOUTS.FIVE_SEC);

                // * Verify the playbook run RHS is not open.
                cy.get('#rhsContainer').should('not.exist');
            });
        });
    });

    describe('opens', () => {
        it('when navigating directly to an ongoing playbook run channel', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('for a new, ongoing playbook run channel opened from the lhs', () => {
            // # Navigate to the application.
            cy.visit(`/${testTeam.name}/`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.findByTestId('post_textbox').should('exist');

            // # Select a channel without a playbook run.
            cy.get('#sidebarItem_off-topic').click({force: true});

            // # Run the playbook after loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            });

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('for an existing, ongoing playbook run channel opened from the lhs', () => {
            // # Run the playbook before loading the application
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            });

            // # Navigate to a channel without a playbook run.
            cy.visit(`/${testTeam.name}/channels/off-topic`);

            // # Ensure the channel is loaded before continuing (allows redux to sync).
            cy.findByTestId('post_textbox').should('exist');

            // # Open the playbook run channel from the LHS.
            cy.get(`#sidebarItem_${playbookRunChannelName}`).click({force: true});

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('when starting a playbook run', () => {
            // # Navigate to the application and a channel without a playbook run
            cy.visit(`/${testTeam.name}/channels/off-topic`);

            // # Start a playbook run with a slash command
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';

            cy.startPlaybookRunWithSlashCommand('Playbook', playbookRunName);

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('when starting a playbook run when rhs is already open', () => {
            // # Navigate to the application and a channel without a playbook run
            cy.visit(`/${testTeam.name}/channels/off-topic`);

            // # Wait until the channel loads enough to show the post textbox.
            cy.get('#post-create').should('exist');

            // # Open the saved posts RHS
            cy.findByRole('button', {name: 'Saved posts'}).
                click({force: true});

            // * Verify Saved Posts is open
            cy.get('.sidebar--right__title').should('contain.text', 'Saved Posts');

            // # Start a playbook run with a slash command
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            cy.startPlaybookRunWithSlashCommand('Playbook', playbookRunName);

            // * Verify the playbook run RHS is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText(playbookRunName).should('exist');
            });
        });

        it('when navigating directly to a finished playbook run channel and clicking on the button', () => {
            // # Run the playbook
            const now = Date.now();
            const playbookRunName = 'Playbook Run (' + now + ')';
            const playbookRunChannelName = 'playbook-run-' + now;
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName,
                ownerUserId: testUser.id,
            }).then((playbookRun) => {
                // # End the playbook run
                cy.apiFinishRun(playbookRun.id);
            });

            // # Navigate directly to the application and the playbook run channel
            cy.visit(`/${testTeam.name}/channels/${playbookRunChannelName}`);

            // # Click the icon
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // * Verify no active runs screen shows
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByTestId('no-active-runs').should('exist');
            });
        });
    });

    describe('is toggled', () => {
        it('by icon in channel header', () => {
            // # Size the viewport to show plugin icons even when RHS is open
            cy.viewport('macbook-13');

            // # Navigate to the application and a channel without a playbook run
            cy.visit(`/${testTeam.name}/channels/off-topic`);

            // # Click the icon
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // * Verify RHS Home is open.
            cy.get('#rhsContainer').should('exist').within(() => {
                cy.findByText('Playbooks').should('exist');
            });

            // # Click the icon
            cy.getPlaybooksAppBarIcon().should('be.visible').click();

            // * Verify the playbook run RHS is no longer open.
            cy.get('#rhsContainer').should('not.exist');
        });
    });
});
