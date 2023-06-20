// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

import moment from 'moment-timezone';

import * as DATE_TIME_FORMAT from '../../../../fixtures/date_time_format';
import * as TIMEOUTS from '../../../../fixtures/timeouts';
import {getTimezoneLabel} from '../../../../utils/timezone';
import {getAdminAccount} from '../../../../support/env';

describe('Profile > Display > Timezone', () => {
    const sysadmin = getAdminAccount();

    const date1 = Date.UTC(2020, 0, 5, 4, 30); // Jan 5, 2020 04:30
    const date2 = Date.UTC(2020, 0, 5, 12, 30); // Jan 5, 2020 12:30
    const date3 = Date.UTC(2020, 0, 5, 20, 30); // Jan 5, 2020 20:30
    const date4 = Date.UTC(2020, 0, 6, 0, 30); // Jan 6, 2020 00:30

    const localTz = moment.tz.guess();
    const localTzLabel = getTimezoneLabel(localTz);
    const timezoneLocal = {type: 'Canonical', value: localTzLabel};

    const canonicalTz = 'Asia/Hong_Kong';
    const canonicalTzLabel = getTimezoneLabel(canonicalTz);
    const timezoneCanonical = {type: 'Canonical', value: canonicalTzLabel, expectedTz: canonicalTz};

    const utcTz = 'Europe/Lisbon';
    const utcTzLabel = getTimezoneLabel(utcTz);
    const timezoneUTC = {type: 'Default', value: utcTzLabel, expectedTz: 'UTC'};

    let userId;

    before(() => {
        // # Enable Timezone
        cy.apiUpdateConfig({
            DisplaySettings: {
                ExperimentalTimezone: true,
            },
        });

        // # Create and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({user, offTopicUrl}) => {
            userId = user.id;
            cy.visit(offTopicUrl);

            // # Post messages from the past
            [date1, date2, date3, date4].forEach((createAt, index) => {
                cy.getCurrentChannelId().then((channelId) => {
                    cy.postMessageAs({sender: sysadmin, message: `Hello from ${index}`, channelId, createAt});
                });
            });

            // # Post messages from now
            cy.postMessage('Hello from now');
        });
    });

    beforeEach(() => {
        // # Reload to re-arrange posts
        cy.reload();
    });

    it('MM-T301_1 Change timezone automatically', () => {
        const automaticTestCases = [
            {
                timezone: timezoneLocal,
                localTimes: [
                    {postIndex: 0, dateInTimezone: moment(date1).tz(timezoneLocal.value)},
                    {postIndex: 1, dateInTimezone: moment(date2).tz(timezoneLocal.value)},
                    {postIndex: 2, dateInTimezone: moment(date3).tz(timezoneLocal.value)},
                    {postIndex: 3, dateInTimezone: moment(date4).tz(timezoneLocal.value)},
                ],
            },
        ];

        automaticTestCases.forEach((testCase) => {
            // # Reset to manual
            cy.apiPatchMe({timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'}});

            // # Set timezone display to automatic
            setTimezoneDisplayToAutomatic(testCase.timezone.value);

            // # Save Clock Display Mode to 12-hour
            cy.apiSaveClockDisplayModeTo24HourPreference(false);

            // * Verify local time is timezone formatted 12-hour
            testCase.localTimes.forEach((localTime) => {
                verifyLocalTimeIsTimezoneFormatted12Hour(localTime);
            });

            // # Save Clock Display Mode to 24-hour
            cy.apiSaveClockDisplayModeTo24HourPreference(true);

            // * Verify local time is timezone formatted 24-hour
            testCase.localTimes.forEach((localTime) => {
                verifyLocalTimeIsTimezoneFormatted24Hour(localTime);
            });
        });
    });

    it('MM-T301_2 Change timezone manually', () => {
        const manualTestCases = [
            {
                timezone: timezoneCanonical,
                localTimes: [
                    {postIndex: 0, dateInTimezone: moment(date1).tz(timezoneCanonical.expectedTz)},
                    {postIndex: 1, dateInTimezone: moment(date2).tz(timezoneCanonical.expectedTz)},
                    {postIndex: 2, dateInTimezone: moment(date3).tz(timezoneCanonical.expectedTz)},
                    {postIndex: 3, dateInTimezone: moment(date4).tz(timezoneCanonical.expectedTz)},
                ],
            },
            {
                timezone: timezoneUTC,
                localTimes: [
                    {postIndex: 0, dateInTimezone: moment(date1).tz(timezoneUTC.expectedTz)},
                    {postIndex: 1, dateInTimezone: moment(date2).tz(timezoneUTC.expectedTz)},
                    {postIndex: 2, dateInTimezone: moment(date3).tz(timezoneUTC.expectedTz)},
                    {postIndex: 3, dateInTimezone: moment(date4).tz(timezoneUTC.expectedTz)},
                ],
            },
        ];

        manualTestCases.forEach((testCase) => {
            // # Reset to automatic
            cy.apiPatchMe({timezone: {automaticTimezone: '', manualTimezone: '', useAutomaticTimezone: 'true'}});

            // # Set timezone display to manual
            setTimezoneDisplayToManual(testCase.timezone.value);

            // # Save Clock Display Mode to 12-hour
            cy.apiSaveClockDisplayModeTo24HourPreference(false);

            // * Verify local time is timezone formatted 12-hour
            testCase.localTimes.forEach((localTime) => {
                verifyLocalTimeIsTimezoneFormatted12Hour(localTime);
            });

            // # Save Clock Display Mode to 24-hour
            cy.apiSaveClockDisplayModeTo24HourPreference(true);

            // * Verify local time is timezone formatted 24-hour
            testCase.localTimes.forEach((localTime) => {
                verifyLocalTimeIsTimezoneFormatted24Hour(localTime);
            });
        });

        verifyUnchangedTimezoneOnInvalidInput(userId);
    });
});

function navigateToTimezoneDisplaySettings() {
    // # Go to Display section of Settings
    cy.uiOpenSettingsModal('Display');

    // # Click "Edit" to the right of "Timezone"
    cy.get('#timezoneEdit').should('be.visible').click();

    // # Scroll a bit to show the "Save" button
    cy.get('.section-max').should('be.visible').scrollIntoView();
}

function setTimezoneDisplayTo(isAutomatic, value) {
    // # Navigate to Timezone Display Settings
    navigateToTimezoneDisplaySettings();

    // # Uncheck the automatic timezone checkbox and verify unchecked
    cy.get('.setting-list-item').as('settingItems');
    cy.get('@settingItems').find('#automaticTimezoneInput').should('be.visible').uncheck().should('be.not.checked');

    // * Verify Change timezone is enabled
    cy.get('@settingItems').find('#displayTimezone').should('be.visible').find('input').as('changeTimezone').should('be.enabled');
    if (isAutomatic) {
        // # Check automatic timezone checkbox and verify checked
        cy.get('@settingItems').find('#automaticTimezoneInput').check().should('be.checked');

        // * Verify timezone text is visible
        cy.get('@changeTimezone').invoke('text').then((timezoneDesc) => {
            expect(value.replace('_', ' ')).to.contain(timezoneDesc);
        });

        // * Verify Change timezone is disabled
        cy.get('@changeTimezone').should('be.disabled');
    } else {
        // # Manually type new timezone
        cy.get('@changeTimezone').typeWithForce(`${value}{enter}`);
    }

    // # Click Save button
    cy.uiSave();

    // * Verify timezone description is correct
    cy.get('#timezoneDesc').should('be.visible').invoke('text').then((timezoneDesc) => {
        expect(value.replace('_', ' ')).to.contain(timezoneDesc);
    });

    // # Close Settings modal
    cy.get('#accountSettingsHeader > .close').should('be.visible').click();
}

function setTimezoneDisplayToAutomatic(value) {
    setTimezoneDisplayTo(true, value);
}

function setTimezoneDisplayToManual(value) {
    setTimezoneDisplayTo(false, value);
}

function verifyLocalTimeIsTimezoneFormatted(localTime, timeFormat) {
    // * Verify that the local time of each post is in timezone format
    const formattedTime = localTime.dateInTimezone.format(timeFormat);
    cy.findAllByTestId('postView', {timeout: TIMEOUTS.ONE_MIN}).
        eq(localTime.postIndex).find('time', {timeout: TIMEOUTS.HALF_SEC}).
        should('have.text', formattedTime);
}

function verifyLocalTimeIsTimezoneFormatted12Hour(localTime) {
    verifyLocalTimeIsTimezoneFormatted(localTime, DATE_TIME_FORMAT.TIME_12_HOUR);
}

function verifyLocalTimeIsTimezoneFormatted24Hour(localTime) {
    verifyLocalTimeIsTimezoneFormatted(localTime, DATE_TIME_FORMAT.TIME_24_HOUR);
}

function verifyUnchangedTimezoneOnInvalidInput(userId) {
    // # Get current user's timezone
    cy.apiGetMe(userId).then(({user: {timezone}}) => {
        // # Navigate to Timezone Display Settings
        navigateToTimezoneDisplaySettings();

        // # Uncheck the automatic timezone checkbox and verify unchecked
        cy.get('.setting-list-item').as('settingItems');
        cy.get('@settingItems').find('#automaticTimezoneInput').should('be.visible').uncheck().should('be.not.checked');

        // * Enter invalid input as timezone
        cy.get('@settingItems').find('#displayTimezone').find('input').
            should('be.enabled').
            typeWithForce('invalid');

        // # Click save
        cy.uiSave();

        // * Verify that the timezone is unchanged
        cy.get('#timezoneDesc').should('be.visible').invoke('text').then((timezoneDesc) => {
            expect(getTimezoneLabel(timezone.manualTimezone)).to.equal(timezoneDesc);
        });
    });
}
