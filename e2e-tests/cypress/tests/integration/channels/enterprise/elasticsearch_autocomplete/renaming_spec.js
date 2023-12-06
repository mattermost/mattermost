// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @elasticsearch @autocomplete @not_cloud

import {getRandomId} from '../../../../utils';

import {
    enableElasticSearch,
    searchAndVerifyChannel,
    searchAndVerifyUser,
} from './helpers';

describe('Autocomplete with Elasticsearch - Renaming', () => {
    let testUser;
    let testChannel;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license for Elasticsearch
        cy.apiRequireLicenseForFeature('Elasticsearch');

        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            testChannel = channel;

            // # Enable Elasticsearch
            enableElasticSearch();

            // # Visit town-square channel
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T2512 Change is reflected in the search when renaming a user', () => {
        // # Verify user appears in search results before change
        searchAndVerifyUser(testUser);

        // # Rename a user
        cy.apiPatchUser(testUser.id, {username: `newusername-${getRandomId()}`}).then(({user}) => {
            // # Verify user appears in search results post-change
            searchAndVerifyUser(user);
        });
    });

    it('MM-T2513 Change is reflected in the search when renaming a channel', () => {
        // # Verify channel appears in search results before change
        searchAndVerifyChannel(testChannel);

        // # Change the channels name
        cy.apiPatchChannel(testChannel.id, {name: `newname-${getRandomId()}`}).then(({channel}) => {
            cy.reload();

            // # Search for channel and verify it appears
            searchAndVerifyChannel(channel);
        });
    });
});
