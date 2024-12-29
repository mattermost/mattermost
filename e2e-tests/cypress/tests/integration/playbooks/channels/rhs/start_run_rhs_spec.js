// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

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
        beforeEach(() => {
            // # intercepts telemetry
            cy.interceptTelemetry();
        });

        describe('playbook configured as create new channel', () => {
            it('defaults', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # Click start a run button
                    cy.findByTestId('rhs-runlist-start-run').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert template name is filled
                        cy.findByTestId('run-name-input').should('have.value', 'Channel template');

                        // * Assert summary template is filled
                        cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                        // # Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // * Assert telemetry data
                    cy.expectTelemetryToContain([{
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'channels_rhs_runlist',
                            playbookId: playbook.id,
                            channelMode: 'create_new_channel',
                            public: true,
                            hasPlaybookChanged: true,
                            hasNameChanged: false,
                            hasSummaryChanged: false,
                            hasChannelModeChanged: false,
                            hasChannelIdChanged: false,
                            hasPublicChanged: false,
                        }},
                    ], {waitForCalls: 2});

                    // * Verify we are on the channel just created
                    cy.url().should('include', `/${testTeam.name}/channels/channel-template`);

                    // * Verify channel name
                    cy.get('h2').contains('Beginning of Channel template');

                    // * Verify run RHS
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.contains('Channel template');
                        cy.contains('run summary template');
                    });
                });
            });

            it('change title/summary', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # Click start a run button
                    cy.findByTestId('rhs-runlist-start-run').click();

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

                    // * Assert telemetry data
                    cy.expectTelemetryToContain([{
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'channels_rhs_runlist',
                            playbookId: playbook.id,
                            channelMode: 'create_new_channel',
                            public: true,
                            hasPlaybookChanged: true,
                            hasNameChanged: true,
                            hasSummaryChanged: true,
                            hasChannelModeChanged: false,
                            hasChannelIdChanged: false,
                            hasPublicChanged: false,
                        }},
                    ]);

                    // * Verify we are on the channel just created
                    cy.url().should('include', `/${testTeam.name}/channels/test-run-name`);

                    // * Verify channel name
                    cy.get('h2').contains('Beginning of Test Run Name');

                    // * Verify run RHS
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.contains('Test Run Name');
                        cy.contains('Test Run Summary');
                    });
                });
            });

            it('change to link to existing channel defaults to current channel', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then((playbook) => {
                    // # Visit the town square channel
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # Click start a run button
                    cy.findByTestId('rhs-runlist-start-run').click();

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

            it('change to link to existing channel with already selected channel', () => {
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

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # Click start a run button
                    cy.findByTestId('rhs-runlist-start-run').click();

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

            it('change to link to existing channel', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'create_new_channel',
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # Click start a run button
                    cy.findByTestId('rhs-runlist-start-run').click();

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

                    // * Assert telemetry data
                    cy.expectTelemetryToContain([{
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'channels_rhs_runlist',
                            playbookId: playbook.id,
                            channelMode: 'link_existing_channel',
                            hasPlaybookChanged: true,
                            hasNameChanged: true,
                            hasSummaryChanged: false,
                            hasChannelModeChanged: true,
                            hasChannelIdChanged: true,
                            hasPublicChanged: false,
                        }},
                    ]);

                    // * Verify we are on the existing channel
                    cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

                    // * Verify channel name
                    cy.get('h2').contains(`Beginning of ${testChannel.display_name}`);

                    // * Verify run RHS
                    cy.get('#rhsContainer').should('exist').within(() => {
                        cy.contains('Test Run Name');
                        cy.contains('run summary template');
                    });
                });
            });
        });

        describe('playbook configured as linked to existing channel', () => {
            it('defaults', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'link_existing_channel',
                    channelId: testChannel.id,
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # Click start a run button
                    cy.findByTestId('rhs-runlist-start-run').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert template name is empty
                        cy.findByTestId('run-name-input').should('be.empty');

                        // * Assert template summary is filled
                        cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                        // # Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // # Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // * Assert telemetry data
                    cy.expectTelemetryToContain([{
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'channels_rhs_runlist',
                            playbookId: playbook.id,
                            channelMode: 'link_existing_channel',
                            hasPlaybookChanged: true,
                            hasNameChanged: true,
                            hasSummaryChanged: false,
                            hasChannelModeChanged: false,
                            hasChannelIdChanged: false,
                            hasPublicChanged: false,
                        }},
                    ]);

                    // * Verify we are on the existing channel
                    cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

                    // * Verify channel name
                    cy.get('h2').contains(`Beginning of ${testChannel.display_name}`);

                    cy.get('#rhsContainer').should('exist').within(() => {
                        // * Verify run RHS
                        cy.contains('Test Run Name');
                        cy.contains('run summary template');
                    });
                });
            });

            it('fill initially empty channel', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'link_existing_channel',
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # Click start a run button
                    cy.findByTestId('rhs-runlist-start-run').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert template name is empty
                        cy.findByTestId('run-name-input').should('be.empty');

                        // * Assert template summary is filled
                        cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                        // # Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // # Fill Town square as the channel to be linked
                        cy.findByText('Select a channel').click().type(`${testChannel.display_name}{enter}`);

                        // # Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // * Assert telemetry data
                    cy.expectTelemetryToContain([{
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'channels_rhs_runlist',
                            playbookId: playbook.id,
                            channelMode: 'link_existing_channel',
                            hasPlaybookChanged: true,
                            hasNameChanged: true,
                            hasSummaryChanged: false,
                            hasChannelModeChanged: false,
                            hasChannelIdChanged: true,
                            hasPublicChanged: false,
                        }},
                    ]);

                    // * Verify we are on the existing channel
                    cy.url().should('include', `/${testTeam.name}/channels/${testChannel.name}`);

                    // * Verify channel name
                    cy.get('h2').contains(`Beginning of ${testChannel.display_name}`);

                    cy.get('#rhsContainer').should('exist').within(() => {
                        // * Verify run RHS
                        cy.contains('Test Run Name');
                        cy.contains('run summary template');
                    });
                });
            });

            it('change to create new channel', () => {
                // # Fill default values
                createPlaybook({
                    title: 'Playbook title' + Date.now(),
                    channelNameTemplate: 'Channel template',
                    runSummaryTemplate: 'run summary template',
                    channelMode: 'link_existing_channel',
                    channelId: testChannel.id,
                }).then((playbook) => {
                    // # Visit the selected playbook
                    cy.visit(`/${testTeam.name}/channels/town-square`);

                    // # Open playbooks RHS.
                    cy.getPlaybooksAppBarIcon().should('be.visible').click();

                    // # Click start a run button
                    cy.findByTestId('rhs-runlist-start-run').click();

                    cy.get('#root-portal.modal-open').within(() => {
                        // # Wait the modal to render
                        cy.wait(500);

                        // * Assert we are at playbooks tab
                        cy.findByText('Select a playbook').should('be.visible');

                        // # Click on the playbook
                        cy.findAllByText(playbook.title).eq(0).click();

                        // # Wait the modal to render
                        cy.wait(500);

                        // # Change to create new channel
                        cy.findByTestId('create-channel-radio').click();

                        // # Fill run name
                        cy.findByTestId('run-name-input').clear().type('Test Run Name');

                        // # Click start button
                        cy.findByTestId('modal-confirm-button').click();
                    });

                    // * Assert telemetry data
                    cy.expectTelemetryToContain([{
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'channels_rhs_runlist',
                            playbookId: playbook.id,
                            channelMode: 'create_new_channel',
                            hasPlaybookChanged: true,
                            hasNameChanged: true,
                            hasSummaryChanged: false,
                            hasChannelModeChanged: true,
                            hasChannelIdChanged: false,
                            hasPublicChanged: false,
                        }},
                    ]);

                    // * Verify we are on the channel just created
                    cy.url().should('include', `/${testTeam.name}/channels/test-run-name`);

                    // * Verify channel name
                    cy.get('h2').contains('Beginning of Test Run Name');

                    cy.get('#rhsContainer').should('exist').within(() => {
                        // * Verify run RHS
                        cy.contains('Test Run Name');
                        cy.contains('run summary template');
                    });
                });
            });
        });
    });
});
