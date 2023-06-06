// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @elasticsearch @autocomplete @not_cloud

import {getAdminAccount} from '../../../../support/env';

import {
    createPrivateChannel,
    createPublicChannel,
    enableElasticSearch,
    searchAndVerifyChannel,
} from './helpers';

describe('Autocomplete with Elasticsearch - Channel', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // # Check if server has license for Elasticsearch
        cy.apiRequireLicenseForFeature('Elasticsearch');

        // # Enable Elasticsearch
        enableElasticSearch();

        // # Login as test user and go to town-square
        cy.apiInitSetup({loginAfter: true}).then(({team, user}) => {
            testUser = user;
            testTeam = team;
        });
    });

    beforeEach(() => {
        // # Visit town-square channel
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T2510_1 Private channel I do belong to appears', () => {
        // # Create private channel and add new user to it (sets @privateChannel alias)
        createPrivateChannel(testTeam.id, testUser).then((channel) => {
            // # Go to off-topic channel to partially reload the page
            cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();

            // * Private channel in suggestion list should appear
            searchAndVerifyChannel(channel);
        });
    });

    it("MM-T2510_2 Private channel I don't belong to does not appear", () => {
        // # Create private channel, do not add new user to it (sets @privateChannel alias)
        createPrivateChannel(testTeam.id).then((channel) => {
            // # Go to off-topic channel to partially reload the page
            cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();

            // * Private channel should not appear on search
            searchAndVerifyChannel(channel, false);
        });
    });

    it('MM-T2510_3 Private channel left does not appear', () => {
        // # Create private channel and add new user to it (sets @privateChannel alias)
        createPrivateChannel(testTeam.id, testUser).then((channel) => {
            // # Visit private channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Leave private channel
            cy.uiOpenChannelMenu('Leave Channel');
            cy.findByRoleExtended('button', {name: 'Yes, leave channel'}).should('be.visible').click();

            // # Go to off-topic channel to partially reload the page
            cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();

            // * Private channel should not appear on search
            searchAndVerifyChannel(channel, false);
        });
    });

    it('MM-T2510_4 Channel outside of team does not appear', () => {
        const teamName = 'elastic-private-' + Date.now();

        // # As admin, create a new team that the new user is not a member of
        cy.externalRequest({
            user: getAdminAccount(),
            path: 'teams',
            method: 'post',
            data: {
                name: teamName,
                display_name: teamName,
                type: 'O',
            },
        }).then(({data: team}) => {
            // # Create a private channel where the new user is not a member of
            createPrivateChannel(team.id).then((channel) => {
                // # Go to off-topic channel to partially reload the page
                cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();

                // * Private channel should not appear on search
                searchAndVerifyChannel(channel, false);
                cy.uiClose();
            });

            return cy.wrap({team});
        }).then(({team}) => {
            // # Create a private channel where the new user is not a member of
            createPublicChannel(team.id).then((publicChannel) => {
                // # Go to off-topic channel to partially reload the page
                cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();

                // * Public channel should not appear on search
                searchAndVerifyChannel(publicChannel, false);
            });
        });
    });
});
