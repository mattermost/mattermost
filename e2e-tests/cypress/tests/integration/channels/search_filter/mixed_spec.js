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
    getTestMessages,
    searchAndValidate,
    setupTestData,
} from './helpers';

describe('Search Date Filter', () => {
    const testData = getTestMessages();
    const {
        commonText,
        firstDateEarly,
        secondMessage,
        secondOffTopicMessage,
    } = testData;
    const admin = getAdminAccount();
    let anotherAdmin;

    before(() => {
        cy.apiInitSetup({userPrefix: 'other-admin'}).then(({team, channel, user, channelUrl}) => {
            anotherAdmin = user;

            // # Visit test channel
            cy.visit(channelUrl);

            setupTestData(testData, {team, channel, admin, anotherAdmin});
        });
    });

    it('MM-T589 "before:" and "after:" can be used together', () => {
        searchAndValidate(`before:${Cypress.dayjs().format('YYYY-MM-DD')} after:${firstDateEarly.query} ${commonText}`, [secondOffTopicMessage, secondMessage]);
    });

    it('MM-T593 "before:", "after:", "from:", and "in:" can be used in one search', () => {
        searchAndValidate(`before:${Cypress.dayjs().format('YYYY-MM-DD')} after:${firstDateEarly.query} from:${anotherAdmin.username} in:off-topic ${commonText}`, [secondOffTopicMessage]);
    });

    it('MM-T603 Place a string when a date is expected', () => {
        searchAndValidate(`on:hippo ${commonText}`, []);
        searchAndValidate(`before:hippo ${commonText}`, []);
        searchAndValidate(`after:hippo ${commonText}`, []);
    });
});
