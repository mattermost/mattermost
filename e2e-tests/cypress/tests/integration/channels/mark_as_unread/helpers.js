// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../fixtures/timeouts';

export function markAsUnreadFromPost(post, rhs = false) {
    const prefix = rhs ? 'rhsPost' : 'post';

    cy.get(`#${prefix}_${post.id}`).scrollIntoView().should('be.visible');

    cy.get('body').type('{alt}', {release: false});
    cy.get(`#${prefix}_${post.id}`).click({force: true});
    cy.get('body').type('{alt}', {release: true});
}

export function markAsUnreadShouldBeAbsent(postId, prefix = 'post', location = 'CENTER') {
    cy.get(`#${prefix}_${postId}`).trigger('mouseover');
    cy.clickPostDotMenu(postId, location);
    cy.get(`#CENTER_dropdown_${postId}`).
        should('be.visible').
        within(() => {
            cy.findByText('Mark as Unread').should('not.exist');
        });
    cy.get('body').type('esc');
}

export function switchToChannel(channel) {
    cy.get(`#sidebarItem_${channel.name}`).click();

    cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('contain', channel.display_name);

    // # Wait some time for the channel to set state
    cy.wait(TIMEOUTS.HALF_SEC);
}

export function verifyPostNextToNewMessageSeparator(message) {
    cy.get('.NotificationSeparator').
        should('exist').
        parent().
        parent().
        parent().
        next().
        should('contain', message);
}

export function verifyTopSpaceForNewMessage(message) {
    cy.get('.post-row__padding.top').
        should('be.visible').
        should('contain', message);
}

export function verifyBottomSpaceForNewMessage(message) {
    cy.get('.post-row__padding.bottom').
        should('be.visible').
        should('contain', message);
}

export function showCursor(items) {
    cy.expect(items).to.have.length(1);
    expect(items[0].className).to.match(/cursor--pointer/);
}

export function notShowCursor(items) {
    cy.expect(items).to.have.length(1);
    expect(items[0].className).to.not.match(/cursor--pointer/);
}
