## Setting up mattermost

To use this keycloak image, we suggest you to use this configuration settings:

- Enable Login With SAML 2.0: `true`
- Enable Synchronizing SAML Accounts With AD/LDAP: `true`
- Override SAML bind data with AD/LDAP information: `false`
- Identity Provider Metadata URL: `http://localhost:8484/realms/mattermost/protocol/saml/descriptor`
- Identity Provider Public Certificate: The file `keycloak.crt` in this same directory
- Verify Signature: `true`
- Service Provider Login URL: `http://localhost:8065/login/sso/saml`
- Service Provider Identifier: `mattermost-saml`
- Enable Encryption: `false`
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
        "IgnoreGuestsLdapSync": false,
        "Verify": true,
        "Encrypt": false,
        "SignRequest": false,
        "IdpUrl": "http://localhost:8484/realms/mattermost/protocol/saml",
        "IdpDescriptorUrl": "http://localhost:8484/realms/mattermost/protocol/saml/descriptor",
        "IdpMetadataUrl": "",
        "ServiceProviderIdentifier": "http://localhost:8065/login/sso/saml",
        "AssertionConsumerServiceURL": "mattermost-saml",
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

## Updating the `realm.json`

The `realm.json` file is automatically imported by the keycloak development container. If you make any modifications to this file or to the base configuration, export it by running a terminal in the container and running:

```bash
/opt/keycloak/bin/kc.sh export --realm mattermost --users realm_file --file /opt/keycloak/data/import/realm.json
```

## SAML documentation

- [Official SAML with Keycloak documentation](https://docs.mattermost.com/onboard/sso-saml-keycloak.html)
