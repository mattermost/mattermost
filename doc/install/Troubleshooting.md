### Mattermost Troubleshooting

#### Important notes

1. **DO NOT manipulate the Mattermost database**
  - In particular, DO NOT delete data from the database, as Mattermost is designed to stop working if data integrity has been compromised. The system is designed to archive content continously and generally assumes data is never deleted. 


#### Common Issues 

1. Error message in logs when attempting to sign-up: `x509: certificate signed by unknown authority`
  - This error may appear when attempt to use a self-signed certificate to setup SSL, which is not yet supported by Mattermost. You can resolve this issue by setting up a load balancer like Ngnix. A ticket exists to [add support for self-signed certificates in future](x509: certificate signed by unknown authority). 
