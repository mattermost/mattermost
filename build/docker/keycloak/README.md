To use this keycloak image, we suggest you to use this configuration settings:

- Enable Login With SAML 2.0: `true`
- Enable Synchronizing SAML Accounts With AD/LDAP: `true`
- Override SAML bind data with AD/LDAP information: `false`
- Identity Provider Metadata URL: empty string
- SAML SSO URL: `http://localhost:8484/auth/realms/mattermost/protocol/saml`
- Identity Provider Issuer URL: h`ttp://localhost:8065/login/sso/SAML`
- Identity Provider Public Certificate: The file `keycloak_cert.pem` in this same directory
- Verify Signature: `true`
- Service Provider Login URL: `http://localhost:8065/login/sso/saml`
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
        "EnableSyncWithLdap": true,
        "EnableSyncWithLdapIncludeAuth": false,
        "Verify": true,
        "Encrypt": false,
        "SignRequest": false,
        "IdpUrl": "http://localhost:8484/auth/realms/mattermost/protocol/saml",
        "IdpDescriptorUrl": "http://localhost:8065/login/sso/saml",
        "IdpMetadataUrl": "",
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
        "AdminAttribute": "",
        "FirstNameAttribute": "firstName",
        "LastNameAttribute": "lastName",
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
