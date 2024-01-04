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
        * runLdapSync is a task that runs an external request to run an ldap sync job.
        * it then waits for the ldap sync job to complete.
        * @param {UserProfile} admin - an admin user
        * @returns {boolean} - true if sync run successfully
        */
        runLdapSync(admin: {UserProfile}): boolean;

        /**
        * getLdapSyncJobStatus is a task that runs an external request for ldap_sync job status
        * @param {number} start - start time of the job.
        * @returns {string} - current status of job
        */
        getLdapSyncJobStatus(start: number): string;

        /**
         * doLDAPLogin is a task that runs LDAP login
         * @param {object} settings - login settings
         * @param {boolean} useEmail - true if uses email
         */
        doLDAPLogin(settings: object = {}, useEmail = false): Chainable<void>;

        /**
         * doLDAPLogout is a task that runs LDAP logout
         * @param {Object} settings - logout settings
         */
        doLDAPLogout(settings: object = {}): Chainable<void>;

        /**
         * visitLDAPSettings is a task that navigates to LDAP settings Page
         */
        visitLDAPSettings(): Chainable<void>;

        /**
        * waitForLdapSyncCompletion is a task that runs recursively
        * until getLdapSyncJobStatus completes or timeouts.
        * @param {number} start - start time of the job.
        * @param {number} timeout - the maxmimum time to wait for the job to complete
        */
        waitForLdapSyncCompletion(start: number, timeout: number): void;
    }
}
