## LDAP Setup

LDAP authentication is available in the Enterprise version of Mattermost.
### How to enable LDAP

After installing Mattermost:

1. Create a team using email authentication
  - Note: The first account used to create a team will be the “System Administrator” account, used to configure settings for your Mattermost site
  3. Go to Main Menu (the three dots near your team name in the top left of your screen) > **System Console**
  4. Go to LDAP Settings
  5. Fill in the fields to set up Mattermost authentication with your LDAP server

  After LDAP has been enabled, users should be able to go to your Mattermost site and sign in using their LDAP credentials. The “LDAP username” will be the attribute set in the “Id Attribute” field. 

  **Note: In the initial implementation of LDAP, if a user attribute changes on the LDAP server it will be updated the next time the user enters their credentials to log in to Mattermost. This includes if a user is made inactive or removed from an LDAP server. Synchronization with LDAP servers is planned in a future release.**

### Switching System Administrator account to LDAP authentication

If you would like to switch your System Administrator account to LDAP authentication, it is recommended you do the following:

1. Create a new account using LDAP
  - Note: If your LDAP credentials use the same email address as your System Administrator account, it is recommended you change the email on your System Administrator account by going to Main Menu -> Account Settings -> General -> Email. This will free up the email address so it can be used by the LDAP account.
  2. Sign in to your email based System Administrator account
  3. Navigate to the System Console
  4. Go to Teams -> Team Name -> Users, and find your new LDAP user account
  5. Promote your LDAP account to “System Administrator” using the dropdown menu beside the username
  6. Log in with your LDAP account
  7. Navigate to the System Console
  8. Go to Teams -> Team Name -> Users, and find your old email based System Administrator account
  9. Make the email account “Inactive” using the dropdown beside the username

  **Note: If you make the email account inactive without promoting another account to System Administrator, you will lose your System Administrator privileges. This can be fixed by promoting another account to System Administrator using the command line.**

