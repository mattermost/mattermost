# Keycloak development environment

## Setting up OpenID

Overwrite your `OpenIdSettings` section in your config.json file by running `make config-openid` and restarting your server.

To manually set the configuration in the Mattermost server, you can use the following settings:

- **System settings** > **Authentication** > **OpenID**:
  - **Select service provider**: OpenID Connect (Other)
  - **Button name**: Keycloak (dev)
  - **Discovery endpoint**: `http://localhost:8484/realms/mattermost/.well-known/openid-configuration`
  - **Client ID**: `mattermost-openid`
  - **Client Secret**: `IJ4wWoukIbpBX2EZHVJcbDer6Bslxded`

- [Official OpenID with Keycloak documentation](https://docs.mattermost.com/onboard/sso-openidconnect.html)

## Setting up SAML

Overwrite your `SamlSettings` section in your config.json file by running `make config-saml` and restarting your server.

You will need to set the following `SamlSettings` in order to complete the setup:
- **Enable**: true
- **FirstNameAttribute**: "givenName"
- **LastNameAttribute**: "surname"

- [Official SAML with Keycloak documentation](https://docs.mattermost.com/onboard/sso-saml-keycloak.html)

## Credentials to log in

- **Admin account**, used to log in to the Keycloak Admin UI:
  - `admin`/`admin`

- **User accounts**, used to log in to Mattermost:
  - `homer`/`password`
  - `marge`/`password`
  - `lisa`/`password`

## Updating the `realm-export.json`

The `realm.json` file is automatically imported by the keycloak development container. If you make any modifications to this file or to the base configuration, export it by running a terminal in the container and running:

```bash
/opt/keycloak/bin/kc.sh export --realm mattermost --users realm_file --file /opt/keycloak/data/import/realm-export.json
```
