// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @search_date_filter

import {getAdminAccount} from '../../../support/env';

import {
    searchAndValidate,
    getTestMessages,
    setupTestData,
} from './helpers';

describe('Search Date Filter', () => {
    const testData = getTestMessages();
    const {
        commonText,
        allMessagesInOrder,
    } = testData;
    const admin = getAdminAccount();
    let anotherAdmin;

    before(() => {
        cy.apiInitSetup({userPrefix: 'other-admin'}).then(({team, channel, user, channelUrl}) => {
            anotherAdmin = user;

            // # Visit town-square
            cy.visit(channelUrl);

            setupTestData(testData, {team, channel, admin, anotherAdmin});
        });
    });

    beforeEach(() => {
        cy.reload();
        cy.postMessage(Date.now());
    });

    it('MM-T605_1 before: using a date from the future shows results', () => {
        searchAndValidate(`before:2099-7-15 ${commonText}`, allMessagesInOrder);
    });

    it('MM-T605_2 on: using a date from the future shows no results', () => {
        searchAndValidate(`on:2099-7-15 ${commonText}`);
    });

    it('MM-T605_3 after: using a date from the future shows no results', () => {
        searchAndValidate(`after:2099-7-15 ${commonText}`);
    });
});
