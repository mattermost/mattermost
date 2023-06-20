// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

const RUN_NAME_MAX_LENGTH = 64;

describe('playbooks > start a run', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # intercepts telemetry
        cy.interceptTelemetry();

        // # Login as testUser
        cy.apiLogin(testUser);

        // # Create a public playbook
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Public Playbook',
            makePublic: true,
            memberIDs: [testUser.id],
            createPublicPlaybookRun: true,
        }).then((playbook) => {
            testPlaybook = playbook;
        });
    });

    // This data is intentionally changed here instead of via api
    const fillPBE = ({name, summary, channelMode, channelNameToLink, defaultOwnerEnabled}) => {
        // # fill channel name temaplte
        if (name) {
            cy.get('#create-new-channel input[type="text"]').clear().type('Channel template');
        }

        // # fill summary template
        if (summary) {
            cy.contains('run summary template').dblclick();
            cy.focused().type('run summary template');
            cy.findByRole('button', {name: /save/i}).click();
        }
        if (channelMode === 'create_new_channel') {
            cy.get('#create-new-channel input[type="radio"]').eq(0).click();
        } else if (channelMode === 'link_to_existing_channel') {
            cy.get('#link-existing-channel input[type="radio"]').click();
        }

        if (channelNameToLink) {
            cy.get('#link-existing-channel').within(() => {
                cy.findByText('Select a channel').click().type(`${channelNameToLink}{enter}`);
            });
        }

        if (defaultOwnerEnabled) {
            cy.get('#assign-owner').within(() => {
                // * Verify that the toggle is unchecked
                cy.get('label input').should('not.be.checked');

                // # Click on the toggle to enable the setting
                cy.get('label input').click({force: true});

                // * Verify that the toggle is checked
                cy.get('label input').should('be.checked');
            });
        }
    };
    describe('from playbook list', () => {
        it('defaults', () => {
            // # Visit playbook list
            cy.visit('/playbooks/playbooks');

            // # Click "Run" button on the first playbook
            cy.findAllByTestId('playbook-item').first().within(() => {
                cy.findByText('Run').click();
            });

            cy.get('#root-portal.modal-open').within(() => {
                // # Wait the modal to render
                cy.wait(500);

                // * Assert template name is filled
                cy.findByTestId('run-name-input').clear().type('Run name');

                // # Click start button
                cy.findByTestId('modal-confirm-button').click();
            });

            // * Assert telemetry data
            cy.expectTelemetryToContain([
                {
                    name: 'playbookrun_create',
                    type: 'track',
                    properties: {
                        place: 'backstage_playbook_list',
                        playbookId: testPlaybook.id,
                        channelMode: 'create_new_channel',
                        hasPlaybookChanged: false,
                        hasNameChanged: true,
                        hasSummaryChanged: false,
                        hasChannelModeChanged: false,
                        hasChannelIdChanged: false,
                        hasPublicChanged: false,
                    },
                },
            ]);

            // * Verify we are on RDP
            cy.url().should('include', '/playbooks/runs/');
            cy.url().should('include', '?from=run_modal');

            // * Verify run name
            cy.get('h1').contains('Run name');
        });
    });

    describe('from playbook editor', () => {
        describe('pbe configured as create new channel', () => {
            it('defaults', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // Fill default values
                fillPBE({name: 'Channel template', summary: 'run summary template', channelMode: 'create_new_channel', defaultOwnerEnabled: true});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Wait the modal to render
                    cy.wait(500);

                    // * Assert template name is filled
                    cy.findByTestId('run-name-input').should('have.value', 'Channel template');

                    // * Assert template summary is filled
                    cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Assert telemetry data
                cy.expectTelemetryToContain([
                    {
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'backstage_playbook_editor',
                            playbookId: testPlaybook.id,
                            channelMode: 'create_new_channel',
                            hasPlaybookChanged: false,
                            hasNameChanged: false,
                            hasSummaryChanged: false,
                            hasChannelModeChanged: false,
                            hasChannelIdChanged: false,
                            hasPublicChanged: false,
                        },
                    },
                ]);

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Channel template');

                // * Verify run summary
                cy.findByTestId('run-summary-section').contains('run summary template');
            });

            it('change title/summary', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Fill default values
                fillPBE({name: 'Channel template', summary: 'run summary template', channelMode: 'create_new_channel'});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Wait the modal to render
                    cy.wait(500);

                    // * Assert template are filled (and force wait to them)
                    cy.findByTestId('run-name-input').should('have.value', 'Channel template');
                    cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // # Fill run summary
                    cy.findByTestId('run-summary-input').clear().type('Test Run Summary');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Assert telemetry data
                cy.expectTelemetryToContain([
                    {
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'backstage_playbook_editor',
                            playbookId: testPlaybook.id,
                            channelMode: 'create_new_channel',
                            hasPlaybookChanged: false,
                            hasNameChanged: true,
                            hasSummaryChanged: true,
                            hasChannelModeChanged: false,
                            hasChannelIdChanged: false,
                            hasPublicChanged: false,
                        },
                    },
                ]);

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Test Run Name');

                // * Verify run summary
                cy.findByTestId('run-summary-section').contains('Test Run Summary');
            });

            it('change to link to existing channel does not default to current channel', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Fill default values
                fillPBE({name: 'Channel template', summary: 'run summary template', channelMode: 'create_new_channel', defaultOwnerEnabled: true});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Wait the modal to render
                    cy.wait(500);

                    // # Change to link to existing channel
                    cy.findByTestId('link-existing-channel-radio').click();

                    // * Assert selected channel is unchanged
                    cy.findByText('Select a channel').should('be.visible');
                });
            });

            it('change to link to existing channel', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Fill default values
                fillPBE({name: 'Channel template', summary: 'run summary template', channelMode: 'create_new_channel', defaultOwnerEnabled: true});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Wait the modal to render
                    cy.wait(500);

                    // # Change to link to existing channel
                    cy.findByTestId('link-existing-channel-radio').click();

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // * Assert cta is disabled
                    cy.findByTestId('modal-confirm-button').should('be.disabled');

                    // # Fill Town square as the channel to be linked
                    cy.findByText('Select a channel').click().type('Town{enter}');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Assert telemetry data
                cy.expectTelemetryToContain([
                    {
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'backstage_playbook_editor',
                            playbookId: testPlaybook.id,
                            channelMode: 'link_existing_channel',
                            hasPlaybookChanged: false,
                            hasNameChanged: true,
                            hasSummaryChanged: false,
                            hasChannelModeChanged: true,
                            hasChannelIdChanged: true,
                            hasPublicChanged: false,
                        },
                    },
                ]);

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Test Run Name');

                // # Click channel link
                cy.findByTestId('runinfo-channel-link').click();

                // * Verify we are on town square
                cy.url().should('include', `/${testTeam.name}/channels/town-square`);
            });
        });

        describe('pbe configured as linked to existing channel', () => {
            it('defaults', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Fill default values
                fillPBE({summary: 'run summary template', channelMode: 'link_to_existing_channel', channelNameToLink: 'Town'});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Wait the modal to render
                    cy.wait(500);

                    // * Assert template name is empty
                    cy.findByTestId('run-name-input').should('be.empty');

                    // * Assert template summary is filled
                    cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                    // * Assert button is still disabled
                    cy.findByTestId('modal-confirm-button').should('be.disabled');

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Assert telemetry data
                cy.expectTelemetryToContain([
                    {
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'backstage_playbook_editor',
                            playbookId: testPlaybook.id,
                            channelMode: 'link_existing_channel',
                            hasPlaybookChanged: false,
                            hasNameChanged: true,
                            hasSummaryChanged: false,
                            hasChannelModeChanged: false,
                            hasChannelIdChanged: false,
                            hasPublicChanged: false,
                        },
                    },
                ]);

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Test Run Name');

                // * Verify run summary
                cy.findByTestId('run-summary-section').contains('run summary template');

                // # Click channel link
                cy.findByTestId('runinfo-channel-link').click();

                // * Verify we are on town square
                cy.url().should('include', `/${testTeam.name}/channels/town-square`);
            });

            it('fill initially empty channel', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // # Fill default values
                fillPBE({summary: 'run summary template', channelMode: 'link_to_existing_channel'});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Wait the modal to render
                    cy.wait(500);

                    // * Assert template name is empty
                    cy.findByTestId('run-name-input').should('be.empty');

                    // * Assert template summary is filled
                    cy.findByTestId('run-summary-input').should('have.value', 'run summary template');

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // * Assert button is still disabled
                    cy.findByTestId('modal-confirm-button').should('be.disabled');

                    // # Fill Town square as the channel to be linked
                    cy.findByText('Select a channel').click().type('Town{enter}');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Assert telemetry data
                cy.expectTelemetryToContain([
                    {
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'backstage_playbook_editor',
                            playbookId: testPlaybook.id,
                            channelMode: 'link_existing_channel',
                            hasPlaybookChanged: false,
                            hasNameChanged: true,
                            hasSummaryChanged: false,
                            hasChannelModeChanged: false,
                            hasChannelIdChanged: true,
                            hasPublicChanged: false,
                        },
                    },
                ]);

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Test Run Name');

                // * Verify run summary
                cy.findByTestId('run-summary-section').contains('run summary template');

                // # Click channel link
                cy.findByTestId('runinfo-channel-link').click();

                // * Verify we are on town square
                cy.url().should('include', `/${testTeam.name}/channels/town-square`);
            });

            it('change to create new channel', () => {
                // # Visit the selected playbook
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

                // Fill default values
                fillPBE({name: 'Channel template', summary: 'run summary template', channelMode: 'link_to_existing_channel', channelNameToLink: 'Town'});

                // # Click start a run button
                cy.findByTestId('run-playbook').click();

                cy.get('#root-portal.modal-open').within(() => {
                    // # Wait the modal to render
                    cy.wait(500);

                    // * Change to create new channel
                    cy.findByTestId('create-channel-radio').click();

                    // # Fill run name
                    cy.findByTestId('run-name-input').clear().type('Test Run Name');

                    // # Click start button
                    cy.findByTestId('modal-confirm-button').click();
                });

                // * Assert telemetry data
                cy.expectTelemetryToContain([
                    {
                        name: 'playbookrun_create',
                        type: 'track',
                        properties: {
                            place: 'backstage_playbook_editor',
                            playbookId: testPlaybook.id,
                            channelMode: 'create_new_channel',
                            hasPlaybookChanged: false,
                            hasNameChanged: true,
                            hasSummaryChanged: false,
                            hasChannelModeChanged: true,
                            hasChannelIdChanged: false,
                            hasPublicChanged: false,
                        },
                    },
                ]);

                // * Verify we are on RDP
                cy.url().should('include', '/playbooks/runs/');
                cy.url().should('include', '?from=run_modal');

                // * Verify run name
                cy.get('h1').contains('Test Run Name');

                // # Click channel link
                cy.findByTestId('runinfo-channel-link').click();

                // * Verify we are on channel Test Run Name
                cy.url().should('include', `/${testTeam.name}/channels/test-run-name`);
            });
        });
    });

    describe('start run modal > invalid user input', () => {
        it('submit button is disabled when run name is empty', () => {
            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Click start a run button
            cy.findByTestId('run-playbook').click();

            cy.get('#root-portal.modal-open').within(() => {
                // # Wait the modal to render
                cy.wait(500);

                // * Assert template name is empty
                cy.findByTestId('run-name-input').should('have.value', '');

                // * Assert start button is disabled
                cy.findByTestId('modal-confirm-button').should('have.attr', 'disabled');
            });
        });

        it('error is shown when maximum length of run name is exceeded', () => {
            // # Visit the selected playbook
            cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);

            // # Click start a run button
            cy.findByTestId('run-playbook').click();

            cy.get('#root-portal.modal-open').within(() => {
                // # Wait the modal to render
                cy.wait(500);

                // * Assert template name is empty
                cy.findByTestId('run-name-input').should('have.value', '');

                // # Type run name that exceeds maximum length
                cy.findByTestId('run-name-input').type('a'.repeat(RUN_NAME_MAX_LENGTH + 1));

                // * Assert error shown and contains maximum length in message
                cy.findByTestId('run-name-error').should('contain', RUN_NAME_MAX_LENGTH);

                // * Assert start button is disabled
                cy.findByTestId('modal-confirm-button').should('have.attr', 'disabled');

                // # Delete last character via backspace
                cy.findByTestId('run-name-input').type('{backspace}');

                // * Assert that error is not shown anymore
                cy.findByTestId('run-name-error').should('not.exist');
            });
        });
    });
});
