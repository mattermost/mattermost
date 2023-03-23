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
    getMsAndQueryForDate,
    getTestMessages,
    searchAndValidate,
    setupTestData,
} from './helpers';

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

    it('MM-T604 Use "on:" to return only results from today', () => {
        // create posts on a day at 11:59 the previous day, 12:00am the main day, 11:59pm the main day, and 12:00 the next day
        const identifier = 'christmas' + Date.now();

        const preTarget = getMsAndQueryForDate(Date.UTC(2018, 11, 24, 23, 59)); // December 24th, 2018 @ 11:59pm
        const targetAM = getMsAndQueryForDate(Date.UTC(2018, 11, 25, 0, 0)); // December 25th, 2018 @ 12:00am
        const targetPM = getMsAndQueryForDate(Date.UTC(2018, 11, 25, 23, 59)); // December 25th, 2018 @ 11:59pm
        const postTarget = getMsAndQueryForDate(Date.UTC(2018, 11, 26, 0, 0)); // December 26th, 2018 @ 12:00am

        const targetAMMessage = 'targetAM ' + identifier;
        const targetPMMessage = 'targetPM ' + identifier;

        // Post same message at different times
        cy.getCurrentChannelId().then((channelId) => {
            cy.postMessageAs({sender: admin, message: 'pretarget ' + identifier, channelId, createAt: preTarget.ms});
            cy.postMessageAs({sender: admin, message: targetAMMessage, channelId, createAt: targetAM.ms});
            cy.postMessageAs({sender: admin, message: targetPMMessage, channelId, createAt: targetPM.ms});
            cy.postMessageAs({sender: admin, message: 'postTarget' + identifier, channelId, createAt: postTarget.ms});
        });

        // * Verify we only see messages from the expected date, and not outside of it
        searchAndValidate(`on:${targetAM.query} ${identifier}`, [targetPMMessage, targetAMMessage]);
    });
});
