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
 - **Solution:** Restore from databse backup created prior to manual database updates, or reinstall the system.
