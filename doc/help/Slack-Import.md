#### Slack Import (Alpha)

*Note: As a SaaS service, Slack is able to change its export format quickly. If you encounter issues not mentioned in the documentation below, please let us know by [filing an issue](https://github.com/mattermost/platform/issues).*

The Slack Import feature in Mattermost is in "Preview" and focus is on supporting migration of teams of less than 100 registered users. The feature can be accessed from by Team Administrators and Team Owners via the `Team Settings -> Import` menu option. 

Mattermost currently supports the processing of an "Export" file from Slack containing account information and public channel archives from a Slack team.   

- In the feature preview, emails and usernames from Slack are used to create new Mattermost accounts, connected to messages history in imported Slack channels. Users can activate these accounts and by going to the Password Reset screen in Mattermost to set new credentials. 
- Once logged in, users will have access to previous Slack messages shared in public channels, now imported to Mattermost.  

Limitations: 

- Newly added markdown suppport in Slack's Posts 2.0 feature announced on September 28, 2015 is not yet supported. 
- Slack does not export files or images your team has stored in Slack's database. Mattermost will provide links to the location of your assets in Slack's web UI.
- Slack does not export any content from private groups or direct messages that your team has stored in Slack's database. 
- The Preview release of Slack Import does not offer pre-checks or roll-back and will not import Slack accounts with username or email address collisions with existing Mattermost accounts. Also, Slack channel names with underscores will not import. Also, mentions do not yet resolve as Mattermost usernames (still show Slack ID).

