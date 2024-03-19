# Keycloak development environment

## Setting up OpenID

To setup OpenID with the default development configuration, use the following settings:

- **System settings** > **Authentication** > **OpenID**:
  - **Select service provider**: OpenID Connect (Other)
  - **Button name**: Keycloak (dev)
  - **Discovery endpoint**: `http://localhost:8484/realms/mattermost/.well-known/openid-configuration`
  - **Client ID**: `mattermost-openid`
  - **Client Secret**: `qbdUj4dacwfa5sIARIiXZxbsBFoopTyf`

## Setting up SAML

To setup SAML with the default development configuration, use the following settings:

- **System settings** > **Authentication** > **SAML 2.0**:
  - **Enable Login With SAML 2.0**: `true`
  - **Enable Synchronizing SAML Accounts With AD/LDAP**: `false`
        - Only enable this if you are working with LDAP as well.
  - **Override SAML bind data with AD/LDAP information**: `false`
  - **Identity Provider Metadata URL**: `http://localhost:8484/realms/mattermost/protocol/saml/descriptor`
    - **Click on** _Get SAML Metadata from IdP_ to get the next two fields automatically filled
  - **Identity Provider Public Certificate**: The file `keycloak.crt` in this same directory
  - **Verify Signature**: `true`
  - **Service Provider Login URL**: `http://localhost:8484/realms/mattermost/protocol/saml`
  - **Service Provider Identifier**: `mattermost-saml`
  - **Enable Encryption**: `false`
  - **Email Attribute**: `email`
  - **Username Attribute**: `username`
  - **Id Attribute**: `id`
  - **First Name Attribute**: `firstName`
  - **Last Name Attribute**: `lastName`

## Credentials to log in

You can setup all the users you want in the keycloak interface, but a default user is already setup with the following credentials:

- **Username**: keycloak-user-01
- **Password**: mostest
- **Email**: keycloak-01@dev.mattermost.com

## Updating the `realm.json`

The `realm.json` file is automatically imported by the keycloak development container. If you make any modifications to this file or to the base configuration, export it by running a terminal in the container and running:

```bash
/opt/keycloak/bin/kc.sh export --realm mattermost --users realm_file --file /opt/keycloak/data/import/realm.json
```

## SAML documentation

- [Official SAML with Keycloak documentation](https://docs.mattermost.com/onboard/sso-saml-keycloak.html)
