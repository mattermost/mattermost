// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('channels > general actions', {testIsolation: true}, () => {
    let testTeam;
    let testSysadmin;
    let testUser;
    let testChannel;

    beforeEach(() => {
        cy.apiAdminLogin();

        cy.apiInitSetup({promoteNewUserAsAdmin: true}).then(({team, user}) => {
            testTeam = team;
            testSysadmin = user;

            cy.apiCreateUser().then((resp) => {
                testUser = resp.user;
                cy.apiAddUserToTeam(team.id, resp.user.id);

                cy.apiLogin(testUser);

                // TODO: Make this work with CRT enabled.
                cy.apiSaveCRTPreference(testUser.id, 'off');
            });

            cy.apiLogin(testSysadmin);

            // TODO: Make this work with CRT enabled.
            cy.apiSaveCRTPreference(testSysadmin.id, 'off');

            cy.apiCreateChannel(
                testTeam.id,
                'action-channel',
                'Action Channel',
                'O',
            ).then(({channel}) => {
                testChannel = channel;
            });
        });
    });

    describe('on join trigger', () => {
        it('channel categorization can be enabled and works', () => {
            // # Go to the test channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Open Channel Header and the Channel Actions modal
            cy.get('#channelHeaderTitle').click();
            cy.findByText('Channel Actions').click();

            // # Enable the categorization action and set the name
            cy.contains('sidebar category').click();
            cy.contains('Enter category name').click().type('example category{enter}');

            cy.get('#channel-actions-modal').within(() => {
                // # Save action
                cy.findByRole('button', {name: /save/i}).click();
            });

            // # Switch to another user and reload
            // # This drops them into the same channel
            cy.apiLogin(testUser);
            cy.reload();
            cy.wait(TIMEOUTS.TEN_SEC);

            // * Verify the channel category + channel exists
            cy.contains('.SidebarChannelGroup', 'example category', {matchCase: false}).
                should('exist').
                within(() => {
                    cy.contains(testChannel.display_name).should('exist');
                });
        });

        it('welcome message can be enabled and is shown to a joining user', () => {
            // # Go to the test channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Open Channel Header and the Channel Actions modal
            cy.get('#channelHeaderTitle').click();
            cy.findByText('Channel Actions').click();

            // # Toggle on and set the welcome message
            cy.contains('temporary welcome message').click();
            cy.findByTestId('channel-actions-modal_welcome-msg').
                type('test ephemeral welcome message');

            cy.get('#channel-actions-modal').within(() => {
                // # Save action
                cy.findByRole('button', {name: /save/i}).click();
            });

            // # Switch to another user and reload
            // # This drops them into the same channel
            cy.apiLogin(testUser);
            cy.reload();
            cy.wait(TIMEOUTS.FIVE_SEC);

            // * Verify the welcome message is shown
            cy.verifyEphemeralMessage('test ephemeral welcome message');
        });
    });

    describe('keyword trigger', () => {
        it('prompt to run playbook can be enabled and works', () => {
            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
            });

            // # Login as the non-sysadmin user first
            // # to do the channel & action creation.
            // # In the 'Select a playbook' dropdown later in this test,
            // # sysadmin users could potentially see many other playbooks
            // # besides the one created directly above. `testUser` will not.
            cy.apiLogin(testUser);
            cy.apiCreateChannel(
                testTeam.id,
                'action-channel',
                'Action Channel',
                'O',
            ).then(({channel}) => {
                // # Go to the test channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // # Open Channel Header and the Channel Actions modal
                cy.get('#channelHeaderTitle').click();
                cy.findByText('Channel Actions').click();

                // # Set a keyword, enable the playbook trigger,
                // # and select the Playbook to run
                cy.contains('Type a keyword or phrase, then press Enter on your keyboard').click().type('red alert{enter}');
                cy.contains('Prompt to run a playbook').click();
                cy.contains('Select a playbook').click();
                cy.findByText('Public Playbook').click();

                cy.get('#channel-actions-modal').within(() => {
                    // # Save action
                    cy.findByRole('button', {name: /save/i}).click();
                });

                // # Post the trigger phrase
                cy.uiPostMessageQuickly('error detected red alert!');

                // * Verify that the bot posts the expected prompt
                // # Open the playbook run modal
                cy.getLastPostId().then((postId) => {
                    cy.get(`#post_${postId}`).within(() => {
                        cy.contains('trigger for the Public Playbook').should('exist');
                        cy.contains('Yes, run playbook').should('exist').click();
                    });
                });

                // # Enter a name and start the run
                cy.findByTestId('playbookRunNameinput').type('run from trigger');
                cy.findByRole('button', {name: /start run/i}).click();

                // * Verify text from the run channel description
                cy.contains('start of the run').should('exist');
            });
        });

        it('deletes the post and ignores the thread when clicking on No, ignore thread', () => {
            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
            });

            // # Login as the non-sysadmin user first
            // # to do the channel & action creation.
            // # In the 'Select a playbook' dropdown later in this test,
            // # sysadmin users could potentially see many other playbooks
            // # besides the one created directly above. `testUser` will not.
            cy.apiLogin(testUser);
            cy.apiCreateChannel(
                testTeam.id,
                'action-channel',
                'Action Channel',
                'O',
            ).then(({channel}) => {
                // # Go to the test channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // # Open Channel Header and the Channel Actions modal
                cy.get('#channelHeaderTitle').click();
                cy.findByText('Channel Actions').click();

                // # Set a keyword, enable the playbook trigger,
                // # and select the Playbook to run
                cy.contains('Type a keyword or phrase, then press Enter on your keyboard').click().type('red alert{enter}');
                cy.contains('Prompt to run a playbook').click();
                cy.contains('Select a playbook').click();
                cy.findByText('Public Playbook').click();

                cy.get('#channel-actions-modal').within(() => {
                    // # Save action
                    cy.findByRole('button', {name: /save/i}).click();
                });

                // # Post the trigger phrase
                cy.uiPostMessageQuickly('error detected red alert!');

                // * Verify that the bot posts the expected prompt
                // # Click on No, ignore thread
                cy.getLastPostId().then((postId) => {
                    cy.get(`#post_${postId}`).within(() => {
                        cy.contains('trigger for the Public Playbook').should('exist');
                        cy.contains('No, ignore thread').should('exist').click();
                    });
                });

                // # Reload the channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // * Verify that the prompt post is no longer there
                cy.getLastPostId().then((postId) => {
                    cy.get(`#post_${postId}`).within(() => {
                        cy.contains('No, ignore thread').should('not.exist');
                    });
                });

                // # Reply to the last thread with the trigger phrase
                cy.getLastPostId().then((postId) => {
                    cy.clickPostCommentIcon(postId);
                    cy.postMessageReplyInRHS('error detected red alert!');
                });

                // * Verify that the bot did not post the prompt
                cy.getLastPostId().then((postId) => {
                    cy.get(`#post_${postId}`).within(() => {
                        cy.contains('trigger for the Public Playbook').should('not.exist');
                    });
                });
            });
        });

        it('disabled triggers do not run even with a keyword set', () => {
            // # Create a public playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Public Playbook',
                memberIDs: [],
            });

            // # Login as the non-sysadmin user first
            // # to do the channel & action creation.
            // # In the 'Select a playbook' dropdown later in this test,
            // # sysadmin users could potentially see many other playbooks
            // # besides the one created directly above. `testUser` will not.
            cy.apiLogin(testUser);
            cy.apiCreateChannel(
                testTeam.id,
                'action-channel',
                'Action Channel',
                'O',
            ).then(({channel}) => {
                // # Go to the test channel
                cy.visit(`/${testTeam.name}/channels/${channel.name}`);

                // # Open Channel Header and the Channel Actions modal
                cy.get('#channelHeaderTitle').click();
                cy.findByText('Channel Actions').click();

                // # Set a keyword, enable the playbook trigger,
                // # and select the playbook to run. Turn the
                // # trigger back off but leave the keyword set.
                cy.contains('Type a keyword or phrase, then press Enter on your keyboard').click().type('red alert{enter}');
                cy.contains('Prompt to run a playbook').click();
                cy.contains('Select a playbook').click();
                cy.findByText('Public Playbook').click();
                cy.contains('Prompt to run a playbook').click();

                cy.get('#channel-actions-modal').within(() => {
                    // # Save action
                    cy.findByRole('button', {name: /save/i}).click();
                });

                // # Post the trigger phrase
                cy.uiPostMessageQuickly('error detected red alert!');

                // * Verify that the bot _has not_ posted the expected prompt
                cy.getLastPostId().then((postId) => {
                    cy.get(`#post_${postId}`).within(() => {
                        cy.contains('trigger for the Public Playbook').should('not.exist');
                        cy.contains('Yes, run playbook').should('not.exist');
                    });
                });
            });
        });
    });

    it('action settings are disabled for non-channel admin', () => {
        // # Login as non-channel admin
        cy.apiLogin(testUser);

        // # Go to the test channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open Channel Header and the Channel Actions modal
        cy.get('#channelHeaderTitle').click();
        cy.findByText('Channel Actions').click();

        // * Verify the toggles are disabled
        cy.findByRole('dialog', {name: /channel actions/i}).within(() => {
            cy.get('input').should('be.disabled');
        });
    });

    it('action settings are reset to the default when switching to a channel with no actions configured', () => {
        // # Create an additional channel
        const name = 'New channel ' + Date.now();
        cy.apiCreateChannel(
            testTeam.id,
            'new-channel',
            name,
            'O',
        ).then(({channel}) => {
            // # Visit the first channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Open Channel Header and the Channel Actions modal
            cy.get('#channelHeaderTitle').click();
            cy.findByText('Channel Actions').click();

            // # Enable the categorization action and set the name
            const categoryName = 'example category ' + Date.now();
            cy.contains('sidebar category').click();
            cy.contains('Enter category name').click().type(categoryName + '{enter}');

            cy.get('#channel-actions-modal').within(() => {
                // # Save action
                cy.findByRole('button', {name: /save/i}).click();
            });

            // # wait to avoid MM-45969
            cy.wait(5000);

            // # Switch to the additional channel
            cy.get('#sidebarItem_' + channel.name).click();

            // # Open Channel Header and the Channel Actions modal
            cy.get('#channelHeaderTitle').click();
            cy.findByText('Channel Actions').click();

            // * Verify that the categorization action is disabled
            cy.findByText('Add the channel to a sidebar category for the user').parent().within(() => {
                cy.get('input').should('not.be.checked');
            });

            // * Verify that the category name is not there
            cy.findByText(categoryName).should('not.exist');
        });
    });
});
