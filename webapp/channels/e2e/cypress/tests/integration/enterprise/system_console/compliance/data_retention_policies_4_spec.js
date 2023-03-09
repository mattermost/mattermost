// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @system_console

import {
    runDataRetentionAndVerifyPostDeleted,
    gotoGlobalPolicy,
    editGlobalPolicyMessageRetention,
} from './helpers';

describe('Data Retention - Global and Custom Policy', () => {
    let testTeam;
    let testChannel;
    let users;
    const postText = 'This is testing';

    before(() => {
        cy.apiRequireLicenseForFeature('DataRetention');

        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableUserAccessTokens: true,
            },
        });
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            users = user.id;
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

    it('MM-T4100 - Assign Global Policy = 5 days & Custom Policy = 10 days to channels', () => {
        let newChannel;
        let newTeam;

        // # Edit Global Policy to 5 days
        gotoGlobalPolicy();
        editGlobalPolicyMessageRetention('5', '5 days');

        // # Create a new team
        cy.apiCreateTeam('team', 'Team1').then(({team}) => {
            cy.apiCreateChannel(team.id, 'test_channel', 'Channel-A').then(({channel}) => {
                newChannel = channel;
                newTeam = team;
            });
        });

        // # Go to create custom data retention page
        cy.uiClickCreatePolicy();

        // # Fill out policy details
        cy.uiFillOutCustomPolicyFields('MyPolicy', 'days', '10');

        // # Add channel to the policy
        cy.uiAddChannelsToCustomPolicy([testChannel.display_name]);

        // # Save policy
        cy.uiGetButton('Save').click();

        cy.wait('@createCustomPolicy').then((interception) => {
            // * Verify create policy api response
            const policyId = interception.response.body.id;
            cy.get('#custom_policy_table .DataGrid').within(() => {
                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'MyPolicy', '10 days', '0 teams, 1 channel');
            });
        });

        // # Create more than 7 days older post
        // # Get Epoch value
        const createDate = new Date().setDate(new Date().getDate() - 7);

        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(newChannel.id, postText, token, createDate);
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDate);

            // * Run the job and verify 7 days older post in newChannel has been deleted
            runDataRetentionAndVerifyPostDeleted(newTeam, newChannel, postText);

            // * Verify 7 days older post in testChannel was not deleted
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
            cy.findAllByTestId('postView').should('have.length', 2);
            cy.findAllByTestId('postView').should('contain', postText);
        });
    });
});

