// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @elasticsearch @autocomplete @not_cloud

import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';
import {getRandomId} from '../../../../utils';

import {
    enableElasticSearch,
    searchAndVerifyChannel,
    searchAndVerifyUser,
} from './helpers';

describe('Autocomplete with Elasticsearch - Renaming Team', () => {
    const randomId = getRandomId();
    let testUser: UserProfile;
    let testChannel: Channel;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license for Elasticsearch
        cy.apiRequireLicenseForFeature('Elasticsearch');

        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            testChannel = channel;

            // # Enable Elasticsearch
            enableElasticSearch();

            cy.visit(`/${team.name}/channels/town-square`);

            // # Verify user and channel appears in search results before change
            searchAndVerifyUser(user);
            searchAndVerifyChannel(channel);

            // # Rename the team
            cy.apiPatchTeam(team.id, {display_name: 'updatedteam' + randomId});

            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T2514_1 Renaming a Team does not affect user autocomplete suggestions', () => {
        searchAndVerifyUser(testUser);
    });

    it('MM-T2514_2 Renaming a Team does not affect channel autocomplete suggestions', () => {
        cy.get('body').type('{esc}');
        searchAndVerifyChannel(testChannel);
    });
});
