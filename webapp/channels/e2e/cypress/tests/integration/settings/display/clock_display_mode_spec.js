// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @account_setting

import moment from 'moment-timezone';

import * as DATE_TIME_FORMAT from '../../../fixtures/date_time_format';

describe('Settings > Display > Clock Display Mode', () => {
    const mainMessage = 'Test for clock display mode';
    const replyMessage1 = 'Reply 1 for clock display mode';
    const replyMessage2 = 'Reply 2 for clock display mode';

    let testTeam;
    let testChannel;

    before(() => {
        // # Enable Timezone
        cy.apiUpdateConfig({
            DisplaySettings: {
                ExperimentalTimezone: true,
            },
        });

        // # Login as new user, visit off-topic and post a message
        cy.apiInitSetup({loginAfter: true}).then(({team, channel, offTopicUrl}) => {
            testTeam = team;
            testChannel = channel;

            cy.visit(offTopicUrl);
            cy.postMessage(mainMessage);

            // # Open RHS and post two consecutive replies
            cy.clickPostCommentIcon();
            [replyMessage1, replyMessage2].forEach((message) => {
                cy.postMessageReplyInRHS(message);
            });
        });
    });

    it('MM-T2098 Clock display mode setting to "12-hour clock"', () => {
        // # Set clock display to 12-hour
        setClockDisplayTo12Hour();

        // * Verify clock format is 12-hour for main message
        cy.getNthPostId(1).then((postId) => {
            verifyClockFormatIs12HourForPostWithMessage(postId, mainMessage, true);
        });

        // * Verify clock format is 12-hour for reply message 1
        cy.getNthPostId(-2).then((postId) => {
            verifyClockFormatIs12HourForPostWithMessage(postId, replyMessage1, false);
        });

        // * Verify clock format is 12-hour for reply message 2
        cy.getNthPostId(-1).then((postId) => {
            verifyClockFormatIs12HourForPostWithMessage(postId, replyMessage2, false);
        });
    });

    it('MM-T2096_1 Clock Display - Can switch from 12-hr to 24-hr', () => {
        // # Set clock display to 24-hour
        setClockDisplayTo24Hour();

        // * Verify clock format is 24-hour for main message
        cy.getNthPostId(1).then((postId) => {
            verifyClockFormatIs24HourForPostWithMessage(postId, mainMessage);
        });

        // * Verify clock format is 24-hour for reply message 1
        cy.getNthPostId(-2).then((postId) => {
            verifyClockFormatIs24HourForPostWithMessage(postId, replyMessage1);
        });

        // * Verify clock format is 24-hour for reply message 2
        cy.getNthPostId(-1).then((postId) => {
            verifyClockFormatIs24HourForPostWithMessage(postId, replyMessage2);
        });
    });

    it('MM-T2096_2 Clock Display - 24-hr - post message after 1pm', () => {
        cy.apiAdminLogin().then(({user}) => {
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Set clock display to 24-hour
            setClockDisplayTo24Hour();

            // # Post a message with time after 1pm
            const now = new Date();
            const nextYear = now.getFullYear() + 1;
            const futureDate = Date.UTC(nextYear, 0, 5, 14, 37); // Jan 5, 2:37pm
            cy.postMessageAs({sender: user, message: 'Hello from Jan 5, 2:37pm', channelId: testChannel.id, createAt: futureDate});

            // * Message posted shows timestamp in 24-hour format, e.g. 14:37
            cy.getLastPost().
                find('time').
                should('contain', '14:37').
                and('have.attr', 'datetime', `${nextYear}-01-05T14:37:00.000`);
        });
    });
});

function navigateToClockDisplaySettings() {
    // # Go to Settings modal - Display section
    cy.uiOpenSettingsModal('Display');

    // # Click the display tab
    cy.get('#displayButton').should('be.visible').click();

    // # Click "Edit" to the right of "Clock Display"
    cy.get('#clockEdit').
        scrollIntoView().
        should('be.visible').
        click();

    // # Scroll a bit to show the "Save" button
    cy.get('.section-max').
        should('be.visible').
        scrollIntoView();
}

function setClockDisplayTo(clockFormat) {
    // # Navigate to Clock Display Settings
    navigateToClockDisplaySettings();

    // # Click the radio button and verify checked
    cy.get(`#${clockFormat}`).
        should('be.visible').
        click({force: true}).
        should('be.checked');

    // # Click Save button
    cy.uiSave();

    // * Verify clock description
    if (clockFormat === 'clockFormatA') {
        cy.get('#clockDesc').should('have.text', '12-hour clock (example: 4:00 PM)');
    } else {
        cy.get('#clockDesc').should('have.text', '24-hour clock (example: 16:00)');
    }

    // # Close Settings modal
    cy.uiClose();
}

function setClockDisplayTo12Hour() {
    setClockDisplayTo('clockFormatA');
}

function setClockDisplayTo24Hour() {
    setClockDisplayTo('clockFormatB');
}

function verifyClockFormat(timeFormat, isVisible) {
    cy.get('time').first().then(($timeEl) => {
        cy.wrap($timeEl).invoke('attr', 'datetime').then((dateTimeString) => {
            const formattedTime = moment(dateTimeString).format(timeFormat);
            cy.wrap($timeEl).should(isVisible ? 'be.visible' : 'exist').and('have.text', formattedTime);
        });
    });
}

function verifyClockFormatIs12Hour(isVisible) {
    verifyClockFormat(DATE_TIME_FORMAT.TIME_12_HOUR, isVisible);
}

function verifyClockFormatIs24Hour(isVisible) {
    verifyClockFormat(DATE_TIME_FORMAT.TIME_24_HOUR, isVisible);
}

function verifyClockFormatIs12HourForPostWithMessage(postId, message, isVisible) {
    // * Verify clock format is 12-hour in center channel within the post
    cy.get(`#post_${postId}`).within(() => {
        cy.get('.post-message__text').should('have.text', message);
        verifyClockFormatIs12Hour(isVisible);
    });

    // * Verify clock format is 12-hour in RHS within the RHS post
    cy.get(`#rhsPost_${postId}`).within(() => {
        cy.get('.post-message__text').should('have.text', message);
        verifyClockFormatIs12Hour(isVisible);
    });
}

function verifyClockFormatIs24HourForPostWithMessage(postId, message, isVisible) {
    // * Verify clock format is 24-hour in center channel within the post
    cy.get(`#post_${postId}`).within(() => {
        cy.get('.post-message__text').should('have.text', message);
        verifyClockFormatIs24Hour(isVisible);
    });

    // * Verify clock format is 24-hour in RHS within the RHS post
    cy.get(`#rhsPost_${postId}`).within(() => {
        cy.get('.post-message__text').should('have.text', message);
        verifyClockFormatIs24Hour(isVisible);
    });
}
