Overwrite your SamlSettings section in your config.json file by running `make config-saml` and restarting your server. You will need to set the following `SamlSettings` in order to complete the setup:
- Enable: true
- FirstNameAttribute: "givenName"
- LastNameAttribute: "surname"

Admin Login:
- admin/admin

Users:
- homer/password
- marge/password
- lisa/password
