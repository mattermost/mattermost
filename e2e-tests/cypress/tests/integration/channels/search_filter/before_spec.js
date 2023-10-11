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
        secondDateEarly,
        firstMessage,
        firstOffTopicMessage,
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

    beforeEach(() => {
        cy.reload();
        cy.postMessage(Date.now());
    });

    it('MM-T586 before: omits results on and after target date', () => {
        searchAndValidate(`before:${secondDateEarly.query} ${commonText}`, [firstOffTopicMessage, firstMessage]);
    });

    it('MM-T591_1 before: can be used in conjunction with "in:"', () => {
        searchAndValidate(`before:${secondDateEarly.query} in:off-topic ${commonText}`, [firstOffTopicMessage]);
    });

    it('MM-T591_2 before: can be used in conjunction with "from:"', () => {
        searchAndValidate(`before:${secondDateEarly.query} from:${anotherAdmin.username} ${commonText}`, [firstMessage]);
    });

    it('MM-T591_3 before: re-add "in:" in conjunction with "from:"', () => {
        searchAndValidate(`before:${secondDateEarly.query} in:off-topic from:${anotherAdmin.username} ${commonText}`);
    });
});
