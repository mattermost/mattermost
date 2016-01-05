# Administration 

This document provides instructions for common administrator tasks

#### Important notes

##### **DO NOT manipulate the Mattermost database**
  - In particular, DO NOT delete data from the database, as Mattermost is designed to stop working if data integrity has been compromised. The system is designed to archive content continously and generally assumes data is never deleted. 

### Common Tasks

##### Creating System Administrator account from commandline
  - If the System Administrator account becomes unavailable, a person leaving the organization for example, you can set a new system admin from the commandline using `./platform -assign_role -team_name="yourteam" -email="you@example.com" -role="system_admin"`. 
  - After assigning the role the user needs to log out and log back in before the System Administrator role is applied.

##### Deactivating a user 

  - Team Admin or System Admin can go to **Main Menu** > **Manage Members** > **Make Inactive** to deactivate a user, which removes them from the team. 
  - To preserve audit history, users are never deleted from the system. It is highly recommended that System Administrators do not attempt to delete users manually from the database, as this may compromise system integrity and ability to upgrade in future. 

## GitLab Mattermost Administration 

GitLab Mattermost is a special version of Mattermost bundled with GitLab omnibus. Here we consolidate administrative instructions, guides and troubleshooting guidance.

### Installing GitLab Mattermost

Please follow the [GitLab Omnibus documentation for installing GitLab Mattermost](http://doc.gitlab.com/omnibus/gitlab-mattermost/).

### Community Support Resources

For help and support around your GitLab Mattermost deployment please see:

- [Troubleshooting Forum](https://forum.mattermost.org/t/about-the-trouble-shooting-category/150/1)
- [GitLab Mattermost issue tracker on GitLab.com](https://gitlab.com/gitlab-org/gitlab-mattermost/issues)

### Connecting Mattermost to integrations with incoming webhooks

#### Connecting Mattermost to GitLab for Slack-equivalent functionality. 

Mattermost is designed to be _Slack-compatible, not Slack-limited_ and supports integration via the Slack UI in GitLab, as well as fully customizable integrations. 

To enable this: 

1. In Mattermost, from a team site where you have System Administration privileges, from the main menu go to **System Console** > **Serice Settings** > **Enable Incoming Webhooks** and select **true** then click **Save**

2. Follow the step-by-step example of [connecting Mattermost incoming webhooks to GitLab's Slack webhooks UI](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Incoming-Webhooks.md#connecting-mattermost-to-gitlab-using-slack-ui). 

#### Connecting Mattermost to GitLab for functionality exceeding Slack integration. 

To enable this: 

1. In Mattermost, from a team site where you have System Administration privileges, from the main menu go to **System Console** > **Serice Settings** > **Enable Incoming Webhooks** and select **true** then click **Save**

2. Set up the [GitLab Integration Service for Mattermost](https://github.com/mattermost/mattermost-integration-gitlab).

### Connecting Mattermost to integrations with outgoing webhooks

Mattermost offers Slack-compatible outgoing webhooks, that can connect to applications created by the Mattermost community, such as [Hubot](https://www.npmjs.com/package/hubot-mattermost) and [IRC](https://github.com/42wim/matterbridge) support. 

To enable this: 

1. In Mattermost, from a team site where you have System Administration privileges, from the main menu go to **System Console** > **Serice Settings** > **Enable Outgoing Webhooks** and select **true** then click **Save**

2. Select a [Mattermost community application](http://www.mattermost.org/community-applications/) using outgoing webhooks--or adapt a Slack application using the same outgoing webhook standard--and follow the setup instructions provided. 

### Upgrading GitLab Mattermost manually

If you choose to upgrade Mattermost outside of GitLab's omnibus automation, please [follow this guide](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md#upgrading-mattermost-to-next-major-release).

### Upgrading GitLab Mattermost from GitLab 8.0 (containing Mattermost 0.7.1-beta)

To upgrade GitLab Mattermost from the 0.7.1-beta release of Mattermost in GitLab 8.0, please [follow this guide](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md#upgrading-mattermost-in-gitlab-80-to-gitlab-81-with-omnibus).

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

###### `"The redirect URI included is not valid.`
  - This error may be related to SSL configurations in your proxy after a GitLab omnibus upgrade from 8.0, which contained the Mattermost beta version.
  - **Solution:** 
    - Please check that each step of [the procedure for upgrading Mattermost in GitLab 8.0 to GitLab 8.1 was completed](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md#upgrading-mattermost-in-gitlab-80-to-gitlab-81-with-omnibus). Then check upgrades to successive major versions were completed using the procedure in the [Upgrade Guide](https://github.com/mattermost/platform/blob/master/doc/install/Upgrade-Guide.md#upgrading-mattermost-to-next-major-release).


###### `We couldn't find the existing account ...`
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
