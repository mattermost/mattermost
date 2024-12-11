// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';

/**
 * permission can be 'granted', 'denied', or 'default'
 */
function stubNotificationPermission(permission: string) {
    cy.window().then((win) => {
        cy.stub(win.Notification, 'permission').value(permission);
        cy.stub(win.Notification, 'requestPermission').resolves(permission);
        cy.stub(win, 'Notification').as('notificationStub').callsFake(() => {
            return {
                onclick: cy.stub().as('notificationOnClick'),
                onerror: cy.stub().as('notificationOnError'),
            };
        });
    });
}

/**
 * Verify the system bot message was received
 */
function notificationMessage(notificationMessage: string) {
    // * Assert the unread count is correct
    cy.get('.SidebarLink:contains(system-bot)').find('#unreadMentions').as('unreadCount').should('be.visible').should('have.text', '1');
    cy.get('.SidebarLink:contains(system-bot)').find('.Avatar').should('exist').click().wait(TIMEOUTS.HALF_SEC);
    cy.get('@unreadCount').should('not.exist');

    // * Assert the notification message
    cy.getLastPostId().then((postId) => {
        cy.get(`#postMessageText_${postId}`).scrollIntoView().should('be.visible').should('have.text', notificationMessage);
    });
}

Cypress.Commands.add('stubNotificationPermission', stubNotificationPermission);
Cypress.Commands.add('verifySystemBotMessageRecieved', notificationMessage);
