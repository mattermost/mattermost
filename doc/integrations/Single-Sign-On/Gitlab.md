## Configuring GitLab Single-Sign-On

Follow these steps to configure Mattermost to use GitLab as a single-sign-on (SSO) service for team creation, account creation and sign-in.

1. Login to your GitLab account and go to the Applications section either in Profile Settings or Admin Area.
2. Add a new application called "Mattermost" with the following as Redirect URIs:
  * `<your-mattermost-url>/login/gitlab/complete` (example: http://localhost:8065/login/gitlab/complete)
  * `<your-mattermost-url>/signup/gitlab/complete`
  
  (Note: If your GitLab instance is set up to use SSL, your URIs must begin with https://. Otherwise, use http://).

3. Submit the application and copy the given _Id_ and _Secret_ into the appropriate _SSOSettings_ fields in config/config.json

4. Also in config/config.json, set _Enable_ to `true` for the _gitlab_ section, leave _Scope_ blank and use the following for the endpoints:
  * _AuthEndpoint_: `https://<your-gitlab-url>/oauth/authorize` (example https://example.com/oauth/authorize)  
  * _TokenEndpoint_: `https://<your-gitlab-url>/oauth/token`  
  * _UserApiEndpoint_: `https://<your-gitlab-url>/api/v3/user`  
  
  Note: Make sure your `HTTPS` or `HTTP` prefix for endpoint URLs matches your server configuration. 

5. (Optional) If you would like to force all users to sign-up with GitLab only, in the _ServiceSettings_ section of config/config.json set _DisableEmailSignUp_ to `true`.

6. Restart your Mattermost server to see the changes take effect.
