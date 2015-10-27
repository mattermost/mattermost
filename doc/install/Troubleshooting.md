# Mattermost Troubleshooting

#### Important notes

##### **DO NOT manipulate the Mattermost database**
  - In particular, DO NOT delete data from the database, as Mattermost is designed to stop working if data integrity has been compromised. The system is designed to archive content continously and generally assumes data is never deleted. 


#### Common Issues 

##### Error message in logs when attempting to sign-up: `x509: certificate signed by unknown authority`
  - This error may appear when attempt to use a self-signed certificate to setup SSL, which is not yet supported by Mattermost. You can resolve this issue by setting up a load balancer like Ngnix. A ticket exists to [add support for self-signed certificates in future](x509: certificate signed by unknown authority). 

##### Lost System Administrator account
  - If the System Administrator account becomes unavailable, a person leaving the organization for example, you can set a new system admin from the commandline using `./platform -assign_role -team_name="yourteam" -email="you@example.com" -role="system_admin"`. 
  - After assigning the role the user needs to log out and log back in before the System Administrator role is applied.

##### Deactivate a user 

  - Team Admin or System Admin can go to **Main Menu** > **Manage Members** > **Make Inactive** to deactivate a user, which removes them from the team. 
  - To preserve audit history, users are never deleted from the system. It is highly recommended that System Administrators do not attempt to delete users manually from the database, as this may compromise system integrity and ability to upgrade in future. 

#### Error Messages

The following is a list of common error messages and solutions: 

##### "We cannot reach the Mattermost service.  The service may be down or misconfigured.  Please contact an administrator to make sure the WebSocket port is configured properly"
- Message appears in blue bar on team site. Check that [your websocket port is properly configured](https://github.com/mattermost/platform/blob/master/doc/install/Production-Ubuntu.md#set-up-nginx-server). 


