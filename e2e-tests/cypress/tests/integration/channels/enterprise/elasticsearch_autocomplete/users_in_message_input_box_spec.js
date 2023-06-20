// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @elasticsearch @autocomplete @not_cloud

import {getRandomLetter} from '../../../../utils';
import {doTestPostextbox} from '../../autocomplete/common_test';
import {createSearchData, enableElasticSearch} from '../../autocomplete/helpers';

describe('Autocomplete with Elasticsearch - Users', () => {
    const prefix = getRandomLetter(3);
    let testUsers;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license for Elasticsearch
        cy.apiRequireLicenseForFeature('Elasticsearch');

        // # Enable Elasticsearch
        enableElasticSearch();

        createSearchData(prefix).then((searchData) => {
            testUsers = searchData.users;

            cy.apiLogin(searchData.sysadmin);

            // # Navigate to the new teams town square
            cy.visit(`/${searchData.team.name}/channels/town-square`);
        });
    });

    describe('search for user in message input box', () => {
        describe('by @username', () => {
            it('MM-T2505_1 Full username returns single user', () => {
                doTestPostextbox(`@${prefix}ironman`, testUsers.ironman);
            });

            it('MM-T2505_2 Unique partial username returns single user', () => {
                doTestPostextbox(`@${prefix}doc`, testUsers.doctorstrange);
            });

            it('MM-T2505_3 Partial username returns all users that match', () => {
                doTestPostextbox(`@${prefix}i`, testUsers.ironman);
            });
        });

        describe('by @firstname', () => {
            it('MM-T3857_1 Full first name returns single user', () => {
                doTestPostextbox(`@${prefix}tony`, testUsers.ironman);
            });

            it('MM-T3857_2 Unique partial first name returns single user', () => {
                doTestPostextbox(`@${prefix}wa`, testUsers.deadpool);
            });

            it('MM-T3857_3 Partial first name returns all users that match', () => {
                doTestPostextbox(`@${prefix}ste`, testUsers.captainamerica, testUsers.doctorstrange);
            });
        });

        describe('by @lastname', () => {
            it('MM-T3858_1 Full last name returns single user', () => {
                doTestPostextbox(`@${prefix}stark`, testUsers.ironman);
            });

            it('MM-T3858_2 Unique partial last name returns single user', () => {
                doTestPostextbox(`@${prefix}ban`, testUsers.hulk);
            });

            it('MM-T3858_3 Partial last name returns all users that match', () => {
                doTestPostextbox(`@${prefix}ba`, testUsers.hawkeye, testUsers.hulk);
            });
        });

        describe('by @nickname', () => {
            it('MM-T3859_1 Full nickname returns single user', () => {
                doTestPostextbox(`@${prefix}ronin`, testUsers.hawkeye);
            });

            it('MM-T3859_2 Unique partial nickname returns single user', () => {
                doTestPostextbox(`@${prefix}gam`, testUsers.hulk);
            });

            it('MM-T3859_3 Partial nickname returns all users that match', () => {
                doTestPostextbox(`@${prefix}pro`, testUsers.captainamerica, testUsers.ironman);
            });
        });

        describe('special characters in usernames are returned', () => {
            it('MM-T2515_1 Username with dot', () => {
                doTestPostextbox(`@${prefix}dot.dot`, testUsers.dot);
            });

            it('MM-T2515_2 Username with dash', () => {
                doTestPostextbox(`@${prefix}dash-dash`, testUsers.dash);
            });

            it('MM-T2515_3 Username with underscore', () => {
                doTestPostextbox(`@${prefix}under_score`, testUsers.underscore);
            });
        });
    });
});
