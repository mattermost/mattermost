To use this keycloak image, we suggest you to use this configuration settings:

- Enable Login With SAML 2.0: `true`
- Enable Synchronizing SAML Accounts With AD/LDAP: `false`
- Override SAML bind data with AD/LDAP information: `false`
- Identity Provider Metadata URL: `http://localhost:8484/realms/mattermost/protocol/saml/descriptor`
- SAML SSO URL: `http://localhost:8484/realms/mattermost/protocol/saml`
- Identity Provider Issuer URL: `http://localhost:8484/realms/mattermost`
- Identity Provider Public Certificate: The file `saml-idp.crt` in this same directory
- Verify Signature: `false`
- Service Provider Login URL: `http://localhost:8065/login/sso/saml`
- Service Provider Identifier: `mattermost`
- Enable Encryption: `false`
- Sign Request: `false`
- Email Attribute: `email`
- Username Attribute: `username`
- Id Attribute: `id`
- First Name Attribute: `firstName`
- Last Name Attribute: `lastName`

or overwrite your SamleSettings section with this settings in your config.json file (if you are not using
database configuration) and restart the server:

```json
    "SamlSettings": {
        "Enable": true,
        "EnableSyncWithLdap": false,
        "EnableSyncWithLdapIncludeAuth": false,
        "IgnoreGuestsLdapSync": false,
        "Verify": false,
        "Encrypt": false,
        "SignRequest": false,
        "IdpURL": "http://localhost:8484/realms/mattermost/protocol/saml",
        "IdpDescriptorURL": "http://localhost:8484/realms/mattermost",
        "IdpMetadataURL": "http://localhost:8484/realms/mattermost/protocol/saml/descriptor",
        "ServiceProviderIdentifier": "mattermost",
        "AssertionConsumerServiceURL": "http://localhost:8065/login/sso/saml",
        "SignatureAlgorithm": "RSAwithSHA1",
        "CanonicalAlgorithm": "Canonical1.0",
        "ScopingIDPProviderId": "",
        "ScopingIDPName": "",
        "IdpCertificateFile": "saml-idp.crt",
        "PublicCertificateFile": "",
        "PrivateKeyFile": "",
        "IdAttribute": "id",
        "GuestAttribute": "",
        "EnableAdminAttribute": false,
        "AdminAttribute": "Role=admin",
        "FirstNameAttribute": "",
        "LastNameAttribute": "",
        "EmailAttribute": "email",
        "UsernameAttribute": "username",
        "NicknameAttribute": "",
        "LocaleAttribute": "",
        "PositionAttribute": "",
        "LoginButtonText": "SAML",
        "LoginButtonColor": "#34a28b",
        "LoginButtonBorderColor": "#2389D7",
        "LoginButtonTextColor": "#ffffff"
    },
```
