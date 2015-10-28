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
