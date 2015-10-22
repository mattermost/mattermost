# Mattermost Troubleshooting

#### Important notes

##### **DO NOT manipulate the Mattermost database**
  - In particular, DO NOT delete data from the database, as Mattermost is designed to stop working if data integrity has been compromised. The system is designed to archive content continously and generally assumes data is never deleted. 


#### Common Issues 

##### Error message in logs when attempting to sign-up: `x509: certificate signed by unknown authority`
  - This error may appear when attempt to use a self-signed certificate to setup SSL, which is not yet supported by Mattermost. You can resolve this issue by setting up a load balancer like Ngnix. A ticket exists to [add support for self-signed certificates in future](x509: certificate signed by unknown authority). 

##### Lost System Administrator account
  - If the System Administrator account becomes unavailable, a person leaving the organization for example, you can set a new system admin from the commandline using `./platform -assign_role -team_name="yourteam" -email="you@example.com" -role="system_admin"`

