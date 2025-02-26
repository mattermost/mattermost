// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
        * checkForLDAPError verifies that an LDAP error is displayed.
        * @returns {boolean} - true if error successfully found.
        */
        checkForLDAPError(): Chainable;

        skipOrCreateTeam: typeof skipOrCreateTeam;
        checkLoginFailed: typeof checkLoginFailed;
        doMemberLogoutFromSignUp: typeof doMemberLogoutFromSignUp;
        doLogoutFromSignUp: typeof doLogoutFromSignUp;
        checkLoginPage: typeof checkLoginPage;
        checkLeftSideBar: typeof checkLeftSideBar;
        checkInvitePeoplePage: typeof checkInvitePeoplePage;
    }
}
