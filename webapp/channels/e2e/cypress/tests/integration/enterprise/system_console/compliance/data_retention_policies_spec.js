// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @enterprise @system_console @with_feature_flag

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Data Retention', () => {
    let testTeam;
    let testChannel;

    before(() => {
        cy.apiRequireLicenseForFeature('DataRetention');

        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;
        });
    });

    beforeEach(() => {
        cy.apiDeleteAllCustomRetentionPolicies();
        cy.intercept({
            method: 'POST',
            url: '/api/v4/data_retention/policies',
        }).as('createCustomPolicy');

        // # Go to data retention settings page
        cy.uiGoToDataRetentionPage();
    });

    describe('Custom policy creation', () => {
        it('MM-T4005 - Create custom policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 1', 'days', '60');

            // # Add team to the policy
            cy.uiAddTeamsToCustomPolicy([testTeam.display_name]);

            // # Add 1 channel to the policy from the modal
            cy.uiAddRandomChannelToCustomPolicy(1);

            // # Save policy
            cy.uiGetButton('Save').click();

            // * Check custom policy table is visible
            cy.get('#custom_policy_table .DataGrid').should('be.visible');

            cy.wait('@createCustomPolicy').then((interception) => {
                // * Verify create policy response
                cy.uiVerifyPolicyResponse(interception.response.body, 1, 1, 60, 'Policy 1');
                cy.get('#custom_policy_table .DataGrid').within(() => {
                    // * Verify custom policy data table
                    cy.uiVerifyCustomPolicyRow(interception.response.body.id, 'Policy 1', '60 days', '1 team, 1 channel');
                });
            });
        });

        it('MM-T4006 - Policies count', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 1', 'days', '60');

            // # Add channel to the policy
            cy.uiAddRandomChannelToCustomPolicy();

            // # Save policy
            cy.uiGetButton('Save').click();

            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 2', 'days', '160');

            // # Add channel to the policy
            cy.uiAddRandomChannelToCustomPolicy();

            // # Save policy
            cy.uiGetButton('Save').click();

            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 3', 'days', '100');

            // # Add channel to the policy
            cy.uiAddRandomChannelToCustomPolicy();

            // # Save policy
            cy.uiGetButton('Save').click();

            // * Assert the pagination is correct
            cy.findByText('1 - 3 of 3').scrollIntoView().should('be.visible');

            cy.apiGetCustomRetentionPolicies().then((result) => {
                // * Assert the total policy count is 3
                expect(result.body.total_count).to.equal(3);
            });
        });

        it('MM-T4007 - show policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 1', 'days', '60');

            // # Add team to the policy
            cy.uiAddTeamsToCustomPolicy([testTeam.display_name]);

            // # Add 1 channel to the policy from the modal
            cy.uiAddRandomChannelToCustomPolicy(1);

            // # Save policy
            cy.uiGetButton('Save').click();
            cy.findByText('1 - 1 of 1').scrollIntoView().should('be.visible');
        });

        it('MM-T4008 - Update custom policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 2', 'years', '2');

            // # Add team to the policy
            cy.uiAddRandomTeamToCustomPolicy();

            // # Save policy
            cy.uiGetButton('Save').click();

            // * Check custom policy table is visible
            cy.get('#custom_policy_table .DataGrid').should('be.visible');

            cy.wait('@createCustomPolicy').then((interception) => {
                // * Verify create policy api response
                cy.uiVerifyPolicyResponse(interception.response.body, 1, 0, 730, 'Policy 2');
                const policyId = interception.response.body.id;

                cy.get('#custom_policy_table .DataGrid').within(() => {
                    // * Verify custom policy data table
                    cy.uiVerifyCustomPolicyRow(policyId, 'Policy 2', '2 years', '1 team, 0 channels');

                    // # Go to edit custom data retention page
                    cy.uiClickEditCustomPolicyRow(policyId);
                });

                // * Verify custom policy page header
                cy.get('.DataRetentionSettings .admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').invoke('text').should('include', 'Custom Retention Policy');

                // # Remove team from policy
                cy.get('.PolicyTeamsList .DataGrid').within(() => {
                    cy.findByRole('link', {name: 'Remove'}).should('be.visible').click();
                });

                // # Add channel to the policy
                cy.uiAddRandomChannelToCustomPolicy();

                // # Save policy
                cy.uiGetButton('Save').click();

                // * Check custom policy table is visible
                cy.get('#custom_policy_table .DataGrid').should('be.visible');

                // * Verify custom policy data table
                cy.get('#custom_policy_table .DataGrid').within(() => {
                    cy.uiVerifyCustomPolicyRow(policyId, 'Policy 2', '2 years', '0 teams, 1 channel');
                });

                // # Send GET request to verify policy updated correctly
                cy.apiGetCustomRetentionPolicy(policyId).then((result) => {
                    // * Assert response body team_count is 0
                    expect(result.body.team_count).to.equal(0);

                    // * Assert response body channel_count is 1
                    expect(result.body.channel_count).to.equal(1);

                    // * Assert response body post_duration is 730
                    expect(result.body.post_duration).to.equal(730);

                    // * Assert response body display_name is correct
                    expect(result.body.display_name).to.equal('Policy 2');
                });
            });
        });

        it('MM-T4009 - Delete a custom policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Add policy name
            cy.uiGetTextbox('Policy name').clear().type('Policy 3');

            // # Add channel to the policy
            cy.uiAddRandomChannelToCustomPolicy();

            // # Save policy
            cy.uiGetButton('Save').click();

            // * Check custom policy table is visible
            cy.get('#custom_policy_table .DataGrid').should('be.visible');

            cy.wait('@createCustomPolicy').then((interception) => {
                // * Verify create policy api response
                cy.uiVerifyPolicyResponse(interception.response.body, 0, 1, -1, 'Policy 3');
                const policyId = interception.response.body.id;

                cy.get('#custom_policy_table .DataGrid').within(() => {
                    // * Verify custom policy data table
                    cy.uiVerifyCustomPolicyRow(policyId, 'Policy 3', 'Keep forever', '0 teams, 1 channel');

                    cy.get(`#customWrapper-${policyId}`).trigger('mouseover').click();

                    // # Delete a policy
                    cy.findByRole('button', {name: 'Delete'}).should('be.visible').click();

                    // # Wait for deletion
                    cy.wait(TIMEOUTS.ONE_SEC);

                    // * Assert the policy row no longer exists
                    cy.get(`#customDescription-${policyId}`).should('not.exist');
                });
            });
        });
    });

    describe('Teams in a custom Policy', () => {
        it('MM-T4010 - Show policy teams information', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 1', 'years', '2');

            // # Add team to the policy
            cy.uiAddTeamsToCustomPolicy([testTeam.display_name]);

            // # Save policy
            cy.uiGetButton('Save').click();

            cy.wait('@createCustomPolicy').then((interception) => {
                // * Verify create policy api response
                cy.uiVerifyPolicyResponse(interception.response.body, 1, 0, 730, 'Policy 1');

                const policyId = interception.response.body.id;

                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'Policy 1', '2 years', '1 team, 0 channels');

                // # Go to edit custom data retention page
                cy.get('#custom_policy_table .DataGrid').within(() => {
                    cy.uiClickEditCustomPolicyRow(policyId);
                });
                cy.get('.DataRetentionSettings .admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').invoke('text').should('include', 'Custom Retention Policy');

                // * Verify Team data table exists
                cy.get('.PolicyTeamsList .DataGrid').within(() => {
                    cy.get(`#team-name-${testTeam.id}`).should('be.visible');
                });

                // * GET the team for the policy and verify it is correct
                cy.apiGetCustomRetentionPolicyTeams(policyId).then((result) => {
                    expect(result.body.teams[0].id).to.equal(testTeam.id);
                });
            });
        });

        it('MM-T4012 - Search teams in policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 1', 'years', '2');

            // # Add team to the policy
            cy.uiAddTeamsToCustomPolicy([testTeam.display_name]);

            // # Add channel to the policy
            cy.uiAddRandomTeamToCustomPolicy();

            // # Save policy
            cy.uiGetButton('Save').click();

            cy.wait('@createCustomPolicy').then((interception) => {
                // * Verify create policy api response
                cy.uiVerifyPolicyResponse(interception.response.body, 2, 0, 730, 'Policy 1');

                const policyId = interception.response.body.id;

                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'Policy 1', '2 years', '2 teams, 0 channels');

                // # Go to edit custom data retention page
                cy.get('#custom_policy_table .DataGrid').within(() => {
                    cy.uiClickEditCustomPolicyRow(policyId);
                });
                cy.get('.DataRetentionSettings .admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').invoke('text').should('include', 'Custom Retention Policy');

                cy.get('.PolicyTeamsList .DataGrid').within(() => {
                    // # Find the team table search box and type in team name
                    cy.findByRole('textbox').should('be.visible').clear().type(testTeam.name);
                    cy.wait(TIMEOUTS.ONE_SEC);

                    // * Verify the team is visible after search
                    cy.get(`#team-name-${testTeam.id}`).should('be.visible').invoke('text').should('include', testTeam.display_name);
                });

                // * Search the team for the policy using the API and verify it is correct
                cy.apiSearchCustomRetentionPolicyTeams(policyId, testTeam.display_name).then((result) => {
                    expect(result.body[0].id).to.equal(testTeam.id);
                });
            });
        });

        it('MM-T4018 - Number of teams in policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 1', 'years', '2');

            // # Add team to the policy
            cy.uiAddTeamsToCustomPolicy([testTeam.display_name]);

            // # Add channels to the policy
            cy.uiAddRandomTeamToCustomPolicy(2);

            // # Save policy
            cy.uiGetButton('Save').click();

            cy.wait('@createCustomPolicy').then((interception) => {
                // * Verify create policy api response
                cy.uiVerifyPolicyResponse(interception.response.body, 3, 0, 730, 'Policy 1');

                const policyId = interception.response.body.id;

                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'Policy 1', '2 years', '3 teams, 0 channels');

                // # Go to edit custom data retention page
                cy.get('#custom_policy_table .DataGrid').within(() => {
                    cy.uiClickEditCustomPolicyRow(policyId);
                });
                cy.get('.DataRetentionSettings .admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').invoke('text').should('include', 'Custom Retention Policy');

                // * Verify team table pagination
                cy.get('.PolicyTeamsList .DataGrid').within(() => {
                    cy.findByText('1 - 3 of 3').scrollIntoView().should('be.visible');
                });

                // * GET the teams for the policy and verify the count is correct
                cy.apiGetCustomRetentionPolicyTeams(policyId).then((result) => {
                    expect(result.body.teams.length).to.equal(3);
                });
            });
        });

        it('MM-T4011 - Add team in policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('MyPolicy', 'days', '60');

            // # Add team to the policy
            cy.uiAddTeamsToCustomPolicy([testTeam.display_name]);

            // # Save policy
            cy.uiGetButton('Save').click();

            // * Verify team table pagination
            cy.get('#custom_policy_table .DataGrid').within(() => {
                cy.get('.DataGrid_rows .DataGrid_cell').first().should('contain.text', 'MyPolicy').click();
            });
            cy.get('.DataGrid_row .DataGrid_cell').first().should('contain', testTeam.display_name);
        });
    });

    describe('Channels in a custom Policy', () => {
        it('MM-T4017 - Total channels in policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 1', 'years', '2');

            // # Add channel to the policy
            cy.uiAddChannelsToCustomPolicy([testChannel.display_name]);

            // # Add 2 channels to the policy from the modal
            cy.uiAddRandomChannelToCustomPolicy(2);

            // # Save policy
            cy.uiGetButton('Save').click();

            cy.wait('@createCustomPolicy').then((interception) => {
                // * Verify create policy api response
                cy.uiVerifyPolicyResponse(interception.response.body, 0, 3, 730, 'Policy 1');

                const policyId = interception.response.body.id;

                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'Policy 1', '2 years', '0 teams, 3 channels');

                // # Go to edit custom data retention page
                cy.get('#custom_policy_table .DataGrid').within(() => {
                    cy.uiClickEditCustomPolicyRow(policyId);
                });
                cy.get('.DataRetentionSettings .admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').invoke('text').should('include', 'Custom Retention Policy');

                // * Verify Channel pagination
                cy.get('.PolicyChannelsList .DataGrid').within(() => {
                    cy.findByText('1 - 3 of 3').scrollIntoView().should('be.visible');
                });

                // * GET the channels for the policy and verify the count
                cy.apiGetCustomRetentionPolicyChannels(policyId).then((result) => {
                    expect(result.body.channels.length).to.equal(3);
                });
            });
        });

        it('MM-T4014 - Add channel in policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 1', 'years', '2');

            // # Add channel to the policy
            cy.uiAddChannelsToCustomPolicy([testChannel.display_name]);

            // # Save policy
            cy.uiGetButton('Save').click();

            cy.wait('@createCustomPolicy').then((interception) => {
                // * Verify create policy api response
                cy.uiVerifyPolicyResponse(interception.response.body, 0, 1, 730, 'Policy 1');

                const policyId = interception.response.body.id;

                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'Policy 1', '2 years', '0 teams, 1 channel');

                // * GET the channel for the policy and verify it is correct
                cy.apiGetCustomRetentionPolicyChannels(policyId).then((result) => {
                    expect(result.body.channels[0].id).to.equal(testChannel.id);
                });
            });
        });

        it('MM-T4015 - Delete channel in policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 1', 'years', '1');

            // # Add channel to the policy
            cy.uiAddChannelsToCustomPolicy([testChannel.display_name]);

            // # Add 2 channels to the policy
            cy.uiAddRandomChannelToCustomPolicy(2);

            // # Save policy
            cy.uiGetButton('Save').click();

            cy.wait('@createCustomPolicy').then((interception) => {
                // * Verify create policy api response
                cy.uiVerifyPolicyResponse(interception.response.body, 0, 3, 365, 'Policy 1');

                const policyId = interception.response.body.id;

                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'Policy 1', '1 year', '0 teams, 3 channels');

                // # Go to edit custom data retention page
                cy.get('#custom_policy_table .DataGrid').within(() => {
                    cy.uiClickEditCustomPolicyRow(policyId);
                });
                cy.get('.DataRetentionSettings .admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').invoke('text').should('include', 'Custom Retention Policy');

                // # Remove channel from policy
                cy.get('.PolicyChannelsList .DataGrid').within(() => {
                    cy.findAllByRole('link', {name: 'Remove'}).first().should('exist').click();
                });

                // # Save policy
                cy.uiGetButton('Save').click();

                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'Policy 1', '1 year', '0 teams, 2 channels');

                // * GET the channel for the policy and verify the count is correct
                cy.apiGetCustomRetentionPolicyChannels(policyId).then((result) => {
                    expect(result.body.channels.length).to.equal(2);
                });
            });
        });

        it('MM-T4016 - Search channels in policy', () => {
            // # Go to create custom data retention page
            cy.uiClickCreatePolicy();

            // # Fill out policy details
            cy.uiFillOutCustomPolicyFields('Policy 1', 'years', '2');

            // # Add channel to the policy
            cy.uiAddChannelsToCustomPolicy([testChannel.display_name]);

            // # Add channel to the policy
            cy.uiAddRandomChannelToCustomPolicy();

            // # Save policy
            cy.uiGetButton('Save').click();

            cy.wait('@createCustomPolicy').then((interception) => {
                // * Verify create policy api response
                cy.uiVerifyPolicyResponse(interception.response.body, 0, 2, 730, 'Policy 1');

                const policyId = interception.response.body.id;

                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'Policy 1', '2 years', '0 teams, 2 channels');

                // # Go to edit custom data retention page
                cy.get('#custom_policy_table .DataGrid').within(() => {
                    cy.uiClickEditCustomPolicyRow(policyId);
                });
                cy.get('.DataRetentionSettings .admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').invoke('text').should('include', 'Custom Retention Policy');

                // # Scroll down the custom policy form page
                cy.get('.DataRetentionSettings .admin-console__wrapper').scrollTo('bottom');

                cy.get('.PolicyChannelsList .DataGrid').within(() => {
                    // This will not type the space for display name?
                    cy.findByRole('textbox').should('be.visible').clear().type(testChannel.name);
                    cy.wait(TIMEOUTS.ONE_SEC);
                    cy.get(`#channel-name-${testChannel.id}`).should('be.visible').invoke('text').should('include', testChannel.display_name);
                });

                cy.apiSearchCustomRetentionPolicyChannels(policyId, testChannel.display_name).then((result) => {
                    expect(result.body[0].id).to.equal(testChannel.id);
                });
            });
        });
    });
});
