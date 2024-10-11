// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notification

describe('Verify users can receive notification on browser', () => {
    let offTopic: string;
    const notificationMessage = 'If you received this test notification, it worked!';
    before(() => {
        cy.apiInitSetup({userPrefix: 'other', loginAfter: true}).then(({offTopicUrl}) => {
            offTopic = offTopicUrl;
        });
    });

    it('MM-T5631_1 should be able to receive notification when notifications are enabled on the browser', () => {
        cy.visit(offTopic);
        cy.stubNotificationPermission('granted');
        cy.get('#CustomizeYourExperienceTour > button').click();
        triggertestNotification();
        cy.get('@notificationStub').should('be.called');
        cy.get('@notificationStub').should((stub) => {
            expect(stub).to.have.been.calledWithMatch(
                'Direct Message',
                Cypress.sinon.match({
                    body: '@@system-bot: If you received this test notification, it worked!',
                    tag: '@@system-bot: If you received this test notification, it worked!',
                    requireInteraction: false,
                    silent: false,
                }),
            );
        });
        cy.get('#accountSettingsHeader button.close').click();

        // * Verify user still recieves a message from system bot
        cy.verifySystemBotMessageRecieved(notificationMessage);
    });

    it('MM-T5631_2 should not be able to receive notification when notifications are denied on the browser', () => {
        cy.visit(offTopic);
        cy.stubNotificationPermission('denied');
        cy.get('#CustomizeYourExperienceTour > button').click();
        triggertestNotification();

        // * Assert that the Notification constructor was not called
        cy.get('@notificationStub').should('not.be.called');
        cy.get('#accountSettingsHeader button.close').click();

        // * Verify user still recieves a message from system bot
        cy.verifySystemBotMessageRecieved(notificationMessage);
    });

    it('MM-T5631_3 should not trigger notification when permission is default (no decision made)', () => {
        cy.visit(offTopic);
        cy.stubNotificationPermission('default');
        cy.get('#CustomizeYourExperienceTour > button').click();
        triggertestNotification();

        // * Assert that the Notification constructor was not called
        cy.get('@notificationStub').should('not.be.called');
        cy.get('#accountSettingsHeader button.close').click();

        // * Verify user still recieves a message from system bot
        cy.verifySystemBotMessageRecieved(notificationMessage);
    });

    // Simulating macOS Focus Mode by suppressing the Notification constructor entirely
    it('MM-T5631_4 should not show notification when Focus Mode is enabled (simulating no notification pop-up)', () => {
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
        triggertestNotification();

        // * Assert that the Notification constructor was not called in Focus Mode
        cy.get('@notificationStub').should('not.be.called');
        cy.get('#accountSettingsHeader button.close').click();

        // * Verify user still recieves a message from system bot
        cy.verifySystemBotMessageRecieved(notificationMessage);
    });

    it('should still recieve a test notification when user has set Global and Channel Notification preference to Nothing', () => {
        cy.visit(offTopic);
        cy.stubNotificationPermission('default');

        // # Mute Channel
        cy.get('#channelHeaderTitle > span').click();
        cy.get('#channelToggleMuteChannel').should('have.text', 'Mute Channel').click();
        cy.get('#toggleMute').should('be.visible');

        // # Set Desktop Notification preference to Nothing
        cy.get('#CustomizeYourExperienceTour > button').click();
        cy.get('#desktopAndMobileTitle').click();
        cy.get('#sendDesktopNotificationsSection input[type=radio]').last().check();
        cy.get('#saveSetting').click();
        cy.wait(500);
        triggertestNotification();

        // * Assert that the Notification constructor was not called
        cy.get('@notificationStub').should('not.be.called');
        cy.get('#accountSettingsHeader button.close').click();

        // * Verify user still recieves a message from system bot
        cy.verifySystemBotMessageRecieved(notificationMessage);
    });
});

function triggertestNotification() {
    cy.get('.sectionNoticeContent').scrollIntoView().should('be.visible');
    cy.get('.btn-tertiary').should('be.visible').should('have.text', 'Troubleshooting docs');
    cy.get('.btn-primary').should('be.visible').should('have.text', 'Send a test notification').click();
}
