// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @account_settings

import * as TIMEOUTS from '../../../fixtures/timeouts';
import { isPermissionAllowed, isPermissionBlocked, isPermissionAsk } from 'cypress-browser-permissions'

describe('Verify users can recieve notification on browser', () => {
    let testUser: Cypress.UserProfile;
    let testTeam: Cypress.Team;
    let offTopic: string;

    before(function() {
        if (isPermissionAllowed('notifications')) {
            cy.apiInitSetup({userPrefix: 'other', loginAfter: true}).then(({offTopicUrl, user, team}) => {
                offTopic = offTopicUrl;
                testUser = user;
                testTeam = team;
            });
        } else {
            // If not allowed, skip the test and log the message
            cy.log('Notification permissions are not allowed. Enable browser notifications settings.');
            this.skip();
        }
    });

    it('should be able to recieve notification when notifications are enabled on the browser', () => {
        cy.visit(offTopic, {
            onBeforeLoad(win) {
                cy.stub(win.Notification, 'requestPermission').resolves('granted');
                cy.stub(win, 'Notification').as('Notification');
            },
        });
        cy.get('#CustomizeYourExperienceTour > button').click();
        cy.get('.sectionNoticeContent').scrollIntoView().should('be.visible');
        cy.get('.btn-tertiary').should('be.visible').should('have.text', 'Troubleshooting docs');
        cy.get('.btn-primary').should('be.visible').should('have.text', 'Send a test notification').click();

        cy.get('@Notification').should('have.been.calledWithNew').then((notificationCall) => {
            const [title, options] = notificationCall.args[0];

            // * Assert the title is correct
            expect(title).to.equal('Direct Message');

            // * Assert the body contains the expected message
            expect(options.body).to.include('@system-bot: app.notifications.test_message');
          });

        cy.get('#accountSettingsHeader button.close').click();

        // * Assert the unread count is correct
        cy.get(`.SidebarLink:contains(system-bot)`).find('#unreadMentions').as('unreadCount').should('be.visible').should('have.text', '1');
        cy.get(`.SidebarLink:contains(system-bot)`).find('.Avatar').should('exist').click().wait(TIMEOUTS.HALF_SEC);
        cy.get('@unreadCount').should('not.exist');

        // * Assert the notification message
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).scrollIntoView().should('be.visible').should('have.text', 'app.notifications.test_message');
        });
    });

    it.('should not be able to recieve notification when notifications are disabled on the browser', () => {
        cy.visit(offTopic, {
            onBeforeLoad(win) {
                cy.stub(win.Notification, 'requestPermission').resolves('denied');
                cy.stub(win, 'Notification').as('Notification');
            },
        });
        cy.get('#CustomizeYourExperienceTour > button').click();
        cy.get('.sectionNoticeContent').scrollIntoView().should('be.visible');
        cy.get('.btn-tertiary').should('be.visible').should('have.text', 'Troubleshooting docs');
        cy.get('.btn-primary').should('be.visible').should('have.text', 'Send a test notification').click();

        cy.get('@Notification').should('not.be.called');

        cy.get('#accountSettingsHeader button.close').click();

        // * Assert the unread count is correct
        cy.get(`.SidebarLink:contains(system-bot)`).find('#unreadMentions').as('unreadCount').should('not.exist');
    });
});