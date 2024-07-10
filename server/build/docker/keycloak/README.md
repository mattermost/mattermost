# Keycloak development environment

## Setting up

### OpenID

Overwrite your `OpenIdSettings` section in your config.json file by running `make config-openid` and restarting your server.

- [Official OpenID with Keycloak documentation](https://docs.mattermost.com/onboard/sso-openidconnect.html)

### SAML

Overwrite your `SamlSettings` section in your config.json file by running `make config-saml` and restarting your server.

- [Official SAML with Keycloak documentation](https://docs.mattermost.com/onboard/sso-saml-keycloak.html)

### LDAP

Overwrite your `LdapSettings` section in your config.json file by running `make config-ldap` and restarting your server.

- [Official LDAP with Keycloak documentation](https://docs.mattermost.com/onboard/ad-ldap.html)

## Credentials to log in

- **Admin account**, used to log in to the Keycloak Admin UI:
  - `admin`/`admin`

- **User accounts**, used to log in to Mattermost:
  - `homer`/`password`
  - `marge`/`password`
  - `lisa`/`password`

## Updating the `realm-export.json`

The `realm-export.json` file is automatically imported by the keycloak development container. If you make any modifications to this file or to the base configuration, export it by running a terminal in the container and running:

```bash
/opt/keycloak/bin/kc.sh export --realm mattermost --users realm_file --file /opt/keycloak/data/import/realm-export.json
```
