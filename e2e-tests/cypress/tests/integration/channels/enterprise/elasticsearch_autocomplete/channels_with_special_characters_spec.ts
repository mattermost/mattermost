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
import {
    enableElasticSearch,
    searchAndVerifyChannel,
} from './helpers';

describe('Autocomplete with Elasticsearch - Channel', () => {
    let testChannel: Channel;
    let teamName: string;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license for Elasticsearch
        cy.apiRequireLicenseForFeature('Elasticsearch');

        // # Enable Elasticsearch
        enableElasticSearch();

        // # Login as test user
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            teamName = team.name;
            const name = 'hellothere';

            cy.apiCreateChannel(team.id, name, name).then(({channel}) => {
                testChannel = channel;
            });
        });
    });

    beforeEach(() => {
        // # Visit off-topic channel
        cy.visit(`/${teamName}/channels/off-topic`);
    });

    it('MM-T2517_1 Channels with dot returned in autocomplete suggestions', () => {
        const name = 'hello.there';

        // # Change the name of channel
        cy.apiPatchChannel(testChannel.id, {display_name: name});

        // * Search for channel should work
        searchAndVerifyChannel({...testChannel, display_name: name});
    });

    it('MM-T2517_2 Channels with dash returned in autocomplete suggestions', () => {
        const name = 'hello-there';

        // # Change the name of channel
        cy.apiPatchChannel(testChannel.id, {display_name: name});

        // * Search for channel should work
        searchAndVerifyChannel({...testChannel, display_name: name});
    });

    it('MM-T2517_3 Channels with underscore returned in autocomplete suggestions', () => {
        const name = 'hello_there';

        // # Change the name of channel
        cy.apiPatchChannel(testChannel.id, {display_name: name});

        // * Search for channel should work
        searchAndVerifyChannel({...testChannel, display_name: name});
    });

    it('MM-T2517_4 Channels with dot, dash and underscore returned in autocomplete suggestions', () => {
        const name = 'he.llo-the_re';

        // # Change the name of channel
        cy.apiPatchChannel(testChannel.id, {display_name: name});

        // * Search for channel should work
        searchAndVerifyChannel({...testChannel, display_name: name});
    });
});
