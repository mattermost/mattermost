// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @saml
// Skip:  @headless @electron @firefox // run on Chrome (headed) only

import users from '../../../../fixtures/saml_users.json';

//Manual Setup required: Follow the instructions mentioned in the mattermost/platform-private/config/saml-okta-setup.txt file
context('LDAP SAML - Automated Tests (SAML TESTS)', () => {
    const loginButtonText = 'SAML';

    const regular1 = users.regulars['samluser-1'];

    const {
        oktaBaseUrl,
        oktaMMAppName,
        oktaMMEntityId,
    } = Cypress.env();
    const idpUrl = `${oktaBaseUrl}/app/${oktaMMAppName}/${oktaMMEntityId}/sso/saml`;
    const idpMetadataUrl = `${oktaBaseUrl}/app/${oktaMMEntityId}/sso/saml/metadata`;

    const newConfig = {
        SamlSettings: {
            Enable: true,
            EnableSyncWithLdap: false,
            EnableSyncWithLdapIncludeAuth: false,
            Verify: true,
            Encrypt: true,
            SignRequest: true,
            IdpURL: idpUrl,
            IdpDescriptorURL: `http://www.okta.com/${oktaMMEntityId}`,
            IdpMetadataURL: idpMetadataUrl,
            ServiceProviderIdentifier: `${Cypress.config('baseUrl')}/login/sso/saml`,
            AssertionConsumerServiceURL: `${Cypress.config('baseUrl')}/login/sso/saml`,
            SignatureAlgorithm: 'RSAwithSHA1',
            CanonicalAlgorithm: 'Canonical1.0',
            IdpCertificateFile: 'saml-idp.crt',
            PublicCertificateFile: 'saml-public.crt',
            PrivateKeyFile: 'saml-private.key',
            IdAttribute: '',
            GuestAttribute: '',
            EnableAdminAttribute: false,
            AdminAttribute: '',
            FirstNameAttribute: '',
            LastNameAttribute: '',
            EmailAttribute: 'Email',
            UsernameAttribute: 'Username',
            LoginButtonText: loginButtonText,
        },
        GuestAccountsSettings: {
            Enable: true,
        },
    };

    let testSettings;

    //Note: the assumption is that this test suite runs on a clean setup (empty DB) which would ensure that the users are not present in the Mattermost instance beforehand
    describe('LDAP SAML - Automated Tests (SAML TESTS)', () => {
        before(() => {
            // * Check if server has license for SAML
            cy.apiRequireLicenseForFeature('SAML');

            // # Get certificates status and upload as necessary
            cy.apiGetSAMLCertificateStatus().then((resp) => {
                const data = resp.body;

                if (!data.idp_certificate_file) {
                    cy.apiUploadSAMLIDPCert('saml-idp.crt');
                }

                if (!data.public_certificate_file) {
                    cy.apiUploadSAMLPublicCert('saml-public.crt');
                }

                if (!data.private_key_file) {
                    cy.apiUploadSAMLPrivateKey('saml-private.key');
                }
            });

            // # Check SAML metadata if working properly
            cy.apiGetMetadataFromIdp(idpMetadataUrl);

            cy.oktaAddUsers(users);
            cy.apiUpdateConfig(newConfig).then(({config}) => {
                cy.setTestSettings(loginButtonText, config).then((_response) => {
                    testSettings = _response;
                });
            });
        });

        it('MM-T3012 - Check SAML Metadata without Enable Encryption', () => {
            cy.apiAdminLogin();
            const test1Settings = {
                ...newConfig,
                SamlSettings: {
                    ...newConfig.SamlSettings,
                    Encrypt: false,
                    PublicCertificateFile: '',
                    PrivateKeyFile: '',
                },
            };
            cy.apiUpdateConfig(test1Settings).then(() => {
                const baseUrl = Cypress.config('baseUrl');
                cy.request(`${baseUrl}/api/v4/saml/metadata`).then((resp) => {
                    expect(resp.status).to.eq(200);
                    expect(resp.headers['content-type']).to.eq('application/xml');
                    expect(resp.body).to.contain('<?xml version');
                });
            });
        });

        it('MM-T3280 - SAML Login Audit', () => {
            cy.apiAdminLogin();

            cy.apiUpdateConfig(newConfig).then(() => {
                testSettings.user = regular1;
                cy.oktaGetOrCreateUser(testSettings.user).then((oktaUserId) => {
                    cy.oktaDeleteSession(oktaUserId);
                    cy.doSamlLogin(testSettings).then(() => {
                        cy.doOktaLogin(testSettings.user).then(() => {
                            cy.skipOrCreateTeam(testSettings, oktaUserId).then(() => {
                                cy.uiOpenProfileModal('Security');
                                cy.findByTestId('viewAccessHistory').click();
                                cy.findByTestId('auditTableBody').find('td').
                                    each(($el) => {
                                        cy.wrap($el).
                                            invoke('text').
                                            then((text) => {
                                                if (text.includes('Saml obtained user')) {
                                                    expect(text).to.contains('Saml obtained user');
                                                }
                                            });
                                    });
                            });
                        });
                    });
                });
            });
        });

        it('MM-T3281 - SAML Signature Algorithm using RSAwithSHA256', () => {
            cy.apiAdminLogin();
            const test1Settings = {
                ...newConfig,
                SamlSettings: {
                    ...newConfig.SamlSettings,
                    SignatureAlgorithm: 'RSAwithSHA256',
                },
            };
            cy.apiUpdateConfig(test1Settings).then(() => {
                testSettings.user = regular1;
                cy.oktaGetOrCreateUser(testSettings.user).then((oktaUserId) => {
                    cy.oktaDeleteSession(oktaUserId);
                    cy.doSamlLogin(testSettings).then(() => {
                        cy.doOktaLogin(testSettings.user).then(() => {
                            cy.skipOrCreateTeam(testSettings, oktaUserId);
                            cy.oktaDeleteSession(oktaUserId);
                        });
                    });
                });
            });
        });

        it('SAML Signature Algorithm using RSAwithSHA512', () => {
            cy.apiAdminLogin();
            const test1Settings = {
                ...newConfig,
                SamlSettings: {
                    ...newConfig.SamlSettings,
                    SignatureAlgorithm: 'RSAwithSHA512',
                },
            };
            cy.apiUpdateConfig(test1Settings).then(() => {
                testSettings.user = regular1;
                cy.oktaGetOrCreateUser(testSettings.user).then((oktaUserId) => {
                    cy.oktaDeleteSession(oktaUserId);
                    cy.doSamlLogin(testSettings).then(() => {
                        cy.doOktaLogin(testSettings.user).then(() => {
                            cy.skipOrCreateTeam(testSettings, oktaUserId);
                        });
                    });
                });
            });
        });
    });
});
