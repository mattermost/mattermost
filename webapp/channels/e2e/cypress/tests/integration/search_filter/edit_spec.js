// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @search_date_filter

import {getAdminAccount} from '../../support/env';

import {
    getMsAndQueryForDate,
    getTestMessages,
    searchAndValidate,
    setupTestData,
} from './helpers';

describe('Search Date Filter', () => {
    const testData = getTestMessages();
    const admin = getAdminAccount();
    let anotherAdmin;
    let channelUrl;
    let channelId;

    before(() => {
        cy.apiInitSetup({userPrefix: 'other-admin'}).
            then(({team, channel, user, channelUrl: url}) => {
                anotherAdmin = user;
                channelUrl = url;
                channelId = channel.id;

                // # Visit test channel
                cy.visit(channelUrl);

                setupTestData(testData, {team, channel, admin, anotherAdmin});
            });
    });

    beforeEach(() => {
        cy.reload();
        cy.postMessage(Date.now());
    });

    it('MM-T599 Edit date and search again', () => {
        // # Create expected data
        const targetMessage = 'calendarUpdate' + Date.now();
        const targetDate = getMsAndQueryForDate(Date.UTC(2019, 0, 15, 9, 30));

        // # Post message with unique text
        cy.postMessageAs({sender: admin, message: targetMessage, channelId, createAt: targetDate.ms});

        // # Set clock to custom date and visit test channel like reloading a page to take effect
        cy.clock(targetDate.ms, ['Date']);
        cy.reload();

        // # Type on: into search field
        cy.uiGetSearchBox().click().clear().type('on:');

        // * Day picker should appear
        cy.get('.DayPicker').
            as('dayPicker').
            should('be.visible');

        // # Click on today's date
        cy.get('@dayPicker').
            find('.DayPicker-Day--today').click();

        // * Search field should populate with the correct date, then send rest of query
        cy.uiGetSearchBox().
            should('have.value', 'on:2019-01-15 ').
            click().
            type(`${targetMessage}{enter}`).
            should('be.empty');

        cy.get('#loadingSpinner').should('not.exist');

        // * Verify we see our single result
        cy.uiGetRHSSearchContainer().
            findAllByTestId('search-item-container').
            should('be.visible').
            and('have.length', 1).
            find('.post-message').
            should('have.text', targetMessage);

        // # Visit test channel to reload a page
        cy.visit(channelUrl);
        cy.postMessage(Date.now());

        // # Back space right after the date to bring up date picker again
        cy.uiGetSearchBox().click().clear().
            type(`on:2019-01-15 ${targetMessage}`).
            type('{leftarrow}'.repeat(targetMessage.length + 1)).
            type('{backspace}');

        // * Day picker should be visible
        cy.get('@dayPicker').should('be.visible');

        // # Click on tomorrow's day
        cy.get('@dayPicker').
            find('.DayPicker-Day--today').
            next('.DayPicker-Day').click();

        // # Add message to search for, and hit enter
        cy.uiGetSearchBox().
            should('have.value', `on:2019-01-16  ${targetMessage}`).
            click().
            type('{enter}').
            should('be.empty');

        cy.get('#loadingSpinner').should('not.exist');

        // * There should be no results
        cy.uiGetRHSSearchContainer().
            findAllByTestId('search-item-container').
            should('have.length', 0);
    });

    it('MM-T595 Changing timezone changes day search results appears', () => {
        const identifier = 'timezone' + Date.now();

        const target = getMsAndQueryForDate(Date.UTC(2018, 9, 31, 23, 59));

        const targetMessage = 'targetAM ' + identifier;

        // # Post message with unique text
        cy.postMessageAs({sender: admin, message: targetMessage, channelId, createAt: target.ms});

        // * Verify result appears in current timezone
        searchAndValidate(`on:${target.query} ${identifier}`, [targetMessage]);

        // # Change timezone to alter what posts appear in results
        changeTimezone('Europe/Brussels');

        // * With same query, no results should appear
        searchAndValidate(`on:${target.query} ${identifier}`);
    });
});

function changeTimezone(timezone) {
    cy.apiPatchMe({timezone: {automaticTimezone: '', manualTimezone: timezone, useAutomaticTimezone: 'false'}});
}
