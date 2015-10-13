# Manage Members 

The Manage Members menu is used to change the user roles assigned to members belonging to a team. 

## User Roles 

The following user roles are assigned from the **Manage Members** menu option in the team site main menu. 

### System Admin

The System Administrator is typically a member of the IT staff and has the follow privileges: 

- Access to the System Console from the main menu in any team site. 
- Change any setting on the Mattermost server available in the System Console.
- Promote and demote other users to and from the System Admin role.
- This role also has all the privileges of the Team Administrator as described below

The first user added to a newly installed Mattermost system is assigned the System Admin role. 

### Team Admin 

The Team Administrator is typically a non-technical end user and has the following privileges: 

- Access to the "Team Settings" menu from the team site main menu
- Ability to change the team name and import data from Slack export files
- Access to the "Manage Members" menu and change user roles to the levels of Team Administrator, Member and Inactive

### Member 

This is the default role given to end users who join the system. Members have basic permissions to use the Mattermost team site.

### Inactive 

This status is given to users whose accounts are marked inactive. These users can no longer log into the system. 

Because Mattermost is designed as a system-of-record, there is not an option to delete users from the Mattermost system, as such an operation could compromise the integrity of message archives. 

