// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @elasticsearch @autocomplete @not_cloud

import {Team} from '@mattermost/types/teams';
import {getRandomLetter} from '../../../../utils';
import {doTestDMChannelSidebar, doTestUserChannelSection} from '../../autocomplete/common_test';
import {createSearchData, SimpleUser} from '../../autocomplete/helpers';
import {enableElasticSearch} from './helpers';

describe('Autocomplete with Elasticsearch - Users', () => {
    const prefix = getRandomLetter(3);
    let testUsers: Record<string, SimpleUser>;
    let testTeam: Team;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license for Elasticsearch
        cy.apiRequireLicenseForFeature('Elasticsearch');

        // # Enable Elasticsearch
        enableElasticSearch();

        createSearchData(prefix).then((searchData) => {
            testUsers = searchData.users;
            testTeam = searchData.team;

            cy.apiLogin(searchData.sysadmin);
        });
    });

    it('MM-T3863 Users in correct in/out of channel sections', () => {
        doTestUserChannelSection(prefix, testTeam, testUsers);
    });

    it('MM-T2518 DM can be opened with a user not on your team or in your DM channel sidebar', () => {
        doTestDMChannelSidebar(testUsers);
    });
});
