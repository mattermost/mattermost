// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @search_date_filter

import {
    getTestMessages,
    searchAndValidate,
    setupTestData,
} from './helpers';

import {getAdminAccount} from '@/support/env';

describe('Search Date Filter', () => {
    const testData = getTestMessages();
    const {
        commonText,
        firstDateEarly,
        secondDateEarly,
        secondMessage,
        secondOffTopicMessage,
    } = testData;
    const admin = getAdminAccount();
    let anotherAdmin;
    let channelName;

    before(() => {
        cy.apiInitSetup({userPrefix: 'other-admin'}).then(({team, channel, user, channelUrl}) => {
            anotherAdmin = user;
            channelName = channel.name;

            // # Visit test channel
            cy.visit(channelUrl);

            setupTestData(testData, {team, channel, admin, anotherAdmin});
        });
    });

    it('MM-T588 on: omits results before and after target date', () => {
        searchAndValidate(`on:${secondDateEarly.query} ${commonText}`, [secondOffTopicMessage, secondMessage]);
    });

    it('MM-T590_1 on: takes precedence over "before:"', () => {
        searchAndValidate(`before:${Cypress.dayjs().format('YYYY-MM-DD')} on:${secondDateEarly.query} ${commonText}`, [secondOffTopicMessage, secondMessage]);
    });

    it('MM-T590_2 on: takes precedence over "after:"', () => {
        searchAndValidate(`after:${firstDateEarly.query} on:${secondDateEarly.query} ${commonText}`, [secondOffTopicMessage, secondMessage]);
    });

    it('MM-T3994_1 on: can be used in conjunction with "in:"', () => {
        searchAndValidate(`on:${secondDateEarly.query} in:${channelName} ${commonText}`, [secondMessage]);
    });

    it('MM-T3994_2 on: can be used in conjunction with "from:"', () => {
        searchAndValidate(`on:${secondDateEarly.query} from:${anotherAdmin.username} ${commonText}`, [secondOffTopicMessage]);
    });

    it('MM-T3994_3 on: re-add "in:" in conjunction with "from:"', () => {
        searchAndValidate(`on:${secondDateEarly.query} in:${channelName} from:${anotherAdmin.username} ${commonText}`);
    });
});
