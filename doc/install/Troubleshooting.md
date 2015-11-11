# Mattermost Troubleshooting

#### Important notes

##### **DO NOT manipulate the Mattermost database**
  - In particular, DO NOT delete data from the database, as Mattermost is designed to stop working if data integrity has been compromised. The system is designed to archive content continously and generally assumes data is never deleted. 


#### Common Issues 

##### Lost System Administrator account
  - If the System Administrator account becomes unavailable, a person leaving the organization for example, you can set a new system admin from the commandline using `./platform -assign_role -team_name="yourteam" -email="you@example.com" -role="system_admin"`. 
  - After assigning the role the user needs to log out and log back in before the System Administrator role is applied.

#### Error Messages

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

###### `Token request failed`
 - This error can appear in the web browser after attempting to create a new team with GitLab SSO enabled
 - **Solutions:** 
   1. Check that your SSL settings for the SSO provider match the `http://` or `https://` choice selected in `config.json` under `GitLabSettings`
   2. Follow steps 1 to 3 of the manual [GitLab SSO configuration procedure](https://github.com/mattermost/platform/blob/master/doc/integrations/Single-Sign-On/Gitlab.md) to confirm your `Secret` and `Id` settings in `config.json` match your GitLab settings, and if they don't, manually update `config.json` to the correct settings and see if this clears the issue. 

#### Troubleshooting GitLab Mattermost

- If you're having issues installing GitLab Mattermost with GitLab Omnibus, as a first step please turn on logging by updating the [log settings](https://github.com/mattermost/platform/blob/master/doc/install/Configuration-Settings.md#log-file-settings) section in your `config.json` file installed by omnibus, and they try a general web search for the error message you receive. 
