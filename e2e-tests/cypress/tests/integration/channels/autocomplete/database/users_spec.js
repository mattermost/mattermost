// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @autocomplete

import {getRandomLetter} from '../../../../utils';
import {doTestDMChannelSidebar, doTestUserChannelSection} from '../common_test';
import {createSearchData} from '../helpers';

describe('Autocomplete with Database - Users', () => {
    const prefix = getRandomLetter(3);
    let testUsers;
    let testTeam;

    before(() => {
        cy.apiGetClientLicense().then(({isCloudLicensed}) => {
            if (!isCloudLicensed) {
                cy.shouldHaveElasticsearchDisabled();
            }
        });

        createSearchData(prefix).then((searchData) => {
            testUsers = searchData.users;
            testTeam = searchData.team;

            cy.apiLogin(searchData.sysadmin);
        });
    });

    it('MM-T4081 Users in correct in/out of channel sections', () => {
        doTestUserChannelSection(prefix, testTeam, testUsers);
    });

    it('MM-T4082 DM can be opened with a user not on your team or in your DM channel sidebar', () => {
        doTestDMChannelSidebar(testUsers);
    });
});
