# Mattermost Troubleshooting

#### Important notes

##### **DO NOT manipulate the Mattermost database**
  - In particular, DO NOT delete data from the database, as Mattermost is designed to stop working if data integrity has been compromised. The system is designed to archive content continously and generally assumes data is never deleted. 


#### Common Issues 

##### Lost System Administrator account
  - If the System Administrator account becomes unavailable, a person leaving the organization for example, you can set a new system admin from the commandline using `./platform -assign_role -team_name="yourteam" -email="you@example.com" -role="system_admin"`. 
  - After assigning the role the user needs to log out and log back in before the System Administrator role is applied.

#### Mattermost Error Messages

The following is a list of common error messages and solutions: 

###### `Please check connection, Mattermost unreachable. If issue persists, ask administrator to check WebSocket port.`
- Message appears in blue bar on team site. 
- **Solution:** Check that [your websocket port is properly configured](https://github.com/mattermost/platform/blob/master/doc/install/Production-Ubuntu.md#set-up-nginx-server). 


###### `x509: certificate signed by unknown authority` in server logs when attempting to sign-up
  - This error may appear when attempt to use a self-signed certificate to setup SSL, which is not yet supported by Mattermost. You
  - **Solution:** Set up a load balancer like Ngnix [per production install guide](https://github.com/mattermost/platform/blob/master/doc/install/Production-Ubuntu.md#set-up-nginx-with-ssl-recommended). A ticket exists to [add support for self-signed certificates in future](x509: certificate signed by unknown authority). 

###### `panic: runtime error: invalid memory address or nil pointer dereference`
 - This error can occur if you have manually manipulated the Mattermost database, typically with deletions. Mattermost is designed to serve as a searchable archive, and manual manipulation of the database elements compromises integrity and may prevent upgrade. 
 - **Solution:** Restore from database backup created prior to manual database updates, or reinstall the system.

### Troubleshooting GitLab Mattermost

- If you're having issues installing GitLab Mattermost with GitLab Omnibus, as a first step please turn on logging by updating the [log settings](https://github.com/mattermost/platform/blob/master/doc/install/Configuration-Settings.md#log-file-settings) section in your `config.json` file installed by omnibus, and they try a general web search for the error message you receive. 

#### GitLab Mattermost Error Messages

###### `We received an unexpected status code from the server (200)`

- If you have upgraded from a pre-released version of GitLab Mattermost or if an unforseen issue has arrisen during the [upgrade procedure](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md), you may be able to restore Mattermost using the following procedure: 
  - `sudo stop mattermost`, so DB can be dropped 
  - `sudo gitlab-ctl reconfigure`
  - `sudo -u gitlab-psql /opt/gitlab/embedded/bin/dropdb -h /var/opt/gitlab/postgresql mattermost_production`
  - `sudo start mattermost`
  - `sudo gitlab-ctl reconfigure`
  - [Manually set up GitLab SSO](https://github.com/mattermost/platform/blob/master/doc/integrations/Single-Sign-On/Gitlab.md) by copying Secret and ID into `/var/opt/gitlab/mattermost/config.json` 
  - `sudo gitlab-ctl restart`

###### `Token request failed`
 - This error can appear in the web browser after attempting to create a new team with GitLab SSO enabled
 - **Solutions:** 
   1. Check that your SSL settings for the SSO provider match the `http://` or `https://` choice selected in `config.json` under `GitLabSettings`
   2. Follow steps 1 to 3 of the manual [GitLab SSO configuration procedure](https://github.com/mattermost/platform/blob/master/doc/integrations/Single-Sign-On/Gitlab.md) to confirm your `Secret` and `Id` settings in `config.json` match your GitLab settings, and if they don't, manually update `config.json` to the correct settings and see if this clears the issue. 

###### `We couldn't find the existing account`
  - This error appears when a user attempts to sign in using a single-sign-on option with an account that was not created using that single-sign-on option. For example, if a user creates Account A using email sign-up, then attempts to sign-in using GitLab SSO, the error appears since Account A was not created using GitLab SSO. 
  - **Solution:** 
    - If you're switching from email auth to GitLab SSO, and you're getting this issue on an admin account, consider deactivating your email-based account, then creating a new account with System Admin privileges using GitLab SSO. Specifically: 
       1. Deactivate your email-based System Admin account (note: this process is [scheduled to improve](https://mattermost.atlassian.net/browse/PLT-975))
         1. Temporarily turn off email verification (**System Console** > **Email Settings** > **Require Email Verification** > **false**, or set `"RequireEmailVerification": false` in `config.json`).
         2. Change email for account to random address so you can create a new GitLab SSO account using your regular address.
       2. Create a new Mattermost account using GitLab SSO
         1. With GitLab SSO enabled, go to `https://domain.com/teamname` and sign-up for a new Mattermost account using your GitLab SSO account with preferred email address.
         2. [Upgrade the new account to System Admin privileges](https://github.com/mattermost/platform/blob/master/doc/install/Troubleshooting.md#lost-system-administrator-account).
       3. Deactivate the previous System Admin account that used email authentication.
         1. Using the new GitLab SSO System Admin account go to **System Console** > **[TEAMNAME]** > **Users**, find the previous account and set it to "Inactive"
