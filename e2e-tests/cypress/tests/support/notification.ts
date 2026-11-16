// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Stub the browser notification API with the given name and permission
export function spyNotificationAs(name: string, permission: NotificationPermission) {
    cy.window().then((win) => {
        const stub = cy.stub().as(name);
        Object.assign(stub, {
            permission,
            requestPermission: () => Promise.resolve(permission),
        });
        win.Notification = stub as unknown as typeof Notification;
    });

    cy.window().should((win) => {
        expect(win.Notification).to.exist;
        expect(win.Notification.permission).to.equal(permission);
    });
}
