// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console

import {
    runDataRetentionAndVerifyPostDeleted,
    gotoGlobalPolicy,
    editGlobalPolicyMessageRetention,
    verifyPostNotDeleted,
} from './helpers';

describe('Data Retention - Custom Policy Only', () => {
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

    it('MM-T4097 - Assign Global Policy = Forever & Custom Policy = 10 days to Channel', () => {
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

        // # Create new Channel
        let channelB;
        cy.apiCreateChannel(testTeam.id, 'test_channel', 'channelB').then(({channel}) => {
            channelB = channel;
        });

        // # Create 12 days older posts
        // # Get Epoch value
        const createDate = new Date().setDate(new Date().getDate() - 12);
        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDate);
            cy.apiPostWithCreateDate(channelB.id, postText, token, createDate);

            // * Run the job and verify 12 days older post is deleted
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel, postText);

            // * Verify 12 days older post is not deleted
            verifyPostNotDeleted(testTeam, channelB, postText);
        });
    });

    it('MM-T4098 - Assign Global Policy = Forever & Custom Policy = 1 year to Channels', () => {
        // # Go to create custom data retention page
        cy.uiClickCreatePolicy();

        // # Fill out policy details
        cy.uiFillOutCustomPolicyFields('MyPolicy', 'days', '365');

        // # Add channel to the policy
        cy.uiAddChannelsToCustomPolicy([testChannel.display_name]);

        // # Save policy
        cy.uiGetButton('Save').click();

        cy.wait('@createCustomPolicy').then((interception) => {
            // * Verify create policy api response
            const policyId = interception.response.body.id;
            cy.get('#custom_policy_table .DataGrid').within(() => {
                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'MyPolicy', '1 year', '0 teams, 1 channel');
            });
        });

        // # Create new Channel
        let channelB;
        cy.apiCreateChannel(testTeam.id, 'test_channel', ' channelB').then(({channel}) => {
            channelB = channel;
        });

        // # Create more than one year older posts
        // # Get Epoch value
        const createDate = new Date().setMonth(new Date().getMonth() - 14);
        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDate);
            cy.apiPostWithCreateDate(channelB.id, postText, token, createDate);

            // * Run the job and verify more than one year older post is deleted
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel, postText);

            // * Verify more than one year older post is not deleted
            verifyPostNotDeleted(testTeam, channelB, postText);
        });
    });

    it('MM-T4105 - Assign Global Policy = Forever & Custom Policy = 1 year to Teams', () => {
        // # Go to create custom data retention page
        cy.uiClickCreatePolicy();

        // # Fill out policy details
        cy.uiFillOutCustomPolicyFields('MyPolicy', 'days', '365');

        // # Add a team to the policy
        cy.uiAddTeamsToCustomPolicy([testTeam.display_name]);

        // # Save policy
        cy.uiGetButton('Save').click();

        cy.wait('@createCustomPolicy').then((interception) => {
            // * Verify create policy api response
            const policyId = interception.response.body.id;
            cy.get('#custom_policy_table .DataGrid').within(() => {
                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'MyPolicy', '1 year', '1 team, 0 channels');
            });
        });

        // # Create new Team and Channel
        let newTeam;
        let channelB;
        cy.apiCreateTeam('team', 'Team1').then(({team}) => {
            cy.apiCreateChannel(team.id, 'test_channel', 'channelB').then(({channel}) => {
                newTeam = team;
                channelB = channel;
            });
        });

        // # Create more than one year older posts
        // # Get Epoch value
        const createDate = new Date().setMonth(new Date().getMonth() - 14);

        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDate);
            cy.apiPostWithCreateDate(channelB.id, postText, token, createDate);

            // * Run the job and verify more than one year older post has been deleted
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel, postText);

            // * Verify more then one year older post is not deleted
            verifyPostNotDeleted(newTeam, channelB, postText);
        });
    });

    it('MM-T4102 - Assign Global Policy = Forever & Custom Policy = 30 days to Teams', () => {
        // # Go to create custom data retention page
        cy.uiClickCreatePolicy();

        // # Fill out policy details
        cy.uiFillOutCustomPolicyFields('MyPolicy', 'days', '30');

        // # Add team to the policy
        cy.uiAddTeamsToCustomPolicy([testTeam.display_name]);

        // # Save policy
        cy.uiGetButton('Save').click();

        cy.wait('@createCustomPolicy').then((interception) => {
            // * Verify create policy api response
            const policyId = interception.response.body.id;

            cy.get('#custom_policy_table .DataGrid').within(() => {
                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'MyPolicy', '30 days', '1 team, 0 channels');
            });
        });

        // # Create new Team and Channel
        let channelB;
        let newTeam;
        cy.apiCreateTeam('team', 'Team1').then(({team}) => {
            cy.apiCreateChannel(team.id, 'test_channel', 'channelB').then(({channel}) => {
                channelB = channel;
                newTeam = team;
            });
        });

        // # Create more than one year older post
        // # Get Epoch value
        const createDate = new Date().setDate(new Date().getDate() - 32);

        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDate);
            cy.apiPostWithCreateDate(channelB.id, postText, token, createDate);

            // * Run the job and verify 32 days older post is deleted
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel, postText);

            // * Verify 32 days old post is not deleted
            verifyPostNotDeleted(newTeam, channelB, postText);
        });
    });

    it('MM-T4104 - Assign Global policy = Forever & Custom Policy = 5 and 10 days to Teams', () => {
        // # Create a new Channel
        let testChannel2;
        cy.apiCreateChannel(testTeam.id, 'test_channel', 'TestChannel2').then(({channel}) => {
            testChannel2 = channel;
        });

        // # Go to create custom data retention page
        cy.uiClickCreatePolicy();

        // # Fill out policy details
        cy.uiFillOutCustomPolicyFields('MyPolicy', 'days', '5');

        // # Add team to the policy
        cy.uiAddTeamsToCustomPolicy([testTeam.display_name]);

        // # Save policy
        cy.uiGetButton('Save').click();

        cy.wait('@createCustomPolicy').then((interception) => {
            // * Verify create policy api response
            const policyId = interception.response.body.id;
            cy.get('#custom_policy_table .DataGrid').within(() => {
                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'MyPolicy', '5 days', '1 team, 0 channels');
            });
        });

        // # Create new Team and Channels
        let newTeam;
        let channelA;
        let channelB;

        cy.apiCreateTeam('team', 'Team1').then(({team}) => {
            newTeam = team;

            // # Create new Channel
            cy.apiCreateChannel(team.id, 'test_channel', 'test_channelC').then(({channel}) => {
                channelB = channel;
            });

            cy.apiCreateChannel(team.id, 'test_channel', 'Channel-A').then(({channel}) => {
                channelA = channel;

                // # Create second policy
                cy.uiClickCreatePolicy();

                // # Fill out policy details
                cy.uiFillOutCustomPolicyFields('MyPolicy1', 'days', '10');

                // # Add team to the policy
                cy.uiAddTeamsToCustomPolicy([newTeam.display_name]);

                // # Save policy
                cy.uiGetButton('Save').click();

                cy.wait('@createCustomPolicy').then((interception) => {
                    // * Verify create policy api response
                    const policyId = interception.response.body.id;
                    cy.get('#custom_policy_table .DataGrid').within(() => {
                        // * Verify custom policy data table
                        cy.uiVerifyCustomPolicyRow(policyId, 'MyPolicy1', '10 days', '1 team, 0 channels');
                    });
                });
            });
        });

        // # Create more 3,7, and 12 days older posts
        // # Get Epoch values
        const createDate1 = new Date().setDate(new Date().getDate() - 7);
        const createDate2 = new Date().setDate(new Date().getDate() - 3);
        const createDate3 = new Date().setDate(new Date().getDate() - 12);

        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDate1);
            cy.apiPostWithCreateDate(testChannel2.id, postText, token, createDate2);

            cy.apiPostWithCreateDate(channelA.id, postText, token, createDate3);
            cy.apiPostWithCreateDate(channelB.id, postText, token, createDate2);

            // * Run the job and Verify 7 days older post in testChannel is deleted
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel, postText);

            // * Verify 3 days older post in testChennel2 is not deleted
            verifyPostNotDeleted(testTeam, testChannel2, postText);

            // * Verify 12 days older post in ChannelA is deleted
            cy.visit(`/${newTeam.name}/channels/${channelA.name}`);
            cy.findAllByTestId('postView').should('have.length', 1);
            cy.findAllByTestId('postView').should('not.contain', postText);

            // * Verify 3 days older post in channelB is not deleted
            verifyPostNotDeleted(newTeam, channelB, postText);
        });
    });

    it('MM-T4019 - Global Data Retention policy', () => {
        [
            {input: '365', result: '1 year'},
            {input: '700', result: '700 days'},
            {input: '730', result: '2 years'},
            {input: '600', result: '600 days'},
        ].forEach(({input, result}) => {
            gotoGlobalPolicy();

            // # Edit global policy message retention
            editGlobalPolicyMessageRetention(input, result);
        });
    });
});

