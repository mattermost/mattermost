# Command Line Tools

From the directory where the Mattermost platform is installed a `platform` command is available for configuring the system, including: 

- Creating teams
- Creating users
- Assigning roles to users 
- Reseting user passwords
- Permanently deleting users (use cautiously - database backup recommended before use)
- Permanently deleting teams (use cautiously - database backup recommended before use)

Typing `platform -help` brings up the below documentation on usage. 

```
Mattermost commands to help configure the system

NAME: 
    platform -- platform configuation tool
    
USAGE: 
    platform [options]
    
FLAGS: 
    -config="config.json"             Path to the config file
    
    -email="user@example.com"         Email address used in other commands
    
    -password="mypassword"            Password used in other commands
    
    -team_name="name"                 The team name used in other commands
    
    -role="admin"                     The role used in other commands
                                      valid values are
                                        "" - The empty role is basic user
                                           permissions
                                        "admin" - Represents a team admin and
                                           is used to help administer one team.
                                        "system_admin" - Represents a system
                                           admin who has access to all teams
                                           and configuration settings.
COMMANDS: 
    -create_team                      Creates a team.  It requires the -team_name
                                      and -email flag to create a team.
        Example:
            platform -create_team -team_name="name" -email="user@example.com"
            
    -create_user                      Creates a user.  It requires the -team_name,
                                      -email and -password flag to create a user.
        Example:
            platform -create_user -team_name="name" -email="user@example.com" -password="mypassword"
            
    -assign_role                      Assigns role to a user.  It requires the -role,
                                      -email and -team_name flag.  You may need to log out
                                      of your current sessions for the new role to be
                                      applied.
        Example:
            platform -assign_role -team_name="name" -email="user@example.com" -role="admin"
            
    -reset_password                   Resets the password for a user.  It requires the
                                      -team_name, -email and -password flag.
        Example:
            platform -reset_password -team_name="name" -email="user@example.com" -password="newpassword"
            
    -permanent_delete_user            Permanently deletes a user and all related information
                                      including posts from the database.  It requires the 
                                      -team_name, and -email flag.  You may need to restart the
                                      server to invalidate the cache
        Example:
            platform -permanent_delete_user -team_name="name" -email="user@example.com"
            
    -permanent_delete_team            Permanently deletes a team and all users along with
                                      all related information including posts from the database.
                                      It requires the -team_name flag.  You may need to restart
                                      the server to invalidate the cache.
        Example:
            platform -permanent_delete_team -team_name="name"
            
    -version                          Display the current of the Mattermost platform 
    
    -help                             Displays this help page`
```
