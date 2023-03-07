// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// # Indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

import * as TIMEOUTS from '../../fixtures/timeouts';
import {getRandomId} from '../../utils';

export function visitTownSquareAndWaitForPageToLoad() {
    // # Click town-square at LHS and wait for post list to load
    cy.get('#sidebarItem_town-square').should('be.visible').click();
    cy.get('#channelHeaderTitle').should('be.visible').and('have.text', 'Town Square');
    cy.findAllByTestId('postView').should('be.visible');
}

export function scrollUpAndPostAMessage(sender, channelId, nTimes = 1) {
    scrollUp();

    // # Post number of messages
    const randomId = getRandomId();
    Cypress._.times(nTimes, (num) => {
        cy.postMessageAs({sender, message: `${num} ${randomId}`, channelId});
    });
}

export function scrollDown() {
    // # Scroll down
    cy.get('div.post-list__dynamic').should('be.visible').
        scrollTo('bottom', {duration: TIMEOUTS.ONE_SEC}).
        wait(TIMEOUTS.ONE_SEC);
}

export function scrollUp() {
    // # Scroll up so bottom is not visible
    cy.get('div.post-list__dynamic').should('be.visible').
        scrollTo(0, '70%', {duration: TIMEOUTS.ONE_SEC}).
        wait(TIMEOUTS.ONE_SEC);
}

export function scrollToTop() {
    // # Scroll up so bottom is not visible
    cy.get('div.post-list__dynamic').should('be.visible').
        scrollTo(0, 0, {duration: TIMEOUTS.ONE_SEC}).
        wait(TIMEOUTS.ONE_SEC);
}
