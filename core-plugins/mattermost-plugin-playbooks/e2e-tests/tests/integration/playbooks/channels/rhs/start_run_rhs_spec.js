// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FIVE_SEC} from '../../../../../tests/fixtures/timeouts';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('channels rhs > start a run', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        cy.apiCreateChannel(testTeam.id, 'existing-channel', 'Existing Channel').then(({channel}) => {
            testChannel = channel;
        });
    });

    const createPlaybook = ({channelNameTemplate, runSummaryTemplate, channelId, channelMode, title}) => {
        const runSummaryTemplateEnabled = Boolean(runSummaryTemplate);

        // # Create a public playbook
        return cy.apiCreatePlaybook({
            title: title || 'Public Playbook',
            channelNameTemplate,
            runSummaryTemplate,
            runSummaryTemplateEnabled,
            channelMode,
            channelId,
            teamId: testTeam.id,
            makePublic: true,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            cy.wrap(playbook);
        });
    };

    describe('From RHS run list  > ', () => {
        describe('playbook configured as create new channel', () => {
            // TBD: UI changes for Checklists feature - RHS workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('defaults', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then(() => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    cy.wait(FIVE_SEC);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # Create a blank checklist
                    cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();

                    // # Wait for checklist to be created and RHS to update to details view
                    cy.wait(2000);

                    // * Verify we're now in the RHS details view showing the new checklist
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.findByText('Untitled checklist').should('be.visible');
                        cy.findByText('Tasks').should('be.visible');
                    });
                });
            });

            // TBD: UI changes for Checklists feature - RHS workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('change title/summary', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    cy.wait(FIVE_SEC);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # First create a blank checklist so the header with dropdown appears
                    cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
                    cy.wait(1000); // Wait for checklist to be created and RHS to update

                    // # Now the header with dropdown should be visible, click the dropdown
                    cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

                    // # Click "Run a playbook" from the dropdown
                    cy.findByTestId('create-from-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert template are filled (and force wait to them)
                        cy.findByTestId('run-name-input').should('have.value', 'Channel template');

                        // * Assert summary template is filled
                        cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                        // # Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // # Fill run summary
                        cy.findByTestId('run-summary-input').clear().type('Test Run Summary');

                        // # Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // * Verify we are on the channel just created
                    cy.url().should('include', `/${testTeam.name}/channels/test-run-name`);

                    // * Verify channel name
                    cy.get('#channelHeaderTitle').contains('Test Run Name');

                    // * Verify run RHS
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.contains('Test Run Name');
                        cy.contains('Test Run Summary');
                    });
                });
            });

            // TBD: UI changes for Checklists feature - RHS workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('change to link to existing channel defaults to current channel', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then((playbook) => {
                    // # Visit the town square channel
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    cy.wait(FIVE_SEC);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # First create a blank checklist so the header with dropdown appears
                    cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
                    cy.wait(1000); // Wait for checklist to be created and RHS to update

                    // # Now the header with dropdown should be visible, click the dropdown
                    cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

                    // # Click "Run a playbook" from the dropdown
                    cy.findByTestId('create-from-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // # Change to link to existing channel
                        cy.findByTestId('link-existing-channel-radio').click();

                        // * Assert current channel is selected
                        cy.findByText('Town Square').should('be.visible');
                    });
                });
            });

            // TBD: UI changes for Checklists feature - RHS workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('change to link to existing channel with already selected channel', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                    channelId: testChannel.id,
                }).then((playbook) => {
                    // # Visit the town square channel
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    cy.wait(FIVE_SEC);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # First create a blank checklist so the header with dropdown appears
                    cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
                    cy.wait(1000); // Wait for checklist to be created and RHS to update

                    // # Now the header with dropdown should be visible, click the dropdown
                    cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

                    // # Click "Run a playbook" from the dropdown
                    cy.findByTestId('create-from-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // # Change to link to existing channel
                        cy.findByTestId('link-existing-channel-radio').click();

                        // * Assert selected channel is unchanged
                        cy.findByText(testChannel.display_name).should('be.visible');
                    });
                });
            });

            // TBD: UI changes for Checklists feature - RHS workflow has changed
            // eslint-disable-next-line no-only-tests/no-only-tests
            it.skip('change to link to existing channel', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    cy.wait(FIVE_SEC);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # First create a blank checklist so the header with dropdown appears
                    cy.get('#rhsContainer').findByTestId('create-blank-checklist').click();
                    cy.wait(1000); // Wait for checklist to be created and RHS to update

                    // # Now the header with dropdown should be visible, click the dropdown
                    cy.get('#rhsContainer').find('[data-testid="create-blank-checklist"]').parent().find('.icon-chevron-down').click();

                    // # Click "Run a playbook" from the dropdown
                    cy.findByTestId('create-from-playbook').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // # Change to link to existing channel
                        cy.findByTestId('link-existing-channel-radio').click();

                        // # Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // # Select test channel instead of current channel
                        cy.findByText('Town Square').click().type(`${testChannel.display_name}{enter}`);

                        // # Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // * Verify we are on the existing channel
                    cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

                    // * Verify channel name
                    cy.get('#channelHeaderTitle').contains(`${testChannel.display_name}`);

                    // * Verify run RHS
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.contains('Test Run Name');
                        cy.contains('run summary template');
                    });
                });
            });
        });
    });
});
