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

or overwrite your SamleSettings section in your config.json file by running `make config-saml` and restarting your server.

Admin Login:
- admin/admin

Users:
- homer/password
- marge/password
- lisa/password
