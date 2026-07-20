// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @not_cloud @system_console

import * as TIMEOUTS from '@/fixtures/timeouts';

// These specs exercise the license upload preview/diff flow added in MM-67113.
// The upload and preview endpoints require real, signed license bytes that are
// not available to the e2e environment, so the network is stubbed via
// cy.intercept and a tiny dummy file is fed into the hidden file input. The
// stubs are crafted to reproduce the two issues reported during QA:
//   1. After uploading a new license, the success screen showed the previous
//      tier and the System Console license page did not refresh.
//   2. Re-uploading the currently applied license was not handled gracefully.

const OLD_LICENSE_ID = 'old-license-id-0000000000000';

// Current (already applied) license, as returned by GET /license/client?format=old.
const currentClientLicense = buildClientLicense({
    id: OLD_LICENSE_ID,
    skuName: 'Professional',
    skuShortName: 'professional',
    users: '100',
});

// New license returned by the preview/upload endpoints (an upgrade to Enterprise).
const newLicense = buildLicense({
    id: 'new-license-id-0000000000000',
    skuName: 'Enterprise',
    skuShortName: 'enterprise',
    users: 500,
});

describe('System console - License preview/diff view', () => {
    before(() => {
        cy.apiAdminLogin();
        cy.shouldNotRunOnCloudEdition();

        // * Ensure the server is licensed so the System Console renders the
        //   enterprise license page (the displayed license is stubbed below).
        cy.apiRequireLicense();
    });

    beforeEach(() => {
        cy.apiAdminLogin();
    });

    it('MM-67113 - Shows the newly uploaded license tier on success and refreshes the page after closing', () => {
        // # The displayed license starts as Professional. It is served from a
        //   mutable holder so we can simulate the server only reporting the new
        //   license once propagation completes (by the time the modal closes).
        const clientLicenseHolder = {body: currentClientLicense};
        cy.intercept('GET', '**/api/v4/license/client?format=old', (req) => {
            req.reply({statusCode: 200, body: clientLicenseHolder.body});
        }).as('getClientLicense');

        // # Preview and upload both return the new Enterprise license
        cy.intercept('POST', '**/api/v4/license/preview', {statusCode: 200, body: newLicense}).as('previewLicense');
        cy.intercept('POST', '**/api/v4/license', {statusCode: 200, body: newLicense}).as('uploadLicense');

        cy.visit('/admin_console/about/license');
        cy.wait('@getClientLicense');

        // * The page initially shows the current (Professional) license
        cy.get('.EnterpriseEditionLeftPanel__Title', {timeout: TIMEOUTS.TEN_SEC}).
            should('contain.text', 'Mattermost Professional');

        // # Select a license file to open the upload modal
        selectLicenseFile();

        // # Wait for the preview request and the diff view to render
        cy.wait('@previewLicense');
        cy.get('#UploadLicenseModal').should('be.visible').within(() => {
            // * The diff view compares the current and new license tiers
            cy.findByText('Review License Changes').should('be.visible');
            cy.get('.diff-current').should('contain.text', 'Professional');
            cy.get('.diff-new').should('contain.text', 'Enterprise');

            // # Apply the new license
            cy.get('#confirm-button').click();
        });
        cy.wait('@uploadLicense');

        // * The success screen reflects the NEWLY uploaded tier (Enterprise),
        //   not the previously applied tier (Professional). This is the core of
        //   the "uploaded Enterprise, got Professional" report.
        cy.get('#UploadLicenseModal').should('be.visible').within(() => {
            cy.findByText('New license successfully applied').should('be.visible');
            cy.get('.subtitle').
                should('contain.text', 'Enterprise').
                and('not.contain.text', 'Professional');
        });

        // # By the time the admin closes the modal, the server reports the new
        //   license. Closing must trigger a refresh that picks this up.
        cy.then(() => {
            clientLicenseHolder.body = buildClientLicense({
                id: newLicense.id,
                skuName: 'Enterprise',
                skuShortName: 'enterprise',
                users: '500',
            });
        });
        cy.get('#UploadLicenseModal').within(() => {
            cy.get('#done-button').click();
        });
        cy.get('#UploadLicenseModal').should('not.exist');

        // * The System Console license page refreshes to show the new license
        //   without requiring a manual page reload.
        cy.get('.EnterpriseEditionLeftPanel__Title', {timeout: TIMEOUTS.TEN_SEC}).
            should('contain.text', 'Mattermost Enterprise');
    });

    it('MM-67113 - Warns when re-uploading the currently applied license and leaves it unchanged', () => {
        // # The displayed license stays Professional throughout this flow
        cy.intercept('GET', '**/api/v4/license/client?format=old', {
            statusCode: 200,
            body: currentClientLicense,
        }).as('getClientLicense');

        // # Preview and upload return the SAME license that is currently applied
        //   (same id), so the diff view should detect an unchanged license.
        const sameLicense = buildLicense({
            id: OLD_LICENSE_ID,
            skuName: 'Professional',
            skuShortName: 'professional',
            users: 100,
        });
        cy.intercept('POST', '**/api/v4/license/preview', {statusCode: 200, body: sameLicense}).as('previewLicense');
        cy.intercept('POST', '**/api/v4/license', {statusCode: 200, body: sameLicense}).as('uploadLicense');

        cy.visit('/admin_console/about/license');
        cy.wait('@getClientLicense');
        cy.get('.EnterpriseEditionLeftPanel__Title', {timeout: TIMEOUTS.TEN_SEC}).
            should('contain.text', 'Mattermost Professional');

        // # Select the same license file to open the upload modal
        selectLicenseFile();
        cy.wait('@previewLicense');

        // * The diff view warns that the license is already active
        cy.get('#UploadLicenseModal').should('be.visible').within(() => {
            cy.findByText('This license is already active').should('be.visible');

            // # The admin can still apply it; doing so must not break the flow
            cy.get('#confirm-button').click();
        });
        cy.wait('@uploadLicense');

        // * The flow completes successfully and the modal can be closed
        cy.get('#UploadLicenseModal').should('be.visible').within(() => {
            cy.findByText('New license successfully applied').should('be.visible');
            cy.get('#done-button').click();
        });
        cy.get('#UploadLicenseModal').should('not.exist');

        // * The applied license is unchanged and the page remains functional
        cy.get('.EnterpriseEditionLeftPanel__Title', {timeout: TIMEOUTS.TEN_SEC}).
            should('contain.text', 'Mattermost Professional');
    });
});

// Feed a small dummy file into the hidden license file input. The actual bytes
// are irrelevant because the preview/upload endpoints are stubbed.
function selectLicenseFile() {
    cy.get('[data-testid="EnterpriseEditionLeftPanel"] input[type="file"]').
        selectFile({
            contents: Cypress.Buffer.from('dummy-license-content'),
            fileName: 'test-license.mattermost-license',
        }, {force: true});
}

// Build a License object matching the shape returned by POST /license/preview
// and POST /license (server model.License serialized to JSON).
function buildLicense({id, skuName, skuShortName, users}) {
    const now = Date.now();
    return {
        id,
        issued_at: now,
        starts_at: now,
        expires_at: now + (365 * 24 * 60 * 60 * 1000),
        customer: {
            id: 'customer-id',
            name: 'Test Customer',
            email: 'test@example.com',
            company: 'Test Company',
        },
        features: {
            users,
            ldap: true,
            ldap_groups: true,
            mfa: true,
            google_oauth: true,
            office365_oauth: true,
            compliance: true,
            cluster: true,
            metrics: true,
            mhpns: true,
            saml: true,
            elastic_search: true,
            announcement: true,
            theme_management: true,
            email_notification_contents: true,
            data_retention: true,
            message_export: true,
            custom_permissions_schemes: true,
            custom_terms_of_service: true,
            guest_accounts: true,
            guest_accounts_permissions: true,
        },
        sku_name: skuName,
        sku_short_name: skuShortName,
        is_gov_sku: false,
    };
}

// Build a ClientLicense object (old format) matching GET /license/client?format=old.
// All values are strings, as produced by the server.
function buildClientLicense({id, skuName, skuShortName, users}) {
    const now = Date.now();
    return {
        IsLicensed: 'true',
        IsTrial: 'false',
        Id: id,
        SkuName: skuName,
        SkuShortName: skuShortName,
        Users: users,
        IssuedAt: String(now),
        StartsAt: String(now),
        ExpiresAt: String(now + (365 * 24 * 60 * 60 * 1000)),
        Name: 'Test Customer',
        Email: 'test@example.com',
        Company: 'Test Company',
        IsGovSku: 'false',
        LDAP: 'true',
        LDAPGroups: 'true',
        MFA: 'true',
        SAML: 'true',
        Cluster: 'true',
        Metrics: 'true',
        GoogleOAuth: 'true',
        Office365OAuth: 'true',
        OpenId: 'true',
        Compliance: 'true',
        MHPNS: 'true',
        Announcement: 'true',
        Elasticsearch: 'true',
        DataRetention: 'true',
        IDLoadedPushNotifications: 'true',
        EmailNotificationContents: 'true',
        MessageExport: 'true',
        CustomPermissionsSchemes: 'true',
        GuestAccounts: 'true',
        GuestAccountsPermissions: 'true',
        CustomTermsOfService: 'true',
        LockTeammateNameDisplay: 'true',
        Cloud: 'false',
        SharedChannels: 'true',
        RemoteClusterService: 'true',
        OutgoingOAuthConnections: 'true',
    };
}
