// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

import moment from 'moment-timezone';

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Profile', () => {
    let siteName: string;
    let testUser: Cypress.UserProfile;
    let offTopic: string;

    before(() => {
        cy.apiGetConfig().then(({config}) => {
            siteName = config.TeamSettings.SiteName;
        });

        // # Login as new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({user, offTopicUrl}) => {
            testUser = user;
            offTopic = offTopicUrl;

            cy.visit(offTopicUrl);
        });
    });

    beforeEach(() => {
        // # Reload the page to help run each test cleanly
        cy.reload();

        // # Go to Profile
        cy.uiOpenProfileModal('Security');

        // * Check that the Security tab is loaded
        cy.get('#securityButton').should('be.visible');

        // # Click the Security tab
        cy.get('#securityButton').click();

        // # Click "Edit" to the right of "Password"
        cy.get('#passwordEdit').should('be.visible').click();
    });

    it('MM-T2085 Password: Valid values in password change fields allow the form to save successfully', () => {
        // # Enter valid values in password change fields
        enterPasswords(testUser.password, 'passwd', 'passwd');

        // # Save the settings
        cy.uiSave();

        // * Check that there are no errors
        cy.get('#clientError').should('not.exist');
        cy.get('#serverError').should('not.exist');
    });

    it('MM-T2082 Password: New password confirmation mismatch produces error', () => {
        // # Enter mismatching passwords for new password and confirm fields
        enterPasswords(testUser.password, 'newPW', 'NewPW');

        // # Save
        cy.uiSave();

        // * Verify for error message: "The new passwords you entered do not match."
        cy.get('#clientError').should('be.visible').should('have.text', 'The new passwords you entered do not match.');
    });

    it('MM-T2083 Password: Too few characters in new password produces error', () => {
        // # Enter a New password two letters long
        enterPasswords(testUser.password, 'pw', 'pw');

        // # Save
        cy.uiSave();

        // * Verify for error message: "Must be 5-72 characters long."
        cy.get('#clientError').should('be.visible').should('have.text', 'Must be 5-72 characters long.');
    });

    it('MM-T2084 Password: Cancel out of password changes causes no changes to be made', () => {
        // # Enter new valid passwords
        enterPasswords(testUser.password, 'newPasswd', 'newPasswd');

        // # Click 'Cancel'
        cy.uiCancel();

        // * Check that user is no longer in password edit page to verify the 'Cancel' action
        cy.get('#currentPassword').should('not.exist');
        cy.get('#passwordEdit').should('be.visible');

        // # Logout
        cy.apiLogout();

        // * Verify that user cannot login with the cancelled password
        cy.get('#input_loginId').type(testUser.username);
        cy.get('#input_password-input').type('newPasswd');
        cy.get('#saveSetting').should('not.be.disabled').click();
        cy.findByText('The email/username or password is invalid.').should('be.visible');

        // * Verify that user can successfully login with the old password
        cy.apiLogin(testUser);
        cy.visit(offTopic);
        cy.get('#channelHeaderTitle').should('contain', 'Off-Topic');
    });

    it.skip('MM-T2086 Password: Timestamp and email', () => {
        // # Enter valid values in password change fields
        enterPasswords(testUser.password, 'passwd', 'passwd');

        // # Get current date
        const now = moment(Date.now());

        // # Save the settings
        cy.uiSave();

        // # Create expected date and time formats
        const date = now.format('MMM DD, YYYY');
        const time = now.format('hh:mm A');

        // # Create expected timestamp
        const timestamp = `Last updated ${date} at ${time}`;

        // * Verify that password description field contains valid timestamp
        cy.get('#passwordDesc').should('have.text', timestamp);

        // # Wait for the mail to be sent out.
        cy.wait(TIMEOUTS.FIVE_SEC);

        cy.getRecentEmail(testUser).then(({subject}) => {
            // * Verify the subject
            expect(subject).to.equal(
                `[${siteName}] Your password has been updated`,
            );
        });
    });
});

function enterPasswords(currentPassword, newPassword, confirmPassword) {
    // # Enter Current password
    cy.get('#currentPassword').should('be.visible').type(currentPassword);

    // # Enter New password
    cy.get('#newPassword').should('be.visible').type(newPassword);

    // # Retype New password incorrectly
    cy.get('#confirmPassword').should('be.visible').type(confirmPassword);
}
