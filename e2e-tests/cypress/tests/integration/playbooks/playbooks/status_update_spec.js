// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > edit status update', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Login as testUser
            cy.apiLogin(testUser);

            // # Create a public channel
            cy.apiCreateChannel(
                testTeam.id,
                'public-channel',
                'Public Channel',
                'O',
            ).then(({channel}) => {
                testChannel = channel;
            });
        });
    });

    beforeEach(() => {
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

        // # Set a bigger viewport so the action don't scroll out of view
        cy.viewport('macbook-16');
    });

    describe('status update enable/disable', () => {
        it('can enable/disable status update', () => {
            // # Visit the selected playbook outline tab
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // * Verify status update message
            cy.findAllByTestId('status-update-section').should('exist').within(() => {
                cy.contains('A status update is expected every');
                cy.contains('1 day');
                cy.contains('no channels');
                cy.contains('no outgoing webhooks');
            });

            // # Disable status update
            cy.findAllByTestId('status-update-toggle').eq(0).click();

            // * Verify status update message
            cy.findAllByTestId('status-update-section').should('exist').within(() => {
                cy.contains('Status updates are not expected.');
                cy.contains('A status update is expected every').should('not.exist');
            });
        });
    });

    describe('edit channels and webhooks', () => {
        it('can enable/disable status update', () => {
            // # Visit the selected playbook outline tab
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Select a channel
            cy.findAllByTestId('status-update-broadcast-channels').click();
            cy.get('#playbook-automation-broadcast').contains('Town Square').click({force: true});
            cy.findAllByTestId('status-update-broadcast-channels').click();

            // # Refresh the page
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Add webhooks
            cy.findAllByTestId('status-update-webhooks').click();
            cy.findAllByTestId('webhooks-input').type('http://hook1.com{enter}http://hook2.com{enter}http://hook3.com{enter}');
            cy.findAllByTestId('checklist-item-save-button').click();

            // # Refresh the page
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // * Verify status update message
            cy.findAllByTestId('status-update-section').should('exist').within(() => {
                cy.contains('1 channel');
                cy.contains('3 outgoing webhooks');
            });

            // # Disable status update
            cy.findAllByTestId('status-update-toggle').eq(0).click();

            // * Verify status update message
            cy.get('#status-updates').within(() => {
                cy.findByText('Status updates are not expected.').should('exist');
            });

            // # Re-enable status update
            cy.findAllByTestId('status-update-toggle').eq(0).click();

            // # Refresh the page
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // * Verify that channels and webhooks persist
            cy.get('#status-updates').within(() => {
                cy.contains('1 channel').should('exist');
                cy.contains('3 outgoing webhooks').should('exist');
            });
        });
    });

    describe('status enabled, broadcasts disabled, but channels and webhooks specified', () => {
        it('can enable/disable status update', () => {
            const broadcastChannelIds = [testChannel.id];
            const webhookOnStatusUpdateURLs = ['https://one.com', 'https://two.com'];

            // # Create a playbook
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook #### (' + Date.now() + ')',
                userId: testUser.id,
                broadcastChannelIds,
                webhookOnStatusUpdateURLs,
            }).then((playbook) => {
                // # Visit the selected playbook outline tab
                cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

                // * Verify status update message. Status update should be enabled, but message should say `updates will be posted to no channels and no outgoing webhooks`
                cy.findAllByTestId('status-update-section').should('exist').within(() => {
                    cy.contains('A status update is expected every');
                    cy.contains('no channels');
                    cy.contains('no outgoing webhooks');
                });

                // * Verify selected channels style
                cy.findAllByTestId('status-update-broadcast-channels').click();
                cy.get('.playbook-react-select__option').contains('Public Channel').
                    invoke('css', 'text-decoration').
                    should('equal', 'line-through solid rgba(63, 67, 80, 0.48)');

                // # Close select options
                cy.findAllByTestId('status-update-broadcast-channels').click();

                // # Open webhooks text area
                cy.findAllByTestId('status-update-webhooks').click();

                // * Verify webhooks text style
                cy.findAllByTestId('webhooks-input').
                    invoke('css', 'text-decoration').
                    should('equal', 'line-through solid rgba(63, 67, 80, 0.48)');

                // # Edit webhooks
                cy.findAllByTestId('webhooks-input').type('http://hook1.com{enter}http://hook2.com{enter}http://hook3.com{enter}');
                cy.findAllByTestId('checklist-item-save-button').click();

                // # Select a channel
                cy.findAllByTestId('status-update-broadcast-channels').click();
                cy.get('#playbook-automation-broadcast').contains('Town Square').click({force: true});
                cy.findAllByTestId('status-update-broadcast-channels').click();

                // * Verify status update message.
                cy.findAllByTestId('status-update-section').should('exist').within(() => {
                    cy.contains('A status update is expected every');
                    cy.contains('2 channels');
                    cy.contains('4 outgoing webhooks');
                });

                // # Refresh the page
                cy.visit(`/playbooks/playbooks/${playbook.id}/outline`);

                // * Verify status update message.
                cy.findAllByTestId('status-update-section').should('exist').within(() => {
                    cy.contains('A status update is expected every');
                    cy.contains('2 channels');
                    cy.contains('4 outgoing webhooks');
                });
            });
        });
    });
});
