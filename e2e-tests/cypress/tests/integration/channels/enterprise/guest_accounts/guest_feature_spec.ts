// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @guest_account

/**
 * Note: This test requires Enterprise license to be uploaded
 */

describe('Guest Accounts', () => {
    let guestUser: Cypress.UserProfile;

    before(() => {
        cy.apiRequireLicenseForFeature('GuestAccounts');

        cy.apiCreateGuestUser({}).then(({guest}) => {
            guestUser = guest;
        });
    });

    it('MM-T1411 Update Guest Users in User Management when Guest feature is disabled', () => {
        // # Navigate to Guest Access page.
        cy.visit('/admin_console/authentication/guest_access');

        // # Enable guest accounts.
        cy.findByTestId('GuestAccountsSettings.Enabletrue').check();

        // # Click "Save".
        cy.get('#saveSetting').then((btn) => {
            if (btn.is(':enabled')) {
                btn.on('click', () => {});

                cy.waitUntil(() => cy.get('#saveSetting').then((el) => {
                    return el[0].innerText === 'Save';
                }));
            }
        });

        // # Ensure there are active Guest users.
        checkUserListStatus(guestUser, 'Guest');

        // # Navigate to System Console ➜ Guest Access.
        cy.visit('/admin_console/authentication/guest_access');

        // # Set Enable Guest Access to false.
        cy.findByTestId('GuestAccountsSettings.Enablefalse').check();

        // # Click "Save".
        cy.get('#saveSetting').scrollIntoView().click();
        cy.get('#confirmModal').should('be.visible').within(() => {
            cy.get('#confirmModalButton').should('have.text', 'Save and Disable Guest Access').click();
        });

        // * Guest users are shown as "Inactive".
        checkUserListStatus(guestUser, 'Inactive');

        // # Navigate to Guest Access page.
        cy.visit('/admin_console/authentication/guest_access');

        // # Enable guest accounts.
        cy.findByTestId('GuestAccountsSettings.Enabletrue').check();

        // # Click "Save".
        cy.get('#saveSetting').scrollIntoView().click();

        // * Guest users are shown as "Inactive".
        checkUserListStatus(guestUser, 'Inactive');
    });

    function getInnerText(el) {
        return el[0].innerText.replace(/\n/g, '').replace(/\s/g, ' ');
    }

    function checkUserListStatus(user, status) {
        // # Go to System Console ➜ Users.
        cy.visit('/admin_console/user_management/users');

        cy.get('#searchUsers').should('be.visible').type(user.username);
        cy.get('#selectUserStatus').select(status);
        cy.get('.more-modal__details > .more-modal__name').should('be.visible').then((el) => {
            expect(getInnerText(el)).contains(`@${user.username}`);
        });
    }
});
