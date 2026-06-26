// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

Cypress.Commands.add('uiCloseAnnouncementBar', () => {
    cy.document().then((doc) => {
        const announcementBar = doc.getElementsByClassName('announcement-bar')[0];
        if (announcementBar) {
            cy.get('.announcement-bar__close').click();
        }
    });
});
