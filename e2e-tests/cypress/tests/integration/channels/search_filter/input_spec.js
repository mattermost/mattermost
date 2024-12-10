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
import * as TIMEOUTS from '../../../fixtures/timeouts';

import {
    getTestMessages,
    searchAndValidate,
    setupTestData,
} from './helpers';

describe('Search Date Filter', () => {
    const testData = getTestMessages();
    const {
        commonText,
        allMessagesInOrder,
        todayMessage,
        firstMessage,
    } = testData;
    const admin = getAdminAccount();
    let anotherAdmin;

    before(() => {
        cy.apiInitSetup({userPrefix: 'other-admin'}).then(({team, channel, channelUrl, user}) => {
            anotherAdmin = user;

            // # Visit test channel
            cy.visit(channelUrl);

            setupTestData(testData, {team, channel, admin, anotherAdmin});
        });
    });

    it('MM-T585_1 Unfiltered search for all posts is not affected', () => {
        searchAndValidate(commonText, allMessagesInOrder);
    });

    it('MM-T585_2 Unfiltered search for recent post is not affected', () => {
        searchAndValidate(todayMessage, [todayMessage]);
    });

    it.skip('MM-T596 Use calendar picker to set date', () => {
        const today = Cypress.dayjs().format('YYYY-MM-DD');

        // # Type before: in search field
        cy.uiGetSearchContainer().should('be.visible').click();
        cy.uiGetSearchBox().first().clear().type('before:');

        // * Day picker should be visible
        cy.get('.rdp').
            as('dayPicker').
            should('be.visible');

        // # Select today's day
        cy.get('@dayPicker').
            find('.rdp-day_today').click();

        cy.get('@dayPicker').should('not.exist');

        // * Verify date picker output gets put into field as expected date
        cy.uiGetSearchBox().should('have.value', `before:${today} `);

        // # Click "x" to the right of the search term
        cy.uiGetSearchBox().parent('.input-wrapper').siblings('.input-clear-x').click({force: true});

        // * The "x" to clear the search query has disappeared
        cy.uiGetSearchBox().first().should('have.value', '');

        cy.uiGetSearchContainer().should('be.visible').click();
    });

    it.skip('MM-T3997 Backspace after last character of filter makes calendar reappear', () => {
        const today = Cypress.dayjs().format('YYYY-MM-DD');

        // # Type before: in search field
        cy.uiGetSearchContainer().should('be.visible').click();
        cy.uiGetSearchBox().first().clear().type('before:');

        // * Date picker should be visible
        cy.get('.rdp').
            as('dayPicker').
            should('be.visible');

        // # Select today's day
        cy.get('@dayPicker').
            find('.rdp-day_today').click();

        // * Date picker should disappear
        cy.get('@dayPicker').should('not.exist');

        // # Hit backspace with focus right after the date
        cy.uiGetSearchBox().
            should('have.value', `before:${today} `).
            focus().
            type('{backspace}');

        // * Day picker should reappear
        cy.get('@dayPicker').should('be.visible');
    });

    it.skip('MM-T598 Dates work without leading 0 for date and month', () => {
        // These must match the date of the firstMessage, only altering leading zeroes
        const testCases = [
            {name: 'day', date: '2018-06-5'},
            {name: 'month', date: '2018-6-05'},
            {name: 'month and date', date: '2018-6-5'},
        ];

        testCases.forEach((test) => {
            cy.reload();
            searchAndValidate(`on:${test.date} "${firstMessage}"`, [firstMessage]);
        });
    });

    it.skip('MM-T601 Remove date filter with keyboard', () => {
        const queryString = `on:${Cypress.dayjs().format('YYYY-MM-DD')} ${commonText}`;

        // * Filter can be removed with keyboard
        cy.uiGetSearchContainer().should('be.visible').click();
        cy.uiGetSearchBox().
            clear().
            wait(TIMEOUTS.HALF_SEC).
            type(queryString).
            type('{backspace}'.repeat(queryString.length)).
            should('have.value', '');

        // # Enter query to search box and then click "x" to the right of the search term
        cy.uiGetSearchBox().first().clear().wait(TIMEOUTS.HALF_SEC).type(queryString);
        cy.uiGetSearchBox().parent('.input-wrapper').siblings('.input-clear-x').click({force: true});

        // * The "x" to clear the search query has disappeared
        cy.uiGetSearchBox().should('have.value', '');
    });
});
