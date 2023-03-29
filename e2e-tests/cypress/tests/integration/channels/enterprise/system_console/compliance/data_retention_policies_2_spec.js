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
    gotoGlobalPolicy,
    editGlobalPolicyMessageRetention,
    runDataRetentionAndVerifyPostDeleted,
    verifyPostNotDeleted,
} from './helpers';

describe('Data Retention - Global and Custom Policy Only', () => {
    let testTeam;
    let testChannel;
    let users;
    let channelA;
    let channelB;
    let channelC;
    let newTeam;
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

        // # Go to data retention settings
        cy.uiGoToDataRetentionPage();
    });

    it('MM-T4093 - Assign Global Policy = 10 Days & Custom Policy = None to channel', () => {
        gotoGlobalPolicy();

        // # Edit global policy message retention
        editGlobalPolicyMessageRetention('10', '10 days');

        // * Verify there is no any team and channel assigned
        cy.get('#custom_policy_table .DataGrid').within(() => {
            cy.get('.DataGrid_rows .DataGrid_empty').first().should('contain.text', 'No items found');
        });

        let testChannel2;
        cy.apiCreateChannel(testTeam.id, 'test_channel', 'testChannel2').then(({channel}) => {
            testChannel2 = channel;
        });

        // # Create 13 days older post
        // # Get Epoch value
        const createDate = new Date().setDate(new Date().getDate() - 13);
        const createDate2 = new Date().setDate(new Date().getDate() - 7);

        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDate);
            cy.apiPostWithCreateDate(testChannel2.id, postText, token, createDate2);

            // * Run the job and verify 13 days older post has been deleted
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel, postText);

            // * Verify 7 days older post is not deleted
            verifyPostNotDeleted(testTeam, testChannel2, postText);
        });
    });

    it('MM-T4099 - Assign Global Policy = 10 Days & Custom Policy = 5 days to Channels', () => {
        // # Edit Global Policy to 10 days
        gotoGlobalPolicy();
        editGlobalPolicyMessageRetention('10', '10 days');

        // # Go to create custom data retention page
        cy.uiClickCreatePolicy();

        // # Fill out policy details
        cy.uiFillOutCustomPolicyFields('MyPolicy', 'days', '5');

        // # Add team to the policy
        cy.uiAddTeamsToCustomPolicy([testTeam.display_name]);

        // # Save policy
        cy.uiGetButton('Save').click();

        // # Create channel-A
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'GlobalChannel-1').then(({channel}) => {
            channelA = channel;
        });

        // # Create channel-B
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Custom-Channel1').then(({channel}) => {
            channelB = channel;
        });

        // # Create channel-C
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Global-Channel-2').then(({channel}) => {
            channelC = channel;
        });

        // * Verify create policy api response
        cy.wait('@createCustomPolicy').then((interception) => {
            const policyId = interception.response.body.id;
            cy.get('#custom_policy_table .DataGrid').within(() => {
                // * Verify custom policy data table
                cy.uiVerifyCustomPolicyRow(policyId, 'MyPolicy', '5 days', '1 team, 0 channels');
            });
        });

        // # Create more than 3,7, and 12 days older post
        // # Get Epoch value
        const createDate1 = new Date().setDate(new Date().getDate() - 7);
        const createDate2 = new Date().setDate(new Date().getDate() - 3);
        const createDate3 = new Date().setDate(new Date().getDate() - 12);

        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDate1);
            cy.apiPostWithCreateDate(channelA.id, postText, token, createDate2);
            cy.apiPostWithCreateDate(channelB.id, postText, token, createDate2);
            cy.apiPostWithCreateDate(channelC.id, postText, token, createDate3);

            // * Run the job and verify 7 days older post is deleted
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel, postText);

            // * Verify 7 days older post is not deleted
            verifyPostNotDeleted(testTeam, channelA, postText);

            // * Verify 3 days older post is not deleted
            verifyPostNotDeleted(testTeam, channelB, postText);

            // * Verify 12 days older post is deleted
            verifyPostNotDeleted(testTeam, channelC, postText, 1);
        });
    });

    it('MM-T4101 - Assign Global Policy = 5 days & Custom Policy = None to Teams', () => {
        // # Edit global policy to 5 days
        gotoGlobalPolicy();
        editGlobalPolicyMessageRetention('5', '5 days');

        // * Verify there is no any team and channel assigned
        cy.get('#custom_policy_table .DataGrid').within(() => {
            cy.get('.DataGrid_rows .DataGrid_empty').first().should('contain.text', 'No items found');
        });

        // # Create new channel
        let testChannel2;
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'OtherChannel ').then(({channel}) => {
            testChannel2 = channel;
        });

        // # Create new Team and Channel
        cy.apiCreateTeam('team', 'Team1').then(({team}) => {
            cy.apiCreateChannel(team.id, 'test_channel', 'Channel-A').then(({channel}) => {
                newTeam = team;
                channelA = channel;
            });
        });

        // # Create 3 and 7 days older posts
        // # Get Epoch value
        const createDays1 = new Date().setDate(new Date().getDate() - 7);
        const createDays2 = new Date().setDate(new Date().getDate() - 3);

        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDays1);
            cy.apiPostWithCreateDate(testChannel2.id, postText, token, createDays1);
            cy.apiPostWithCreateDate(channelA.id, postText, token, createDays2);

            // * Run the job and verify 7 days older posts have been deleted
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel, postText);
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel2, postText);

            // * Verify 3 days older post was not deleted
            verifyPostNotDeleted(newTeam, channelA, postText);
        });
    });

    it('MM-T4103 - Assign Global Policy = 10 days & Custom Policy = 5 days to Team', () => {
        // # Edit global policy to 5 days
        gotoGlobalPolicy();
        editGlobalPolicyMessageRetention('10', '10 days');

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

        // # Create channel-A
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'GlobalChannel-1').then(({channel}) => {
            channelA = channel;
        });

        // # Create a new Team and Channel
        cy.apiCreateTeam('team', 'Team1').then(({team}) => {
            newTeam = team;
            cy.apiCreateChannel(newTeam.id, 'test_channel', 'Channel-A').then(({channel}) => {
                channelB = channel;
            });

            // # Create a new channel in newTeam
            cy.apiCreateChannel(newTeam.id, 'channel-test', 'Global-Channel-2').then(({channel}) => {
                channelC = channel;
            });
        });

        // # Create more than 3,7, and 12 days older posts
        // # Get Epoch value
        const createDate1 = new Date().setDate(new Date().getDate() - 7);
        const createDate2 = new Date().setDate(new Date().getDate() - 3);
        const createDate3 = new Date().setDate(new Date().getDate() - 12);

        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDate1);
            cy.apiPostWithCreateDate(channelA.id, postText, token, createDate2);
            cy.apiPostWithCreateDate(channelB.id, postText, token, createDate1);
            cy.apiPostWithCreateDate(channelC.id, postText, token, createDate3);

            // * Run the job and verify 7 days older post is deleted
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel, postText);

            // * Verify 7 days older post is not deleted
            verifyPostNotDeleted(testTeam, channelA, postText);

            // * Verify 3 days older post is not deleted
            verifyPostNotDeleted(newTeam, channelB, postText);

            // * Verify 12 days older post is deleted
            verifyPostNotDeleted(newTeam, channelC, postText, 1);
        });
    });

    it('MM-T4096 - Assign Global Policy = 1 Year & Custom Policy = None to channel', () => {
        // # Edit global policy to 1 year
        gotoGlobalPolicy();
        editGlobalPolicyMessageRetention('365', '1 year');

        // * Verify there is no any team and channel assigned
        cy.get('#custom_policy_table .DataGrid').within(() => {
            cy.get('.DataGrid_rows .DataGrid_empty').first().should('contain.text', 'No items found');
        });

        // # Create a new channel
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'GlobalChannel ').then(({channel}) => {
            channelA = channel;
        });

        // # Create less than one year and one year older post
        // # Get Epoch value
        const createDate1 = new Date().setMonth(new Date().getMonth() - 14);
        const createDate2 = new Date().setMonth(new Date().getMonth() - 10);

        cy.apiCreateToken(users).then(({token}) => {
            // # Create posts
            cy.apiPostWithCreateDate(testChannel.id, postText, token, createDate1);
            cy.apiPostWithCreateDate(channelA.id, postText, token, createDate2);

            // * Run the job and verify 1 year older post has been deleted
            runDataRetentionAndVerifyPostDeleted(testTeam, testChannel, postText);

            // * Verify less than one year post was not deleted
            verifyPostNotDeleted(testTeam, channelA, postText);
        });
    });
});
