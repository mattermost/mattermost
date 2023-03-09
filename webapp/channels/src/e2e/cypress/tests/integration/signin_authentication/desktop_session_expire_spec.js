// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @signin_authentication

import {getAdminAccount} from '../../support/env';
import {spyNotificationAs} from '../../support/notification';
import timeouts from '../../fixtures/timeouts';

import {fillCredentialsForUser} from './helpers';

describe('Authentication', () => {
    let testTeam;
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    it('MM-T419 Desktop session expires when the focus is on the tab', () => {
        cy.apiLogout();
        cy.visit('/login');
        fillCredentialsForUser(testUser);

        // # Open settings modal
        cy.uiOpenSettingsModal().within(() => {
            // Click "Desktop"
            cy.findByText('Desktop Notifications').should('be.visible').click();

            // # Set your desktop notifications to Never
            cy.get('#desktopNotificationNever').check();

            // Click "Save" and close modal
            cy.uiSaveAndClose();
        });

        spyNotificationAs('withNotification', 'granted');
        cy.visit(`/${testTeam.name}/channels/town-square`);

        cy.postMessage('hello');

        // # From a separate browser session, login to the same server as the same user
        // # Click the hamburger menu and select Profile ➜ Security
        // # Click "View and Logout of Active Sessions", then find and close the session created in step 1
        // Since we are testing this on browser, we can revoke sessions with admin user.
        const sysadmin = getAdminAccount();
        cy.externalRequest({user: sysadmin, method: 'post', path: `users/${testUser.id}/sessions/revoke/all`});

        // * Login page shows a message above the login box that the session has expired.
        cy.get('.AlertBanner.warning', {timeout: timeouts.ONE_MIN}).should('contain.text', 'Your session has expired. Please log in again.');

        // # Go back and view the original session app/browser, and wait until you see a desktop notification (may take up to a minute)
        // * Desktop notification is sent (may take up to 1 min)
        cy.wait(timeouts.HALF_MIN);
        cy.get('@withNotification').should('have.been.calledOnce').and('have.been.calledWithMatch', 'Mattermost', ({body}) => {
            const expected = 'Session Expired: Please sign in to continue receiving notifications.';
            expect(body, `Notification body: "${body}" should match: "${expected}"`).to.equal(expected);
            return true;
        });
    });
});
