// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

import * as TIMEOUTS from '../../../../fixtures/timeouts';

// assumes that E20 license is uploaded
describe('playbooks > edit', {testIsolation: true}, () => {
    let testTeam;
    let testSysadmin;
    let testUser;
    let testUser2;
    let testUser3;

    const openCategorySelector = () => {
        cy.get('.channel-selector__control input').click({force: true});
    };
    const selectCategory = (name) => {
        cy.get('.channel-selector__menu').findByText(name).click({force: true});
    };

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateCustomAdmin().then(({sysadmin}) => {
                testSysadmin = sysadmin;
            });

            // # Create a second test user in this team
            cy.apiCreateUser().then((payload) => {
                testUser2 = payload.user;
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
            });

            // # Create a third test user in this team
            cy.apiCreateUser().then((payload) => {
                testUser3 = payload.user;
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
            });
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    const commonActionTests = () => {
        describe('when a playbook run starts', () => {
            let testPlaybook;
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

            describe('create channel setting', () => {
                it('is enabled by default in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section.
                    cy.get('#actions').within(() => {
                        // * Verify that the toggle is checked
                        cy.get('#create-new-channel label input').should('be.checked');
                    });
                });
            });

            describe('invite members setting', () => {
                it('is disabled in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('#invite-users label input').should('not.be.checked');
                    });
                });

                it('can be enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#invite-users').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('be.checked');
                        });
                    });
                });

                it('does not let add users when disabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('#invite-users label input').should('not.be.checked');

                        // * Verify that the menu is disabled
                        cy.get('#invite-users').within(() => {
                            cy.getStyledComponent('StyledReactSelect').should(
                                'have.class',
                                'invite-users-selector--is-disabled',
                            );
                        });
                    });
                });

                it('allows adding users when enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#invite-users').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is checked
                            cy.get('label input').should('be.checked');

                            // # Open the invited users selector
                            cy.openSelector();

                            // # Add one user
                            cy.addInvitedUser(testUser2.username);
                            cy.wait(TIMEOUTS.ONE_SEC);

                            // * Verify that the badge in the selector shows the correct number of members
                            cy.get('.invite-users-selector__control').
                                after('content').
                                should('eq', '1 SELECTED');

                            // * Verify that the user shows in the group of invited members
                            cy.findByText('SELECTED').
                                parent().
                                within(() => {
                                    cy.findByText(testUser2.username);
                                });
                        });
                    });
                });

                it('allows adding new users to an already populated list', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#invite-users').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is checked
                            cy.get('label input').should('be.checked');

                            // # Open the invited users selector
                            cy.openSelector();

                            // # Add one user
                            cy.addInvitedUser(testUser2.username);

                            // * Verify that the user shows in the group of invited members
                            cy.findByText('SELECTED').
                                parent().
                                within(() => {
                                    cy.findByText(testUser2.username);
                                });

                            // # Add a new user
                            cy.addInvitedUser(testUser3.username);
                            cy.wait(TIMEOUTS.ONE_SEC);

                            cy.get('.invite-users-selector__control').
                                after('content').
                                should('eq', '2 SELECTED');

                            // * Verify that the user shows in the group of invited members
                            cy.findByText('SELECTED').
                                parent().
                                within(() => {
                                    cy.findByText(testUser2.username);
                                    cy.findByText(testUser3.username);
                                });
                        });
                    });
                });

                it('allows removing users', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#invite-users').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is checked
                            cy.get('label input').should('be.checked');

                            // # Open the invited users selector
                            cy.openSelector();

                            // # Add a couple of users
                            cy.addInvitedUser(testUser2.username);
                            cy.wait(TIMEOUTS.ONE_SEC);
                            cy.addInvitedUser(testUser3.username);
                            cy.wait(TIMEOUTS.ONE_SEC);

                            // * Verify that the badge in the selector shows the correct number of members
                            cy.get('.invite-users-selector__control').
                                after('content').
                                should('eq', '2 SELECTED');

                            // # Remove the first users added
                            cy.get('.invite-users-selector__option').
                                eq(0).
                                within(() => {
                                    cy.findByText('Remove').click();
                                });
                            cy.wait(TIMEOUTS.ONE_SEC);

                            // * Verify that there is only one user, the one not removed
                            cy.get('.invite-users-selector__control').
                                after('content').
                                should('eq', '1 SELECTED');

                            cy.findByText('SELECTED').
                                parent().
                                within(() => {
                                    cy.get('.invite-users-selector__option').
                                        should('have.length', 1).
                                        contains(testUser3.username);
                                });
                        });
                    });
                });

                it('persists the list of users even if the toggle is off', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#invite-users').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is checked
                            cy.get('label input').should('be.checked');

                            // # Open the invited users selector
                            cy.openSelector();

                            // # Add a couple of users
                            cy.addInvitedUser(testUser2.username);
                            cy.wait(TIMEOUTS.ONE_SEC);
                            cy.addInvitedUser(testUser3.username);
                            cy.wait(TIMEOUTS.ONE_SEC);

                            // * Verify that the badge in the selector shows the correct number of members
                            cy.get('.invite-users-selector__control').
                                after('content').
                                should('eq', '2 SELECTED');

                            // # Click on the toggle to disable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');
                        });
                    });

                    cy.reload();

                    cy.get('#actions').within(() => {
                        cy.get('#invite-users').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is checked
                            cy.get('label input').should('be.checked');

                            // * Verify that the badge in the selector shows the correct number of members
                            cy.get('.invite-users-selector__control').
                                after('content').
                                should('eq', '2 SELECTED');

                            // # Open the invited users selector
                            cy.openSelector();

                            // * Verify that the user shows in the group of invited members
                            cy.findByText('SELECTED').
                                parent().
                                within(() => {
                                    cy.findByText(testUser2.username);
                                    cy.findByText(testUser2.username);
                                });
                        });
                    });
                });

                describe('allow removing pre-assigned users with confirmation', () => {
                    beforeEach(() => {
                        // # Create a playbook
                        cy.apiCreateTestPlaybook({
                            teamId: testTeam.id,
                            title: 'Playbook (' + Date.now() + ')',
                            userId: testUser.id,
                            checklists: [{
                                title: 'Example',
                                items: [
                                    {
                                        title: 'Untitled task',
                                        assignee_id: testUser.id,
                                    },
                                ],
                            }],
                            invitedUserIds: [testUser.id],
                            inviteUsersEnabled: true,
                        }).then((playbook) => {
                            testPlaybook = playbook;
                        });
                    });

                    it('when removing an invited user', () => {
                        // # Visit the selected playbook
                        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                        cy.get('#checklists').within(() => {
                            // * Verify user is pre-assigned
                            cy.findByText('Untitled task').trigger('mouseover');
                            cy.findByTestId('hover-menu-edit-button').click();
                            cy.findByText(`@${testUser.username}`).should('exist');
                        });

                        cy.get('#actions').within(() => {
                            cy.get('#invite-users').within(() => {
                                // * Verify invitations enabled and user is invited
                                cy.get('label input').should('be.checked');
                                cy.get('.invite-users-selector__control').
                                    after('content').
                                    should('eq', '1 SELECTED');

                                cy.openSelector();

                                cy.get('.invite-users-selector__menu').within(() => {
                                    // # Trigger remove for pre-assigned user
                                    cy.findByText('Remove').click({force: true});
                                });
                            });
                        });

                        // * Verify that confirmation dialog is open
                        cy.get('#confirmModal').should('be.visible');

                        // * Verify that confirmation dialog contains correct text
                        cy.get('#confirmModal').should('contain', 'Are you sure you want to stop inviting this user as a member of the run?');

                        // * Verify that the confirmation button is focused and click
                        cy.focused().
                            should('have.id', 'confirmModalButton').
                            click({force: true});

                        // * Verify that the confirmation dialog is closed
                        cy.get('#confirmModal').should('not.exist');

                        cy.reload();

                        cy.get('#checklists').within(() => {
                            // * Verify that user is not pre-assigned anymore
                            cy.findByText('Untitled task').trigger('mouseover');
                            cy.findByTestId('hover-menu-edit-button').click();
                            cy.findByText('Assignee...').should('exist');
                        });

                        cy.get('#actions').within(() => {
                            cy.get('#invite-users').within(() => {
                                // * Verify that user is not invited anymore
                                cy.get('.invite-users-selector__control').
                                    after('content').
                                    should('eq', '');
                            });
                        });
                    });

                    it('when disabling invitations', () => {
                        // # Visit the selected playbook
                        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                        cy.get('#checklists').within(() => {
                            // * Verify user is pre-assigned
                            cy.findByText('Untitled task').trigger('mouseover');
                            cy.findByTestId('hover-menu-edit-button').click();
                            cy.findByText(`@${testUser.username}`).should('exist');
                        });

                        cy.get('#actions').within(() => {
                            cy.get('#invite-users').within(() => {
                                // * Verify invitations are enabled and user is invited
                                cy.get('label input').should('be.checked');
                                cy.get('.invite-users-selector__control').
                                    after('content').
                                    should('eq', '1 SELECTED');

                                // # Disable invitations
                                cy.get('label input').click({force: true});
                            });
                        });

                        // * Verify that confirmation dialog is open
                        cy.get('#confirmModal').should('be.visible');

                        // * Verify that confirmation dialog contains correct text
                        cy.get('#confirmModal').should('contain', 'Are you sure you want to disable invitations?');

                        // * Verify that the confirmation button is focused and click
                        cy.focused().
                            should('have.id', 'confirmModalButton').
                            click({force: true});

                        // * Verify that confirmation dialog is closed
                        cy.get('#confirmModal').should('not.exist');

                        cy.reload();

                        cy.get('#checklists').within(() => {
                            // * Verify that user is not pre-assigned
                            cy.findByText('Untitled task').trigger('mouseover');
                            cy.findByTestId('hover-menu-edit-button').click();
                            cy.findByText('Assignee...').should('exist');
                        });

                        cy.get('#actions').within(() => {
                            cy.get('#invite-users').within(() => {
                                // * Verify that invitations are disabled and no user is invited
                                cy.get('label input').should('not.be.checked');
                                cy.get('.invite-users-selector__control').
                                    after('content').
                                    should('eq', '');
                            });
                        });
                    });
                });
            });

            describe('assign owner setting', () => {
                it('is disabled in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('#assign-owner label input').should(
                            'not.be.checked',
                        );
                    });
                });

                it('can be enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#assign-owner').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is checked
                            cy.get('label input').should('be.checked');
                        });
                    });
                });

                it('does not allow adding an owner when disabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#assign-owner').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('input').should(
                                'not.be.checked',
                            );

                            // * Verify that the menu is disabled
                            cy.getStyledComponent('StyledReactSelect').should(
                                'have.class',
                                'assign-owner-selector--is-disabled',
                            );
                        });
                    });
                });

                it('allows adding users when enabled', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#assign-owner').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is checked
                            cy.get('label input').should('be.checked');

                            // # Open the owner selector
                            cy.openSelector();

                            // # Select a owner
                            cy.selectOwner(testUser2.username);

                            // * Verify that the control shows the selected owner
                            cy.get('.assign-owner-selector__control').contains(
                                testUser2.username,
                            );
                        });
                    });
                });

                it('allows changing the owner', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # select the actions section
                    cy.get('#actions').within(() => {
                        cy.get('#assign-owner').within(() => {
                            // * Verify that the toggle is unchecked
                            cy.get('label input').should('not.be.checked');

                            // # Click on the toggle to enable the setting
                            cy.get('label input').click({force: true});

                            // * Verify that the toggle is checked
                            cy.get('label input').should('be.checked');

                            // # Open the owner selector
                            cy.openSelector();

                            // # Select a owner
                            cy.selectOwner(testUser2.username);

                            // * Verify that the control shows the selected owner
                            cy.get('.assign-owner-selector__control').contains(
                                testUser2.username,
                            );

                            // # Open the owner selector
                            cy.get('.assign-owner-selector__control').click({
                                force: true,
                            });

                            // # Select a new owner
                            cy.selectOwner(testUser3.username);

                            // * Verify that the control shows the selected owner
                            cy.get('.assign-owner-selector__control').contains(
                                testUser3.username,
                            );
                        });
                    });
                });
            });
        });
    };

    describe('actions toggled', () => {
        let testPlaybook;

        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook (' + Date.now() + ')',
                userId: testUser.id,
            }).then((playbook) => {
                testPlaybook = playbook;
            });
        });

        commonActionTests();

        describe('link to an existing channel setting', () => {
            beforeEach(() => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            });

            it('can be checked', () => {
                // # select the action section.
                cy.get('#actions #link-existing-channel').within(() => {
                    // * Verify that the toggle is unchecked and input is disabled
                    cy.get('input[type=radio]').should('not.be.checked');
                    cy.get('input[type=text]').should('be.disabled');

                    // # click radio
                    cy.get('input[type=radio]').click();

                    // * Verify that the toggle is checked and input is enabled
                    cy.get('input[type=radio]').should('be.checked');
                    cy.get('input[type=text]').should('not.be.disabled');
                });
            });

            it('create channel choices are disabled when is checked', () => {
                // # select the action section.
                cy.get('#actions #link-existing-channel').within(() => {
                    // # click radio
                    cy.get('input[type=radio]').click();
                });

                // # select the action section.
                cy.get('#actions #create-new-channel').within(() => {
                    // * Verify that the toggle is unchecked and inputs are disabled
                    cy.get('input[type=radio]').eq(0).should('not.be.checked');
                    cy.get('label input[type=radio]').should('be.disabled');
                    cy.get('button').should('be.disabled');
                });
            });
        });
    });

    describe('actions', () => {
        let testPrivateChannel;
        let testPlaybook;

        before(() => {
            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public channel
            cy.apiCreateChannel(
                testTeam.id,
                'public-channel',
                'Public Channel',
                'O',
            );

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

        describe('when an update is posted', () => {
            describe('broadcast channel setting', () => {
                it('none configured in a new playbook', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    cy.get('#status-updates').within(() => {
                        cy.findByText('no channels').should('be.visible');
                    });
                });

                it('can change channel and edit is saved immediately', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    cy.get('#status-updates').within(() => {
                        cy.findByText('no channels').click();
                    });
                    cy.findByText(/off-topic/i).click();

                    cy.reload();

                    cy.get('#status-updates').within(() => {
                        cy.findByText('1 channel').should('be.visible');
                    });
                });

                it('persists selected channels when status update toggle is off', () => {
                    // # Visit the selected playbook
                    cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                    // # Add a channel and turn off the
                    // # status updates toggle
                    cy.get('#status-updates').within(() => {
                        cy.findByText('no channels').click();
                    });
                    cy.findByText(/off-topic/i).click();

                    // # Close the channel selector
                    cy.findByText(/search for a channel/i).type('{esc}');

                    cy.get('#status-updates').trigger('mouseenter').within(() => {
                        // # Click on the toggle to disable the setting
                        cy.get('label').click();

                        // * Verify that the toggle off
                        cy.get('label input').should('not.be.checked');
                    });

                    // * Verify disabled status updates text
                    cy.findByText(/status updates are not expected/i).should('exist');
                    cy.reload();

                    // # Turn the status update toggle back on
                    // * Verify there's still 1 channel selected
                    cy.get('#status-updates').trigger('mouseenter').within(() => {
                        cy.get('label').click();
                        cy.findByText('1 channel').should('be.visible');
                    });
                });

                it('removes the channel and disables the setting if the channel no longer exists', () => {
                    // # Create a playbook with a user that is later removed from the team
                    cy.apiLogin(testSysadmin).
                        then(() => {
                            const channelDisplayName = String(
                                'Channel to delete ' + Date.now(),
                            );
                            const channelName = channelDisplayName.
                                replace(/ /g, '-').
                                toLowerCase();
                            cy.apiCreateChannel(
                                testTeam.id,
                                channelName,
                                channelDisplayName,
                            ).then(({channel}) => {
                                // # Create a playbook with the channel to be deleted as the announcement channel
                                cy.apiCreatePlaybook({
                                    teamId: testTeam.id,
                                    title: 'Playbook (' + Date.now() + ')',
                                    createPublicPlaybookRun: true,
                                    memberIDs: [testUser.id, testSysadmin.id],
                                    announcementChannelId: channel.id,
                                    announcementChannelEnabled: true,
                                });

                                // # Delete channel
                                cy.apiDeleteChannel(channel.id);
                            });
                        }).
                        then(() => {
                            cy.apiLogin(testUser);

                            // # Navigate again to the playbook
                            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                            cy.get('#status-updates').within(() => {
                                cy.findByText('no channels').should('be.visible');
                            });
                        });
                });

                it('shows channel name when private broadcast channel configured and user is a member', () => {
                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/outline');

                    // * Verify no channel is selected
                    cy.findByTestId('status-update-broadcast-channels').should(
                        'have.text',
                        'no channels',
                    );

                    // # Open the broadcast channel widget
                    cy.findByTestId('status-update-broadcast-channels').click();

                    // # select a private channel
                    cy.get('#floating-ui-root').within(() => {
                        cy.get('input').type(`${testPrivateChannel.display_name}{enter}{esc}`);
                    });

                    // * Verify placeholder text is present
                    cy.findByTestId('status-update-broadcast-channels').should(
                        'have.text',
                        '1 channel',
                    );

                    // # Visit the selected playbook
                    cy.visit('/playbooks/playbooks/' + testPlaybook.id + '/outline');

                    // * Verify placeholder text is present
                    cy.findByTestId('status-update-broadcast-channels').should(
                        'have.text',
                        '1 channel',
                    );

                    // # Open the broadcast channel widget
                    cy.findByTestId('status-update-broadcast-channels').click();

                    // * Verify channel name displayed
                    cy.get('#floating-ui-root').within(() => {
                        cy.findByText(testPrivateChannel.display_name).should('be.visible');
                    });
                });
            });
        });

        describe('when a new member joins the channel', () => {
            beforeEach(() => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
                cy.findByTestId('playbook-channel-actions-button').click();
            });

            describe('add the channel to a sidebar category', () => {
                it('is disabled in a new playbook', () => {
                    cy.findByTestId('user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');
                    });
                });

                it('can be enabled', () => {
                    cy.findByTestId('user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label').eq(1).click();

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('be.checked');
                    });
                });

                it('prevents category selection when disabled', () => {
                    // * Verify that the toggle is unchecked
                    cy.findByTestId('user-joins-channel-categorize').within(() => {
                        cy.get('label input').should('not.be.checked');
                        cy.getStyledComponent('StyledCreatable').should('not.exist');
                    });
                });

                it('persists the category even if the toggle is off', () => {
                    cy.findByTestId('user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.getStyledComponent('Container').click();

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // # Open the channel selector
                        openCategorySelector();

                        // # Select a channel
                        selectCategory('Favorites');

                        // * Verify that the control shows the selected category
                        cy.get('.channel-selector__control').contains('Favorites');

                        // # Click on the toggle to disable the setting
                        cy.getStyledComponent('Container').click();

                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');
                    });
                    cy.findByTestId('modal-confirm-button').click();
                    cy.reload();

                    cy.findByTestId('playbook-channel-actions-button').click();

                    cy.findByTestId('user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.getStyledComponent('Container').click();

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // * Verify that the control still shows the selected category
                        cy.get('.channel-selector__control').contains('Favorites');
                    });
                });

                it('shows new category name when category was created', () => {
                    cy.findByTestId('user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is unchecked
                        cy.get('label input').should('not.be.checked');

                        // # Click on the toggle to enable the setting
                        cy.get('label').eq(1).click();

                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');
                    });

                    // # Type name to use new custom category
                    cy.get('.channel-selector__control').click().type('Custom category{enter}', {delay: 200});

                    // # click save modal
                    cy.findByTestId('modal-confirm-button').click();

                    // # reload to check that changes aren't local
                    cy.reload();

                    // # Open the channel modal
                    cy.findByTestId('playbook-channel-actions-button').click();

                    cy.findByTestId('user-joins-channel-categorize').within(() => {
                        // * Verify that the toggle is checked
                        cy.get('label input').should('be.checked');

                        // * Verify that the control still shows the new category
                        cy.get('.channel-selector__control').should(
                            'have.text',
                            'Custom category',
                        );
                    });
                });
            });
        });

        describe('status updates enable / disabled', () => {
            beforeEach(() => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            });

            it('is enabled in a new playbook', () => {
                // * Verify that the toggle is checked
                cy.get('#status-updates label input').should('be.checked');
            });

            it('can be disabled', () => {
                // * Verify that toggle can be disabled
                cy.get('#status-updates').within(() => {
                    // * Verify that the toggle is checked
                    cy.get('label input').should('be.checked');

                    // # Click on the toggle to enable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });

                // * Verify disabled status updates text
                cy.findByText(/status updates are not expected/i).should('be.visible');
                cy.reload();
                cy.findByText(/status updates are not expected/i).should('be.visible');
            });
        });

        describe('retrospective enable / disable', () => {
            beforeEach(() => {
                // # Login as testUser
                cy.apiLogin(testUser);

                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            });

            it('is enabled in a new playbook', () => {
                cy.get('#retrospective').within(() => {
                    // * Verify that the toggle is checked
                    cy.get('input[type=checkbox]').should('be.checked');
                });
            });

            it('can be disabled', () => {
                cy.get('#retrospective').within(() => {
                    // * Verify that the toggle is checked
                    cy.get('label input').should('be.checked');

                    // # Click on the toggle to disable the setting
                    cy.get('label input').click({force: true});

                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');

                    cy.findByText(/a retrospective is not expected/i).should('exist');
                });
            });

            it('saves on toggle', () => {
                cy.get('#retrospective').within(() => {
                    // # Uncheck toggle
                    cy.get('label input').click({force: true});
                });

                cy.reload();

                cy.get('#retrospective').within(() => {
                    // * Verify that the toggle is unchecked
                    cy.get('label input').should('not.be.checked');
                });
            });
        });
    });
});
