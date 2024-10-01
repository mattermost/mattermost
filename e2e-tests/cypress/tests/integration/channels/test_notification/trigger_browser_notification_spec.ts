// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @account_settings

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {isPermissionAllowed} from 'cypress-browser-permissions';

declare global {
    namespace Cypress {
        interface Chainable {
            stubNotifications(): Chainable<void>;
        }
    }
}

Cypress.Commands.add('stubNotifications', () => {
    cy.window().then((win) => {
        cy.stub(win, 'Notification').as('notificationStub').callsFake(() => {
            return {
                onclick: cy.stub().as('notificationOnClick'),
                onerror: cy.stub().as('notificationOnError'),
            };
        });
    });
});

describe('Verify users can recieve notification on browser', () => {
    let offTopic: string;
    let permissionAllowed = false;

    before(() => {
        // Check if notification permissions are allowed
        permissionAllowed = isPermissionAllowed('notifications');

        cy.apiInitSetup({userPrefix: 'other', loginAfter: true}).then(({offTopicUrl}) => {
            offTopic = offTopicUrl;
        });
    });

    it('should be able to recieve notification when notifications are enabled on the browser', function() {
        if (!permissionAllowed) {
            this.skip(); // Skip the test if permission is not allowed
        }

        cy.visit(offTopic);
        cy.stubNotifications();

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
        verifySystemBotMessageRecieved();
    });

    it('should not be able to receive notification when notifications are disabled on the browser', function() {
        if (permissionAllowed) {
            this.skip(); // Skip the test if permission is allowed
        }

        cy.visit(offTopic);
        cy.stubNotifications();

        cy.get('#CustomizeYourExperienceTour > button').click();
        cy.get('.sectionNoticeContent').scrollIntoView().should('be.visible');
        cy.get('.btn-tertiary').should('be.visible').should('have.text', 'Troubleshooting docs');
        cy.get('.btn-primary').should('be.visible').should('have.text', 'Send a test notification').click();

        // Assert that the Notification constructor was not called
        cy.get('@notificationStub').should('not.be.called');

        cy.get('#accountSettingsHeader button.close').click();

        verifySystemBotMessageRecieved();
    });
});

function verifySystemBotMessageRecieved() {
    // * Assert the unread count is correct
    cy.get('.SidebarLink:contains(system-bot)').find('#unreadMentions').as('unreadCount').should('be.visible').should('have.text', '1');
    cy.get('.SidebarLink:contains(system-bot)').find('.Avatar').should('exist').click().wait(TIMEOUTS.HALF_SEC);
    cy.get('@unreadCount').should('not.exist');

    // * Assert the notification message
    cy.getLastPostId().then((postId) => {
        cy.get(`#postMessageText_${postId}`).scrollIntoView().should('be.visible').should('have.text', 'app.notifications.test_message');
    });
}

