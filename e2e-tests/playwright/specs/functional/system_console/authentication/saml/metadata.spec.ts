// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SystemConsolePage, expect, test, testConfig} from '@mattermost/playwright-lib';

const metadataErrorURL = 'http://test_saml_metadata_url';
const metadataSuccessURL = 'http://test_saml_metadata_success_url';
const initialSsoURL = 'http://test_idp_url';
const initialIssuerURL = 'http://test_idp_descriptor_url';
const fetchedSsoURL = 'http://test_fetched_idp_url';
const fetchedIssuerURL = 'http://test_fetched_idp_descriptor_url';
const serviceProviderURL = `${testConfig.baseURL}/login/sso/saml`;
const idpCertificate = 'MIICozCCAYsCBgGNzWfMwjANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDDAptYXR0ZXJtb3N0';
const metadataErrorMessage = 'SAML Metadata URL did not connect and pull data successfully';
const metadataSuccessMessage = 'SAML Metadata retrieved successfully. Two fields and one certificate have been updated';

test.describe('SAML metadata from identity provider', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify a failed metadata request preserves the existing SAML settings and leaves them saveable
     */
    test('fails to fetch metadata from IdP Metadata URL', {tag: '@saml'}, async ({pw}) => {
        const {adminClient, adminUser} = await pw.getAdminClient();
        await adminClient.patchConfig({
            SamlSettings: {
                Enable: true,
                IdpMetadataURL: '',
                IdpURL: initialSsoURL,
                IdpDescriptorURL: initialIssuerURL,
                AssertionConsumerServiceURL: serviceProviderURL,
                ServiceProviderIdentifier: serviceProviderURL,
            },
        });
        const {page} = await pw.testBrowser.login(adminUser!);
        await page.route('**/api/v4/saml/metadatafromidp', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({id: 'api.saml.metadata_from_idp.app_error', message: metadataErrorMessage}),
            });
        });
        const systemConsolePage = new SystemConsolePage(page);

        // * Verify the empty metadata URL is editable and the fetch action is disabled
        await systemConsolePage.saml.goto();
        await systemConsolePage.saml.expectMetadataURL('');
        await systemConsolePage.saml.expectGetMetadataEnabled(false);

        // # Enter a metadata URL and request metadata from the mocked failing endpoint
        await systemConsolePage.saml.setMetadataURL(metadataErrorURL);
        await systemConsolePage.saml.expectGetMetadataEnabled(true);
        const metadataRequest = page.waitForRequest('**/api/v4/saml/metadatafromidp');
        await systemConsolePage.saml.getMetadata();
        await metadataRequest;

        // * Verify the error is visible and the existing SAML values are unchanged
        await systemConsolePage.saml.expectMetadataMessage(metadataErrorMessage);
        await systemConsolePage.saml.expectIdentityProviderValues(initialSsoURL, initialIssuerURL, serviceProviderURL);

        // * Verify the edited settings remain saveable after the failed request
        await systemConsolePage.saml.save();
    });

    /**
     * @objective Verify successful metadata retrieval updates both IdP URLs and uploads the returned certificate
     */
    test('fetches metadata and sets the IdP certificate from IdP Metadata URL', {tag: '@saml'}, async ({pw}) => {
        const {adminClient, adminUser} = await pw.getAdminClient();
        await adminClient.patchConfig({
            SamlSettings: {
                Enable: true,
                IdpMetadataURL: metadataSuccessURL,
                IdpURL: initialSsoURL,
                IdpDescriptorURL: initialIssuerURL,
                AssertionConsumerServiceURL: serviceProviderURL,
                ServiceProviderIdentifier: serviceProviderURL,
            },
        });
        const {page} = await pw.testBrowser.login(adminUser!);
        await page.route('**/api/v4/saml/metadatafromidp', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    idp_url: fetchedSsoURL,
                    idp_descriptor_url: fetchedIssuerURL,
                    idp_public_certificate: idpCertificate,
                }),
            });
        });
        await page.route('**/api/v4/saml/certificate/idp', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({status: 'OK'}),
            });
        });
        const systemConsolePage = new SystemConsolePage(page);
        await systemConsolePage.saml.goto();

        // # Fetch metadata through the two mocked Mattermost API endpoints
        const metadataRequest = page.waitForRequest('**/api/v4/saml/metadatafromidp');
        const certificateRequest = page.waitForRequest('**/api/v4/saml/certificate/idp');
        await systemConsolePage.saml.getMetadata();
        await metadataRequest;
        const uploadedCertificate = await certificateRequest;

        // * Verify the certificate endpoint receives the returned PEM payload
        expect(uploadedCertificate.headers()['content-type']).toBe('application/x-pem-file');
        expect(uploadedCertificate.postData()).toBe(idpCertificate);

        // * Verify the visible URLs, success message, and certificate state are updated
        await systemConsolePage.saml.expectIdentityProviderValues(fetchedSsoURL, fetchedIssuerURL);
        await systemConsolePage.saml.expectMetadataMessage(metadataSuccessMessage);
        await systemConsolePage.saml.expectIdentityProviderCertificate();
    });
});
