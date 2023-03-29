// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import {getAdminAccount} from '../../../support/env';

describe('Messaging', () => {
    const sysadmin = getAdminAccount();

    before(() => {
        // # Enable Timezone
        cy.apiUpdateConfig({
            DisplaySettings: {
                ExperimentalTimezone: true,
            },
        });

        // # Create and visit new channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);

            // # Post messages from the past
            [
                Date.UTC(2020, 0, 5, 4, 30), // Jan 5, 2020 04:30
                Date.UTC(2020, 0, 5, 12, 30), // Jan 5, 2020 12:30
                Date.UTC(2020, 0, 5, 20, 30), // Jan 5, 2020 20:30
                Date.UTC(2020, 0, 6, 0, 30), // Jan 6, 2020 00:30
            ].forEach((createAt, index) => {
                cy.postMessageAs({sender: sysadmin, message: `Hello from ${index}`, channelId: channel.id, createAt});
            });

            // # Post messages from now
            cy.postMessage('Hello from now');

            // # Reload to re-arrange posts
            cy.reload();
        });
    });

    it('MM-T713 Post time should render correct format and locale', () => {
        const testCases = [
            {
                name: 'in English',
                publicChannel: 'CHANNELS',
                locale: 'en',
                manualTimezone: 'UTC',
                localTimes: [
                    {postIndex: 0, standard: '4:30 AM', military: '04:30'},
                    {postIndex: 1, standard: '12:30 PM', military: '12:30'},
                    {postIndex: 2, standard: '8:30 PM', military: '20:30'},
                    {postIndex: 3, standard: '12:30 AM', military: '00:30'},
                ],
            },
            {
                name: 'in Spanish',
                publicChannel: 'CANALES',
                locale: 'es',
                manualTimezone: 'UTC',
                localTimes: [
                    {postIndex: 0, standard: '4:30 a. m.', military: '4:30'},
                    {postIndex: 1, standard: '12:30 p. m.', military: '12:30'},
                    {postIndex: 2, standard: '8:30 p. m.', military: '20:30'},
                    {postIndex: 3, standard: '12:30 a. m.', military: '0:30'},
                ],
            },
            {
                name: 'in react-intl unsupported timezone',
                publicChannel: 'CHANNELS',
                locale: 'en',
                manualTimezone: 'NZ-CHAT',
                localTimes: [
                    {postIndex: 0, standard: '6:15 PM', military: '18:15'},
                    {postIndex: 1, standard: '2:15 AM', military: '02:15'},
                    {postIndex: 2, standard: '10:15 AM', military: '10:15'},
                    {postIndex: 3, standard: '2:15 PM', military: '14:15'},
                ],
            },
        ];

        testCases.forEach((testCase) => {
            // # Standard time
            testCase.localTimes.forEach((localTime, index) => {
                // # Change user preference to 12-hour format
                cy.apiSaveClockDisplayModeTo24HourPreference(false);

                // # Set user locale and timezone
                setLocaleAndTimezone(testCase.locale, testCase.manualTimezone);

                // * Verify that the channel is loaded correctly based on locale
                cy.findByText(testCase.publicChannel).should('be.visible');

                // * Verify that the local time of each post is rendered in 12-hour format based on locale
                cy.findAllByTestId('postView').eq(index).find('.post__time', {timeout: 500}).should('have.text', localTime.standard);
            });

            // # Military time
            testCase.localTimes.forEach((localTime, index) => {
                // # Change user preference to 24-hour format
                cy.apiSaveClockDisplayModeTo24HourPreference(true);

                // # Set user locale and timezone
                setLocaleAndTimezone(testCase.locale, testCase.manualTimezone);

                // * Verify that the channel is loaded correctly based on locale
                cy.findByText(testCase.publicChannel).should('be.visible');

                // * Verify that the local time of each post is rendered in 24-hour format based on locale
                cy.findAllByTestId('postView').eq(index).find('.post__time', {timeout: 500}).should('have.text', localTime.military);
            });
        });
    });
});

function setLocaleAndTimezone(locale, manualTimezone) {
    cy.apiPatchMe({
        locale,
        timezone: {
            manualTimezone,
            automaticTimezone: '',
            useAutomaticTimezone: 'false',
        },
    });
}
