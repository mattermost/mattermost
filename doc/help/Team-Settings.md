## Team Settings 

The Team Settings menu offers Team Administrators, Team Owners and System Administrators to adjust settings applying to a specific team. 

The following settings are found in a Team Site from the **Three-Dot** menu at the top of the left sidebar under **Team Settings**. 

### General  

General settings under the **Team Settings** > **General** configure how a team is displayed to users. 

#### Team Name

Your **Team Name** is displayed on the sign-in page, and in the top of the left-hand sidebar for your team. 

#### Allow anyone to sign-up from login page

Setting this option to **Yes** a link to the account creation page is included on the sign-in page of this team. 

Team Administrators would set this to **Yes** when they:  
 1. Operate on a closed network and want to make sign-up easy.  
 2. Operate on the open internet with sign-up restricted to specific domains, and want to allow easy sign-up from users with email addresses. Note: System Administrators can restrict sign-up to specific domains via the System Console.  
 3. Operate on the open internet and want to allow anyone to sign-up.

Team Administrators would set this to **No** when they:  
 1. Operate on the open internet and want a small, private team that is email-invite-only 

#### Include this team in the Team Directory

Setting this option to **Yes** includes the Team Name on the Home Page and a link to this team's sign-in page. 

Team Administrators would set this to **Yes** when they:  
 1. Operate on a closed network and want to make it easy to discover their team from the Home Page of the Mattermost server.
 2. Operate on the open internet with sign-up restricted to specific domains, and want to allow easy sign-up from users with email addresses. Note: System Administrators can restrict sign-up to specific domains via the System Console.  
 3. Operate on the open internet and want to allow anyone to sign-up to their team from the Home Page of the Mattermost server.

Team Administrators would set this to **No** when they:  
 1. Operate on the open internet and want a small, private team that is email-invite-only 

#### Invite Code 

When allowing anyone to sign-up from the login page, the **Invite Code** is used as part of the sign-up process. Clicking **Re-Generate** will invalidate the previous invitations and invitation URLs. 

### Import

#### Import from Slack (Beta) 

*Note: As a proprietary SaaS service, Slack is able to change its export format quickly and without notice. If you encounter issues not mentioned in the documentation below, please alert the product team by [filing an issue](https://github.com/mattermost/platform/issues).*

The Slack Import feature in Mattermost is in "Beta" and focus is on supporting migration of teams of less than 100 registered users. To use: 

1. Generate a Slack "Export" file from **Slack > Team Settings > Import/Export Data > Export > Start Export**  

2. In Mattermost go to **Team Settings > Import > Import from Slack**. _Team Owner_ or _Team Administrator_ role is required to access this menu option.

3. Click **Select file** to upload Slack export file and click **Import**.   

4. Emails and usernames from Slack are used to create new Mattermost accounts  

5. Slack users can activate their new Mattermost accounts by using Mattermost's Password Reset screen with their email addresses from Slack to set new passwords for their Mattermost accounts  

6. Once logged in, the Mattermost users will have access to previous Slack messages in the public channels imported from Slack.

**It is highly recommended that you test Slack import before applying it to an instance intended for production.** If you use Docker, you can spin up a test instance in one line (`docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform`). If you don't use Docker, there are [step-by-step instructions](../install/Docker-Single-Container.md) to install Mattermost in preview mode in less than 5 minutes.

#### Notes: 

- Newly added markdown suppport in Slack's Posts 2.0 feature announced on September 28, 2015 is not yet supported. 
- Slack does not export files or images your team has stored in Slack's database. Mattermost will provide links to the location of your assets in Slack's web UI.
- Slack does not export any content from private groups or direct messages that your team has stored in Slack's database. 
- In Beta, Slack accounts with username or email address collisions with existing Mattermost accounts will not import and mentions do not resolve as Mattermost usernames (still shows Slack ID). No pre-check or roll-back is currently offered. 
