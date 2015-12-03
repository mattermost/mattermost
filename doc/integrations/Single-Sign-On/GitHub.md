## Configuring GitHub Single-Sign-On (unofficial)

Note: Because the authentication interface of GitHub is similar to that of GitLab, the GitLab SSO feature can be used to unofficially also support GitHub SSO.

Follow these steps to configure Mattermost to use Github as a single-sign-on (SSO) service for team creation, account creation and sign-in using the GitLab SSO interface.

1. Login to your GitHub account and go to the Applications section in Profile Settings.
2. Add a new application called "Mattermost" with the following as Authorization callback URL:
  * `<your-mattermost-url>` (example: http://localhost:8065)

3. Submit the application and copy the given _Id_ and _Secret_ into the appropriate _GitLabSettings_ fields in config/config.json

4. Also in config/config.json, set _Enable_ to `true` for the _gitlab_ section, leave _Scope_ blank and use the following for the endpoints:
  * _AuthEndpoint_: `https://github.com/login/oauth/authorize`
  * _TokenEndpoint_: `https://github.com/login/oauth/access_token`
  * _UserApiEndpoint_: `https://api.github.com/user`

6. (Optional) If you would like to force all users to sign-up with GitHub only,
in the _ServiceSettings_ section of config/config.json set _DisableEmailSignUp_
to `true`.

6. Restart your Mattermost server to see the changes take effect.

7. Tell the users to set their public email for GitHub at the [Public profile page](https://github.com/settings/profile). Mattermost uses the email to create account.
