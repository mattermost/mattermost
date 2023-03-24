// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console @not_cloud

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('System Console > Site Statistics', () => {
    let testUser;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        cy.apiInitSetup({loginAfter: true}).then(({user, offTopicUrl}) => {
            // # Login as test user and visit off-topic
            testUser = user;
            cy.visit(offTopicUrl);

            // # Post a message as testUser to make them daily/monthly active
            cy.postMessage('New Daily Message');
        });
    });

    it('MM-T903 - Site Statistics > Deactivating a user increments the Daily and Monthly Active Users counts down', () => {
        let totalActiveUsersInitial;
        let dailyActiveUsersInitial;
        let monthlyActiveUsersInitial;
        let totalActiveUsersFinal;
        let dailyActiveUsersFinal;
        let monthlyActiveUsersFinal;

        // # Go to admin console
        cy.apiAdminLogin();
        cy.visit('/admin_console');

        // # Go to system analytics
        cy.findByTestId('reporting.system_analytics', {timeout: TIMEOUTS.ONE_MIN}).click();
        cy.wait(TIMEOUTS.ONE_SEC);

        // # Get the number text and turn them into numbers
        cy.findByTestId('totalActiveUsers').invoke('text').then((totalActiveText) => {
            totalActiveUsersInitial = parseInt(totalActiveText, 10);
        });
        cy.findByTestId('dailyActiveUsers').invoke('text').then((dailyActiveText) => {
            dailyActiveUsersInitial = parseInt(dailyActiveText, 10);
        });
        cy.findByTestId('monthlyActiveUsers').invoke('text').then((monthlyActiveText) => {
            monthlyActiveUsersInitial = parseInt(monthlyActiveText, 10);

            // # Deactivate user and reload page and then wait 2 seconds
            cy.externalActivateUser(testUser.id, false);
            cy.reload();
            cy.wait(TIMEOUTS.TWO_SEC);
        });

        // # Get the numbers required again
        cy.findByTestId('totalActiveUsers').invoke('text').then((totalActiveFinalText) => {
            totalActiveUsersFinal = parseInt(totalActiveFinalText, 10);
        });
        cy.findByTestId('dailyActiveUsers').invoke('text').then((dailyActiveFinalText) => {
            dailyActiveUsersFinal = parseInt(dailyActiveFinalText, 10);
        });
        cy.findByTestId('monthlyActiveUsers').invoke('text').then((monthlyActiveFinalText) => {
            monthlyActiveUsersFinal = parseInt(monthlyActiveFinalText, 10);

            // * Assert that the final number is the initial number minus one
            expect(totalActiveUsersFinal).equal(totalActiveUsersInitial - 1);
            expect(dailyActiveUsersFinal).equal(dailyActiveUsersInitial - 1);
            expect(monthlyActiveUsersFinal).equal(monthlyActiveUsersInitial - 1);
        });
    });
});
