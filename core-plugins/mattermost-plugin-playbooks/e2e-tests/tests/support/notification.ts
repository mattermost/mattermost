// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Stub the browser notification API with the given name and permission
export function spyNotificationAs(name: string, permission: NotificationPermission) {
    cy.window().then((win) => {
        win.Notification = Notification;
        win.Notification.requestPermission = () => Promise.resolve(permission);

        cy.stub(win, 'Notification').as(name);
    });

    cy.window().should('have.property', 'Notification');
}
