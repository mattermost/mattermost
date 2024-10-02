// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @account_settings

/* eslint-disable @typescript-eslint/no-namespace */ // temp change

import * as TIMEOUTS from '../../../fixtures/timeouts';

declare global {
    namespace Cypress {
        interface Chainable {
            stubNotificationPermission(permission: string): Chainable<void>;
            verifySystemBotMessageRecieved(): Chainable<void>;
        }
    }
}

/**
 * permission can be 'granted', 'denied', or 'default'
 */
Cypress.Commands.add('stubNotificationPermission', (permission) => {
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
});

/**
 * Verify the system bot message was received
 */
Cypress.Commands.add('verifySystemBotMessageRecieved', () => {
    // * Assert the unread count is correct
    cy.get('.SidebarLink:contains(system-bot)').find('#unreadMentions').as('unreadCount').should('be.visible').should('have.text', '1');
    cy.get('.SidebarLink:contains(system-bot)').find('.Avatar').should('exist').click().wait(TIMEOUTS.HALF_SEC);
    cy.get('@unreadCount').should('not.exist');

    // * Assert the notification message
    cy.getLastPostId().then((postId) => {
        cy.get(`#postMessageText_${postId}`).scrollIntoView().should('be.visible').should('have.text', 'app.notifications.test_message');
    });
});

describe('Verify users can receive notification on browser', () => {
    let offTopic: string;

    before(() => {
        cy.apiInitSetup({userPrefix: 'other', loginAfter: true}).then(({offTopicUrl}) => {
            offTopic = offTopicUrl;
        });
    });

    it('should be able to receive notification when notifications are enabled on the browser', () => {
        cy.visit(offTopic);
        cy.stubNotificationPermission('granted');
        cy.get('#CustomizeYourExperienceTour > button').click();
        cy.get('.sectionNoticeContent').scrollIntoView().should('be.visible');
        cy.get('.btn-tertiary').should('be.visible').should('have.text', 'Troubleshooting docs');
        cy.get('.btn-primary').should('be.visible').should('have.text', 'Send a test notification').click();
        cy.get('@notificationStub').should('be.called');
        cy.get('@notificationStub').should((stub) => {
            expect(stub).to.have.been.calledWithMatch(
                'Direct Message',
                Cypress.sinon.match({
                    body: '@@system-bot: app.notifications.test_message',
                    tag: '@@system-bot: app.notifications.test_message',
                    requireInteraction: false,
                    silent: false,
                }),
            );
        });
        cy.get('#accountSettingsHeader button.close').click();
        cy.verifySystemBotMessageRecieved();
    });

    it('should not be able to receive notification when notifications are denied on the browser', () => {
        cy.visit(offTopic);
        cy.stubNotificationPermission('denied');
        cy.get('#CustomizeYourExperienceTour > button').click();
        cy.get('.sectionNoticeContent').scrollIntoView().should('be.visible');
        cy.get('.btn-tertiary').should('be.visible').should('have.text', 'Troubleshooting docs');
        cy.get('.btn-primary').should('be.visible').should('have.text', 'Send a test notification').click();

        // Assert that the Notification constructor was not called
        cy.get('@notificationStub').should('not.be.called');
        cy.get('#accountSettingsHeader button.close').click();
        cy.verifySystemBotMessageRecieved();
    });

    it('should not trigger notification when permission is default (no decision made)', () => {
        cy.visit(offTopic);
        cy.stubNotificationPermission('default');
        cy.get('#CustomizeYourExperienceTour > button').click();
        cy.get('.sectionNoticeContent').scrollIntoView().should('be.visible');
        cy.get('.btn-tertiary').should('be.visible').should('have.text', 'Troubleshooting docs');
        cy.get('.btn-primary').should('be.visible').should('have.text', 'Send a test notification').click();

        // Assert that the Notification constructor was not called
        cy.get('@notificationStub').should('not.be.called');
        cy.get('#accountSettingsHeader button.close').click();
        cy.verifySystemBotMessageRecieved();
    });

    // Simulating macOS Focus Mode by suppressing the Notification constructor entirely
    it('should not show notification when Focus Mode is enabled (simulating no notification pop-up)', () => {
        cy.visit(offTopic);
        cy.stubNotificationPermission('granted');

        cy.window().then((win) => {
            win.Notification = function() {
                // Do nothing to simulate Focus Mode
            };

            cy.stub(win, 'Notification').as('notificationStub').callsFake(() => {
                return null; // Prevent the notification from being created
            });
        });

        cy.get('#CustomizeYourExperienceTour > button').click();
        cy.get('.sectionNoticeContent').scrollIntoView().should('be.visible');
        cy.get('.btn-tertiary').should('be.visible').should('have.text', 'Troubleshooting docs');
        cy.get('.btn-primary').should('be.visible').should('have.text', 'Send a test notification').click();

        // Assert that the Notification constructor was not called in macOS Focus Mode
        cy.get('@notificationStub').should('not.be.called'); // Should not be called at all
        cy.get('#accountSettingsHeader button.close').click();
        cy.verifySystemBotMessageRecieved();
    });
});
